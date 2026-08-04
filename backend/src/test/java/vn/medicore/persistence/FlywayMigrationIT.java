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
                    "practitioner_role");
            assertThat(singleValue(statement, "select count(*) from role")).isEqualTo("4");
            assertThat(singleValue(statement, "select count(*) from permission")).isEqualTo("11");
            assertAuditIsAppendOnly(statement);
        }
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
