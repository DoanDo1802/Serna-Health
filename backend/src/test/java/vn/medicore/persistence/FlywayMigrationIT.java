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
    void appliesOnlyFoundationBaselineOnPostgreSql17InUtc() throws SQLException {
        assertThat(flyway.validateWithResult().validationSuccessful).isTrue();
        assertThat(flyway.migrate().migrationsExecuted).isZero();

        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement()) {
            assertThat(singleValue(statement, "show server_version_num")).startsWith("17");
            assertThat(singleValue(statement, "show timezone")).isEqualTo("UTC");
            assertThat(publicTables(statement)).containsExactly("flyway_schema_history");
        }
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
