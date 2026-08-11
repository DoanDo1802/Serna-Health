package vn.medicore.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockCookie;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import vn.medicore.MediCoreApplication;
import vn.medicore.config.SecretHasher;

@Testcontainers
@SpringBootTest(classes = MediCoreApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CatalogIT {

    private static final UUID CATALOG_ADMINISTRATOR_ROLE_ID = UUID.fromString("01980000-0000-7000-8000-000000000004");

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17.10");

    @Autowired
    MockMvc mockMvc;

    @Autowired
    DataSource dataSource;

    @Autowired
    SecretHasher secretHasher;

    @Autowired
    ObjectMapper objectMapper;

    @Test
    void catalogRoutesEnforceAuthorityAndSessionCsrf() throws Exception {
        mockMvc.perform(get("/api/v1/departments"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_REQUIRED"));

        AuthSession noPermissions = session(Set.of());
        mockMvc.perform(get("/api/v1/departments").cookie(noPermissions.cookie()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));

        AuthSession administrator = catalogAdministrator();
        mockMvc.perform(post("/api/v1/departments")
                        .cookie(administrator.cookie())
                        .header("Idempotency-Key", "catalog-csrf-key")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(departmentBody("CSRF", "CSRF Department")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));

        assertThat(jdbc().queryForObject(
                "select count(*) from idempotency_record where idempotency_key = 'catalog-csrf-key'", Integer.class)).isZero();
    }

    @Test
    void canonicalRoomRouteReplaysIdempotentResponseAndAuditsRealContext() throws Exception {
        AuthSession administrator = catalogAdministrator();
        UUID departmentId = createDepartment(administrator, "ROOM", "Room Department");
        String body = """
                {"departmentId":"%s","code":"R-101","name":"Exam room"}
                """.formatted(departmentId);

        MvcResult first = mockMvc.perform(post("/api/v1/rooms")
                        .cookie(administrator.cookie())
                        .header("X-CSRF-Token", administrator.csrfToken())
                        .header("X-Request-Id", "catalog-room-request")
                        .header("X-Correlation-Id", "catalog-room-correlation")
                        .header("Idempotency-Key", "catalog-room-replay-key")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(header().string("ETag", "\"0\""))
                .andExpect(jsonPath("$.departmentId").value(departmentId.toString()))
                .andReturn();

        String firstBody = first.getResponse().getContentAsString();
        UUID roomId = UUID.fromString(objectMapper.readTree(firstBody).path("id").asText());
        mockMvc.perform(post("/api/v1/rooms")
                        .cookie(administrator.cookie())
                        .header("X-CSRF-Token", administrator.csrfToken())
                        .header("X-Request-Id", "different-request")
                        .header("X-Correlation-Id", "different-correlation")
                        .header("Idempotency-Key", "catalog-room-replay-key")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Request-Id", "catalog-room-request"))
                .andExpect(header().string("X-Correlation-Id", "catalog-room-correlation"))
                .andExpect(result -> assertThat(result.getResponse().getContentAsString()).isEqualTo(firstBody));

        mockMvc.perform(post("/api/v1/departments/%s/rooms".formatted(departmentId))
                        .cookie(administrator.cookie())
                        .header("X-CSRF-Token", administrator.csrfToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"LEGACY\",\"name\":\"Legacy room\"}"))
                .andExpect(status().isNotFound());

        Map<String, Object> event = jdbc().queryForMap("""
                select actor_type, actor_account_id, action, outcome, resource_type, resource_id, resource_version,
                       session_id, request_id, correlation_id, effective_role_snapshot, reason
                from audit_event where resource_id = ?
                """, roomId);
        assertThat(event).containsEntry("actor_type", "ACCOUNT")
                .containsEntry("actor_account_id", administrator.accountId())
                .containsEntry("action", "room.create")
                .containsEntry("outcome", "SUCCEEDED")
                .containsEntry("resource_type", "Room")
                .containsEntry("resource_id", roomId)
                .containsEntry("resource_version", 0L)
                .containsEntry("session_id", administrator.sessionId().toString())
                .containsEntry("request_id", "catalog-room-request")
                .containsEntry("correlation_id", "catalog-room-correlation")
                .containsEntry("reason", "created");
        assertThat(event.get("effective_role_snapshot").toString()).contains("room.create");
    }

    @Test
    void servicePriceUsesEtagForEndAndPreservesTimelineIntegrity() throws Exception {
        AuthSession administrator = catalogAdministrator();
        UUID serviceId = createService(administrator, "PRICE");
        UUID priceId = createServicePrice(administrator, serviceId, "100000.00", "2030-01-01T00:00:00Z");

        mockMvc.perform(post("/api/v1/service-prices/%s/actions/end".formatted(priceId))
                        .cookie(administrator.cookie())
                        .header("X-CSRF-Token", administrator.csrfToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"effectiveTo\":\"2030-02-01T00:00:00Z\"}"))
                .andExpect(status().isPreconditionRequired())
                .andExpect(jsonPath("$.code").value("CONCURRENCY_PRECONDITION_REQUIRED"));

        mockMvc.perform(post("/api/v1/service-prices/%s/actions/end".formatted(priceId))
                        .cookie(administrator.cookie())
                        .header("X-CSRF-Token", administrator.csrfToken())
                        .header("If-Match", "\"77\"")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"effectiveTo\":\"2030-02-01T00:00:00Z\"}"))
                .andExpect(status().isPreconditionFailed())
                .andExpect(jsonPath("$.code").value("CONCURRENCY_STALE_VERSION"));

        mockMvc.perform(post("/api/v1/service-prices/%s/actions/end".formatted(priceId))
                        .cookie(administrator.cookie())
                        .header("X-CSRF-Token", administrator.csrfToken())
                        .header("If-Match", "\"0\"")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"effectiveTo\":\"2030-02-01T00:00:00Z\"}"))
                .andExpect(status().isOk())
                .andExpect(header().string("ETag", "\"1\""))
                .andExpect(jsonPath("$.version").value(1))
                .andExpect(jsonPath("$.effectiveTo").value("2030-02-01T00:00:00Z"));

        UUID successorId = createServicePrice(administrator, serviceId, "120000.00", "2030-02-01T00:00:00Z");
        assertThat(successorId).isNotEqualTo(priceId);
        assertThat(jdbc().queryForObject("""
                select count(*) from service_price
                where service_id = ? and tstzrange(effective_from, coalesce(effective_to, 'infinity'::timestamptz), '[)')
                    @> '2030-02-01T00:00:00Z'::timestamptz
                """, Integer.class, serviceId)).isEqualTo(1);
    }

    @Test
    void practitionerRoleRevocationPersistsEvidenceAndPreventsOverlappingActiveAssignment() throws Exception {
        AuthSession administrator = catalogAdministrator();
        UUID departmentId = createDepartment(administrator, "ROLE", "Role Department");
        UUID practitionerId = createPractitioner(administrator, "ROLE-PRAC", "Role Practitioner");
        UUID roleId = assignRole(administrator, practitionerId, departmentId, "2030-01-01T00:00:00Z");

        UUID conflictPractitionerId = createPractitioner(administrator, "ROLE-CONFLICT-PRAC", "Conflict Practitioner");
        mockMvc.perform(post("/api/v1/practitioners/%s/roles".formatted(conflictPractitionerId))
                        .cookie(administrator.cookie())
                        .header("X-CSRF-Token", administrator.csrfToken())
                        .header("Idempotency-Key", "catalog-role-conflict-key")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"departmentId":"%s","roleCode":"DOCTOR","effectiveFrom":"2030-01-15T00:00:00Z"}
                                """.formatted(departmentId)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/practitioner-roles/%s/actions/revoke".formatted(roleId))
                        .cookie(administrator.cookie())
                        .header("X-CSRF-Token", administrator.csrfToken())
                        .header("If-Match", "\"0\"")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Roster correction\"}"))
                .andExpect(status().isOk())
                .andExpect(header().string("ETag", "\"1\""))
                .andExpect(jsonPath("$.status").value("REVOKED"))
                .andExpect(jsonPath("$.revokedByAccountId").value(administrator.accountId().toString()))
                .andExpect(jsonPath("$.revokeReason").value("Roster correction"));

        Map<String, Object> row = jdbc().queryForMap("""
                select status, revoked_at, revoked_by_account_id, revoke_reason, version
                from practitioner_role where id = ?
                """, roleId);
        assertThat(row).containsEntry("status", "REVOKED")
                .containsEntry("revoked_by_account_id", administrator.accountId())
                .containsEntry("revoke_reason", "Roster correction")
                .containsEntry("version", 1L);
        assertThat(row.get("revoked_at")).isNotNull();
    }

    @Test
    void practitionerRoleActiveRangeExclusionRejectsOverlappingAssignment() throws Exception {
        AuthSession administrator = catalogAdministrator();
        UUID departmentId = createDepartment(administrator, "OVERLAP", "Overlap Department");
        UUID practitionerId = createPractitioner(administrator, "OVERLAP-PRAC", "Overlap Practitioner");
        assignRole(administrator, practitionerId, departmentId, "2030-01-01T00:00:00Z");

        mockMvc.perform(post("/api/v1/practitioners/%s/roles".formatted(practitionerId))
                        .cookie(administrator.cookie())
                        .header("X-CSRF-Token", administrator.csrfToken())
                        .header("Idempotency-Key", "catalog-role-overlap-key")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"departmentId":"%s","roleCode":"DOCTOR","effectiveFrom":"2030-01-15T00:00:00Z"}
                                """.formatted(departmentId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STATE_CONFLICT"));
    }

    @Test
    void paginationAdvancesThroughThirdPageWithoutDuplicates() throws Exception {
        AuthSession administrator = catalogAdministrator();
        for (int index = 1; index <= 5; index++) {
            createDepartment(administrator, "PAGE-%d".formatted(index), "Page %02d".formatted(index));
        }

        Set<String> ids = new HashSet<>();
        String cursor = null;
        int pages = 0;
        do {
            JsonNode response = page(administrator, "/api/v1/departments?limit=2"
                    + (cursor == null ? "" : "&cursor=" + cursor));
            List<String> pageIds = itemIds(response);
            assertThat(ids.addAll(pageIds)).isTrue();
            pages++;
            cursor = response.path("hasMore").asBoolean() ? response.path("nextCursor").asText() : null;
        } while (cursor != null);

        assertThat(pages).isGreaterThanOrEqualTo(3);
        assertThat(ids).hasSize(jdbc().queryForObject("select count(*) from department", Integer.class));
    }

    private AuthSession catalogAdministrator() {
        return session(Set.of(CATALOG_ADMINISTRATOR_ROLE_ID));
    }

    private AuthSession session(Set<UUID> roleIds) {
        UUID accountId = UUID.randomUUID();
        UUID sessionId = UUID.randomUUID();
        String rawSession = "session-" + UUID.randomUUID();
        String csrfToken = "csrf-" + UUID.randomUUID();
        JdbcTemplate jdbc = jdbc();
        jdbc.update("""
                insert into user_account(id, normalized_email, display_email, status, failed_login_count, version, created_at, updated_at)
                values (?, ?, ?, 'ACTIVE', 0, 0, now(), now())
                """, accountId, accountId + "@example.com", accountId + "@example.com");
        for (UUID roleId : roleIds) {
            jdbc.update("""
                    insert into account_role_assignment(id, account_id, role_id, department_id, effective_from, effective_to,
                        status, assigned_by_account_id, reason, version)
                    values (?, ?, ?, null, now() - interval '1 minute', null, 'ACTIVE', ?, 'Catalog test role', 0)
                    """, UUID.randomUUID(), accountId, roleId, accountId);
        }
        jdbc.update("""
                insert into account_session(id, account_id, session_token_hash, csrf_token_hash, status,
                    authenticated_at, last_seen_at, absolute_expires_at, version)
                values (?, ?, ?, ?, 'ACTIVE', now(), now(), now() + interval '1 hour', 0)
                """, sessionId, accountId, secretHasher.hash("SESSION", rawSession), secretHasher.hash("CSRF", csrfToken));
        return new AuthSession(accountId, sessionId, new MockCookie("MEDICORE_SESSION", rawSession), csrfToken);
    }

    private UUID createDepartment(AuthSession session, String code, String name) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/departments")
                        .cookie(session.cookie())
                        .header("X-CSRF-Token", session.csrfToken())
                        .header("Idempotency-Key", "department-%s".formatted(UUID.randomUUID()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(departmentBody(code, name)))
                .andExpect(status().isOk())
                .andReturn();
        return UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString()).path("id").asText());
    }

    private UUID createService(AuthSession session, String code) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/services")
                        .cookie(session.cookie())
                        .header("X-CSRF-Token", session.csrfToken())
                        .header("Idempotency-Key", "service-%s".formatted(UUID.randomUUID()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"%s","name":"%s service","serviceType":"CONSULTATION"}
                                """.formatted(code, code)))
                .andExpect(status().isOk())
                .andReturn();
        return UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString()).path("id").asText());
    }

    private UUID createServicePrice(AuthSession session, UUID serviceId, String amount, String effectiveFrom) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/services/%s/prices".formatted(serviceId))
                        .cookie(session.cookie())
                        .header("X-CSRF-Token", session.csrfToken())
                        .header("Idempotency-Key", "price-%s".formatted(UUID.randomUUID()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"amount":%s,"effectiveFrom":"%s"}
                                """.formatted(amount, effectiveFrom)))
                .andExpect(status().isOk())
                .andReturn();
        return UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString()).path("id").asText());
    }

    private UUID createPractitioner(AuthSession session, String staffCode, String fullName) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/practitioners")
                        .cookie(session.cookie())
                        .header("X-CSRF-Token", session.csrfToken())
                        .header("Idempotency-Key", "practitioner-%s".formatted(UUID.randomUUID()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"staffCode":"%s","fullName":"%s"}
                                """.formatted(staffCode, fullName)))
                .andExpect(status().isOk())
                .andReturn();
        return UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString()).path("id").asText());
    }

    private UUID assignRole(AuthSession session, UUID practitionerId, UUID departmentId, String effectiveFrom) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/practitioners/%s/roles".formatted(practitionerId))
                        .cookie(session.cookie())
                        .header("X-CSRF-Token", session.csrfToken())
                        .header("Idempotency-Key", "role-%s".formatted(UUID.randomUUID()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"departmentId":"%s","roleCode":"DOCTOR","effectiveFrom":"%s"}
                                """.formatted(departmentId, effectiveFrom)))
                .andExpect(status().isOk())
                .andReturn();
        return UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString()).path("id").asText());
    }

    private JsonNode page(AuthSession session, String path) throws Exception {
        MvcResult result = mockMvc.perform(get(path).cookie(session.cookie()))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    private static List<String> itemIds(JsonNode page) {
        List<String> ids = new ArrayList<>();
        page.path("items").forEach(item -> ids.add(item.path("id").asText()));
        return ids;
    }

    private static String departmentBody(String code, String name) {
        return """
                {"code":"%s","name":"%s","effectiveFrom":"2030-01-01T00:00:00Z"}
                """.formatted(code, name);
    }

    private JdbcTemplate jdbc() {
        return new JdbcTemplate(dataSource);
    }

    private record AuthSession(UUID accountId, UUID sessionId, MockCookie cookie, String csrfToken) {
    }
}
