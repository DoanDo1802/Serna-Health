package vn.medicore.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import vn.medicore.MediCoreApplication;

@Testcontainers
@SpringBootTest(classes = MediCoreApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthenticationIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17.10");

    @Autowired
    MockMvc mockMvc;

    @Autowired
    DataSource dataSource;

    @Test
    void registrationNormalizesEmailAndDoesNotExposeChallengeSecret() throws Exception {
        mockMvc.perform(post("/api/v1/auth/registrations")
                        .header("X-Request-Id", "registration-1")
                        .header("Idempotency-Key", "registration-key-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":" User@Example.COM ","password":"a-valid-password-123"}
                                """))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.accepted").value(true))
                .andExpect(jsonPath("$.requestId").value("registration-1"));

        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        assertThat(jdbc.queryForObject("select normalized_email from user_account", String.class))
                .isEqualTo("user@example.com");
        assertThat(jdbc.queryForObject("select encoded_hash from password_credential", String.class))
                .startsWith("$argon2");
        assertThat(jdbc.queryForObject("select secret_hash from authentication_challenge", String.class))
                .doesNotContain("000000");
    }

    @Test
    void wrongPasswordAndMissingAccountReturnSameGenericProblem() throws Exception {
        String existing = loginProblem("known@example.com", "wrong-password");
        String missing = loginProblem("missing@example.com", "wrong-password");

        assertThat(existing).isEqualTo(missing);
    }

    @Test
    void protectedEndpointDefaultsToUnauthorized() throws Exception {
        mockMvc.perform(get("/api/v1/admin/accounts"))
                .andExpect(status().isUnauthorized());
    }

    private String loginProblem(String email, String password) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/password-sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"%s"}
                                """.formatted(email, password)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_FAILED"))
                .andReturn().getResponse().getContentAsString()
                .replaceAll("\"requestId\":\"[^\"]+\"", "\"requestId\":\"redacted\"");
    }
}
