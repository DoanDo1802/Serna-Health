package vn.medicore.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.HashSet;
import java.util.Set;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import vn.medicore.MediCoreApplication;

@Testcontainers
@SpringBootTest(classes = MediCoreApplication.class)
@ActiveProfiles("test")
class FlywayMigrationIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17.10");

    @Autowired
    private DataSource dataSource;

    @Autowired
    private Flyway flyway;

    @Test
    void appliesR102SchemaOnPostgreSql17InUtc() throws SQLException {
        assertThat(flyway.validateWithResult().validationSuccessful).isTrue();
        assertThat(flyway.migrate().migrationsExecuted).isZero();

        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement()) {
            assertThat(singleValue(statement, "show server_version_num")).startsWith("17");
            assertThat(singleValue(statement, "show timezone")).isEqualTo("UTC");
            assertThat(publicTables(statement)).containsExactlyInAnyOrder(
                    "flyway_schema_history",
                    "audit_event",
                    "idempotency_record",
                    "outbox_event",
                    "user_account",
                    "password_credential",
                    "authentication_challenge",
                    "account_token",
                    "account_session",
                    "role",
                    "permission",
                    "role_permission",
                    "account_role_assignment",
                    "break_glass_grant",
                    // R1-03 Catalog
                    "department",
                    "room",
                    "service",
                    "service_price",
                    "practitioner",
                    "practitioner_role",
                    // R1-04 Patient
                    "patient",
                    "patient_identifier",
                    "patient_account_link",
                    "patient_duplicate_candidate",
                    "appointment_slot",
                    "slot_hold",
                    "appointment",
                    // R1-06 Payment
                    "payment_intent",
                    "webhook_inbox",
                    "payment");
            assertThat(singleValue(statement, "select count(*) from role")).isEqualTo("5");
            assertThat(singleValue(statement, "select count(*) from permission")).isEqualTo("60");
            assertThat(singleValue(statement, """
                    select count(*) from pg_constraint
                    where conname in ('ck_patient_identifier_verification_source', 'ck_patient_account_link_scope',
                        'ck_patient_account_link_revocation', 'ck_slot_hold_status', 'uq_appointment_slot_hold',
                        'ck_payment_intent_reconciliation', 'ck_webhook_inbox_processed_state', 'ck_payment_captured_state')
                    """)).isEqualTo("8");
            assertThat(singleValue(statement, """
                    select count(*) from permission where action in (
                        'appointment_slot.read', 'appointment_slot.create', 'appointment_slot.update',
                        'appointment_slot.cancel', 'slot_hold.create', 'slot_hold.read', 'slot_hold.cancel',
                        'payment_intent.create', 'payment_intent.read', 'payment.mock.simulate')
                    """)).isEqualTo("10");
            assertThat(singleValue(statement, """
                    select pg_get_constraintdef(oid) from pg_constraint
                    where conrelid = 'appointment'::regclass and contype = 'c'
                    """)).contains("CONFIRMED").contains("FULFILLED");
            assertThat(singleValue(statement, """
                    select count(*) from pg_indexes
                    where schemaname = 'public' and indexname in ('ix_duplicate_candidate_source_pending',
                        'ix_duplicate_candidate_candidate_pending', 'ix_patient_identifier_patient_effective',
                        'ix_patient_account_link_patient_valid', 'ix_appointment_slot_capacity',
                        'ix_slot_hold_slot_active_expiry', 'uq_payment_intent_provider_reference',
                        'ix_payment_intent_status_updated', 'ix_webhook_inbox_status_next',
                        'ix_payment_captured_status')
                    """)).isEqualTo("10");
            assertAuditIsAppendOnly(statement);
            assertPaymentIsAppendOnly(statement);
        }
    }

    private void assertPaymentIsAppendOnly(Statement statement) throws SQLException {
        statement.executeUpdate("""
                insert into payment(id, provider, provider_transaction_id, amount, currency, status,
                    provider_time_trust, captured_at, created_at)
                values ('01980000-0000-7002-8000-000000000002', 'MOCK_PAY', 'tx_immutability_test',
                    50000.00, 'VND', 'CAPTURED', 'TRUSTED', now(), now())
                """);
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> statement.executeUpdate("update payment set status = 'FAILED'"))
                .isInstanceOf(SQLException.class)
                .hasMessageContaining("payment is append-only");
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> statement.executeUpdate("delete from payment"))
                .isInstanceOf(SQLException.class)
                .hasMessageContaining("payment is append-only");
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> statement.executeUpdate("truncate payment"))
                .isInstanceOf(SQLException.class)
                .hasMessageContaining("payment is append-only");
    }

    private void assertAuditIsAppendOnly(Statement statement) throws SQLException {
        statement.executeUpdate("""
                insert into audit_event(id, actor_type, purpose, authorization_basis, resource_type, action,
                    outcome, source_system, source_event, request_id, correlation_id, occurred_at)
                values ('01980000-0000-7002-8000-000000000001', 'SYSTEM', 'test', 'test', 'migration',
                    'audit.read', 'SUCCEEDED', 'test', 'test', 'request', 'correlation', now())
                """);
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> statement.executeUpdate("truncate audit_event"))
                .isInstanceOf(SQLException.class)
                .hasMessageContaining("audit_event is append-only");
        assertThat(singleValue(statement, "select count(*) from audit_event")).isEqualTo("1");
    }

    private String singleValue(Statement statement, String sql) throws SQLException {
        try (ResultSet result = statement.executeQuery(sql)) {
            result.next();
            return result.getString(1);
        }
    }

    private Set<String> publicTables(Statement statement) throws SQLException {
        Set<String> tables = new HashSet<>();
        try (ResultSet result = statement.executeQuery("""
                select tablename
                from pg_catalog.pg_tables
                where schemaname = 'public'
                """)) {
            while (result.next()) {
                tables.add(result.getString(1));
            }
        }
        return tables;
    }
}
