package vn.medicore.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
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
import vn.medicore.dto.IdentityAuditContext;
import vn.medicore.service.IdentityAccessService;

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

    @Autowired
    IdentityAccessService identityAccess;

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
        assertThat(jdbc.queryForObject(
                "select normalized_email from user_account where normalized_email = 'user@example.com'",
                String.class)).isEqualTo("user@example.com");
        assertThat(jdbc.queryForObject("""
                select encoded_hash from password_credential credential
                join user_account account on account.id = credential.account_id
                where account.normalized_email = 'user@example.com'
                """, String.class)).startsWith("$argon2");
        assertThat(jdbc.queryForObject("""
                select secret_hash from authentication_challenge
                where normalized_target = 'user@example.com'
                """, String.class)).doesNotContain("000000");
    }

    @Test
    void registrationRequiresIdempotencyKeyBeforeCreatingAccount() throws Exception {
        mockMvc.perform(post("/api/v1/auth/registrations")
                        .header("X-Request-Id", "request-idempotency")
                        .header("X-Correlation-Id", "correlation-idempotency")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"missing-key@example.com\",\"password\":\"a-valid-password-123\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(header().string("X-Request-Id", "request-idempotency"))
                .andExpect(header().string("X-Correlation-Id", "correlation-idempotency"))
                .andExpect(jsonPath("$.code").value("IDEMPOTENCY_KEY_REQUIRED"));

        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        assertThat(jdbc.queryForObject(
                "select count(*) from user_account where normalized_email = 'missing-key@example.com'", Integer.class))
                .isZero();
    }

    @Test
    void registrationReplayReturnsOriginalBodyAndTraceHeaders() throws Exception {
        String body = "{\"email\":\"replay@example.com\",\"password\":\"a-valid-password-123\"}";
        String key = "registration-replay-key";

        String first = mockMvc.perform(post("/api/v1/auth/registrations")
                        .header("Idempotency-Key", key)
                        .header("X-Request-Id", "replay-request")
                        .header("X-Correlation-Id", "replay-correlation")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isAccepted())
                .andReturn().getResponse().getContentAsString();

        mockMvc.perform(post("/api/v1/auth/registrations")
                        .header("Idempotency-Key", key)
                        .header("X-Request-Id", "different-request")
                        .header("X-Correlation-Id", "different-correlation")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isAccepted())
                .andExpect(header().string("X-Request-Id", "replay-request"))
                .andExpect(header().string("X-Correlation-Id", "replay-correlation"))
                .andExpect(result -> assertThat(result.getResponse().getContentAsString()).isEqualTo(first));

        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        assertThat(jdbc.queryForObject(
                "select count(*) from user_account where normalized_email = 'replay@example.com'", Integer.class))
                .isEqualTo(1);
    }

    @Test
    void concurrentRegistrationReusesCompletedResponseWithoutDuplicateAccount() throws Exception {
        String email = "concurrent@example.com";
        String body = "{\"email\":\"%s\",\"password\":\"a-valid-password-123\"}".formatted(email);
        String key = "concurrent-registration-key";
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            Future<Integer> first = executor.submit(() -> concurrentRegistration(ready, start, key, body));
            Future<Integer> second = executor.submit(() -> concurrentRegistration(ready, start, key, body));
            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            assertThat(first.get(20, TimeUnit.SECONDS)).isEqualTo(202);
            assertThat(second.get(20, TimeUnit.SECONDS)).isEqualTo(202);
        }

        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        assertThat(jdbc.queryForObject(
                "select count(*) from user_account where normalized_email = ?", Integer.class, email)).isEqualTo(1);
        assertThat(jdbc.queryForObject(
                "select count(*) from idempotency_record where idempotency_key = ?", Integer.class, key)).isEqualTo(1);
    }

    @Test
    void registrationRejectsSameKeyWithDifferentPayload() throws Exception {
        String key = "registration-conflict-key";
        mockMvc.perform(post("/api/v1/auth/registrations")
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"conflict-a@example.com\",\"password\":\"a-valid-password-123\"}"))
                .andExpect(status().isAccepted());

        mockMvc.perform(post("/api/v1/auth/registrations")
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"conflict-b@example.com\",\"password\":\"a-valid-password-123\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("IDEMPOTENCY_KEY_REUSED"));
    }

    @Test
    void wrongPasswordAndMissingAccountReturnSameGenericProblem() throws Exception {
        String existing = loginProblem("known@example.com", "wrong-password");
        String missing = loginProblem("missing@example.com", "wrong-password");

        assertThat(existing).isEqualTo(missing);
    }

    @Test
    void protectedEndpointDefaultsToTraceableProblem() throws Exception {
        mockMvc.perform(get("/api/v1/admin/accounts")
                        .header("X-Request-Id", "request-401")
                        .header("X-Correlation-Id", "correlation-401"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string("X-Request-Id", "request-401"))
                .andExpect(header().string("X-Correlation-Id", "correlation-401"))
                .andExpect(jsonPath("$.code").value("AUTH_REQUIRED"))
                .andExpect(jsonPath("$.requestId").value("request-401"))
                .andExpect(jsonPath("$.correlationId").value("correlation-401"));
    }

    @Test
    void sessionMutationRequiresCsrfAndDoesNotReserveIdempotencyRecord() throws Exception {
        String email = "csrf@example.com";
        mockMvc.perform(post("/api/v1/auth/registrations")
                        .header("Idempotency-Key", "csrf-registration-key")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"password\":\"a-valid-password-123\"}".formatted(email)))
                .andExpect(status().isAccepted());

        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        jdbc.update("update user_account set status = 'ACTIVE', email_verified_at = now() where normalized_email = ?", email);
        var login = mockMvc.perform(post("/api/v1/auth/password-sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"password\":\"a-valid-password-123\"}".formatted(email)))
                .andExpect(status().isOk())
                .andReturn().getResponse();

        mockMvc.perform(delete("/api/v1/auth/sessions")
                        .cookie(login.getCookie("MEDICORE_SESSION"))
                        .header("Idempotency-Key", "csrf-session-key")
                        .header("X-Request-Id", "csrf-request")
                        .header("X-Correlation-Id", "csrf-correlation"))
                .andExpect(status().isForbidden())
                .andExpect(header().string("X-Request-Id", "csrf-request"))
                .andExpect(header().string("X-Correlation-Id", "csrf-correlation"))
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));

        assertThat(jdbc.queryForObject(
                "select count(*) from idempotency_record where idempotency_key = 'csrf-session-key'",
                Integer.class)).isZero();
    }

    @Test
    void identityRoleMutationWritesTraceableAppendOnlyAuditEvent() {
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        UUID actorId = UUID.randomUUID();
        jdbc.update("""
                insert into user_account(id, normalized_email, display_email, status, failed_login_count, version, created_at, updated_at)
                values (?, 'auditor@example.com', 'auditor@example.com', 'ACTIVE', 0, 0, now(), now())
                """, actorId);
        IdentityAuditContext audit = new IdentityAuditContext(
                actorId,
                "audit-session",
                Map.of("permissions", List.of("role.create")),
                "audit-request",
                "audit-correlation");

        var role = identityAccess.createRole("AUDIT_TEST_ROLE", "Audit test role", audit);

        Map<String, Object> event = jdbc.queryForMap("""
                select actor_type, actor_account_id, resource_type, resource_id, resource_version,
                    action, outcome, session_id, request_id, correlation_id, effective_role_snapshot
                from audit_event where resource_id = ?
                """, role.id());
        assertThat(event).containsEntry("actor_type", "ACCOUNT")
                .containsEntry("actor_account_id", actorId)
                .containsEntry("resource_type", "role")
                .containsEntry("resource_id", role.id())
                .containsEntry("resource_version", 0L)
                .containsEntry("action", "identity.role.create")
                .containsEntry("outcome", "SUCCEEDED")
                .containsEntry("session_id", "audit-session")
                .containsEntry("request_id", "audit-request")
                .containsEntry("correlation_id", "audit-correlation");
    }

    @Test
    void malformedTraceHeaderReturnsTraceableProblem() throws Exception {
        mockMvc.perform(post("/api/v1/auth/password-sessions")
                        .header("X-Request-Id", "x".repeat(129))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"known@example.com\",\"password\":\"wrong-password\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_INVALID_REQUEST"))
                .andExpect(header().exists("X-Request-Id"))
                .andExpect(header().exists("X-Correlation-Id"));
    }

    private int concurrentRegistration(
            CountDownLatch ready,
            CountDownLatch start,
            String key,
            String body) throws Exception {
        ready.countDown();
        if (!start.await(5, TimeUnit.SECONDS)) throw new IllegalStateException("Concurrent test did not start");
        return mockMvc.perform(post("/api/v1/auth/registrations")
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andReturn()
                .getResponse()
                .getStatus();
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
                .replaceAll("\"requestId\":\"[^\"]+\"", "\"requestId\":\"redacted\"")
                .replaceAll("\"correlationId\":\"[^\"]+\"", "\"correlationId\":\"redacted\"");
    }
}
