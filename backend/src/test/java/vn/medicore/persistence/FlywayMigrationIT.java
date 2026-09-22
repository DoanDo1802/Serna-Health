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
                    "payment",
                    // R1-07 Reschedule & Deposit
                    "deposit_allocation",
                    "deposit_transfer",
                    "deposit_transfer_leg",
                    "reschedule_top_up",
                    // V23 personnel provisioning
                    "personnel_member",
                    "practitioner_profile",
                    // V24 aggregate booking and doctor schedules
                    "booking_session",
                    "work_schedule",
                    // V28 reception clinical doctor workflow
                    "visit",
                    "check_in",
                    "encounter",
                    "encounter_participant",
                    "clinical_note",
                    "clinical_note_version",
                    // V29 & V31 facility layout
                    "room_department",
                    "room_service",
                    "facility_floor",
                    "facility_floor_element",
                    "facility_floor_symbol");
            assertThat(singleValue(statement, "select count(*) from role")).isEqualTo("6");
            assertThat(singleValue(statement, "select count(*) from permission")).isEqualTo("85");
            assertThat(singleValue(statement, """
                    select count(*) from permission
                    where action in ('work_schedule.create', 'work_schedule.read',
                        'work_schedule.update', 'work_schedule.cancel')
                    """)).isEqualTo("4");
            assertThat(singleValue(statement, """
                    select count(*) from role_permission rp
                    join permission p on p.id = rp.permission_id
                    where rp.role_id = '01980000-0000-7000-8000-000000000001'
                      and p.action in ('work_schedule.create', 'work_schedule.read',
                        'work_schedule.update', 'work_schedule.cancel')
                    """)).isEqualTo("4");
            assertThat(singleValue(statement, """
                    select count(*) from information_schema.columns
                    where table_schema = 'public' and table_name = 'appointment_slot'
                      and column_name = 'work_schedule_id' and data_type = 'uuid'
                    """)).isEqualTo("1");
            assertThat(singleValue(statement, """
                    select count(*) from pg_constraint
                    where conrelid = 'appointment_slot'::regclass
                      and confrelid = 'work_schedule'::regclass
                    """)).isEqualTo("1");
            assertThat(singleValue(statement, """
                    select count(*) from pg_indexes
                    where schemaname = 'public' and indexname in (
                        'ux_booking_session_active_bucket', 'ix_booking_session_active_start',
                        'ix_work_schedule_active_session', 'ix_work_schedule_active_role',
                        'ux_appointment_slot_work_schedule', 'ix_appointment_slot_active_work_schedule')
                    """)).isEqualTo("6");
            assertThat(singleValue(statement, """
                    select indexdef from pg_indexes
                    where schemaname = 'public' and indexname = 'ux_booking_session_active_bucket'
                    """)).contains("status").contains("ACTIVE");
            assertThat(singleValue(statement, """
                    select indexdef from pg_indexes
                    where schemaname = 'public' and indexname = 'ux_appointment_slot_work_schedule'
                    """)).contains("WHERE (work_schedule_id IS NOT NULL)");
            assertThat(singleValue(statement, """
                    select count(*) from flyway_schema_history
                    where version = '24' and description = 'work schedule booking session' and success
                    """)).isEqualTo("1");
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
                        'payment_intent.create', 'payment_intent.read', 'payment.mock.simulate',
                        'appointment.reschedule')
                    """)).isEqualTo("11");
            assertThat(singleValue(statement, """
                    select pg_get_constraintdef(oid) from pg_constraint
                    where conrelid = 'appointment'::regclass and contype = 'c' and conname = 'ck_appointment_status'
                    """)).contains("CONFIRMED").contains("RESCHEDULED").contains("FULFILLED");
            assertThat(singleValue(statement, """
                    select count(*) from pg_indexes
                    where schemaname = 'public' and indexname in ('ix_duplicate_candidate_source_pending',
                        'ix_duplicate_candidate_candidate_pending', 'ix_patient_identifier_patient_effective',
                        'ix_patient_account_link_patient_valid', 'ix_appointment_slot_capacity',
                        'ix_slot_hold_slot_active_expiry', 'uq_payment_intent_provider_reference',
                        'ix_payment_intent_status_updated', 'ix_webhook_inbox_status_next',
                        'ix_payment_captured_status', 'uq_appointment_rescheduled_from',
                        'uq_appointment_rescheduled_to', 'ix_deposit_allocation_appointment',
                        'uq_deposit_transfer_old_appointment', 'uq_reschedule_top_up_pending_appointment',
                        'uq_deposit_allocation_target_source')
                    """)).isEqualTo("16");
            assertAuditIsAppendOnly(statement);
            assertPaymentIsAppendOnly(statement);
            assertDepositTransferIsAppendOnly(statement);
            assertDepositTransferLegIsAppendOnly(statement);
            assertRescheduleTopUpIsAppendOnly(statement);
        }
    }

    private void assertDepositTransferLegIsAppendOnly(Statement statement) throws SQLException {
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> statement.executeUpdate("truncate deposit_transfer_leg"))
                .isInstanceOf(SQLException.class)
                .hasMessageContaining("deposit_transfer_leg rows are append-only");
    }

    private void assertRescheduleTopUpIsAppendOnly(Statement statement) throws SQLException {
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> statement.executeUpdate("truncate reschedule_top_up"))
                .isInstanceOf(SQLException.class)
                .hasMessageContaining("reschedule_top_up rows are append-only");
    }

    private void assertDepositTransferIsAppendOnly(Statement statement) throws SQLException {
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> statement.executeUpdate("truncate deposit_transfer cascade"))
                .isInstanceOf(SQLException.class)
                .hasMessageContaining("deposit_transfer rows are append-only");
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
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> statement.executeUpdate("truncate payment cascade"))
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
