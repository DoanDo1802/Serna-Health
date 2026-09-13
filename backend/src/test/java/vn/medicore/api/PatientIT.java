package vn.medicore.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
class PatientIT {

    private static final String TAB_CONTEXT = "TabContextHashValue001";

    private static final UUID PATIENT_ADMINISTRATOR_ROLE_ID = UUID.fromString("01980000-0000-7000-8000-000000000005");

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17.10");

    @Autowired MockMvc mockMvc;
    @Autowired DataSource dataSource;
    @Autowired SecretHasher secretHasher;
    @Autowired ObjectMapper objectMapper;

    @Test
    void patientCreateRequiresCsrfBeforeIdempotencyReservation() throws Exception {
        AuthSession administrator = patientAdministrator();
        mockMvc.perform(post("/api/v1/patients")
                        .cookie(administrator.cookie()).header("X-MediCore-Tab-Context", administrator.context())
                        .header("Idempotency-Key", "patient-csrf-key")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(patientBody("CSRF Patient", "1990-01-01", null, null)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        assertThat(jdbc().queryForObject("select count(*) from idempotency_record where idempotency_key = 'patient-csrf-key'", Integer.class))
                .isZero();
    }

    @Test
    void listsCurrentAccountsPatientLinksFromLiteralRoute() throws Exception {
        AuthSession session = session(Set.of());
        MvcResult created = mockMvc.perform(post("/api/v1/patients/self")
                        .cookie(session.cookie()).header("X-MediCore-Tab-Context", session.context())
                        .header("X-CSRF-Token", session.csrfToken())
                        .header("Idempotency-Key", "patient-self-link-key")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(patientBody("Own Patient", "1990-01-01", null, null)))
                .andExpect(status().isOk())
                .andReturn();
        UUID patientId = UUID.fromString(objectMapper.readTree(created.getResponse().getContentAsString()).path("id").asText());

        mockMvc.perform(get("/api/v1/patients/account-links").cookie(session.cookie()).header("X-MediCore-Tab-Context", session.context()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].accountId").value(session.accountId().toString()))
                .andExpect(jsonPath("$[0].patientId").value(patientId.toString()))
                .andExpect(jsonPath("$[0].relationship").value("OWN"))
                .andExpect(jsonPath("$[0].verificationTier").value("PENDING"))
                .andExpect(jsonPath("$[0].status").value("ACTIVE"));

        mockMvc.perform(get("/api/v1/patients/%s".formatted(patientId)).cookie(session.cookie()).header("X-MediCore-Tab-Context", session.context()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(patientId.toString()));
        mockMvc.perform(get("/api/v1/patients/%s/identifiers".formatted(patientId)).cookie(session.cookie()).header("X-MediCore-Tab-Context", session.context()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray());

        AuthSession unrelated = session(Set.of());
        mockMvc.perform(get("/api/v1/patients/%s".formatted(patientId)).cookie(unrelated.cookie()).header("X-MediCore-Tab-Context", unrelated.context()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        mockMvc.perform(get("/api/v1/patients/%s/identifiers".formatted(patientId)).cookie(unrelated.cookie()).header("X-MediCore-Tab-Context", unrelated.context()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));

        AuthSession administrator = patientAdministrator();
        mockMvc.perform(get("/api/v1/patients/%s".formatted(patientId)).cookie(administrator.cookie()).header("X-MediCore-Tab-Context", administrator.context()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(patientId.toString()));

        mockMvc.perform(get("/api/v1/patients/account-links"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void createOwnPatientAcceptsVersionedEmergencyContactAndRejectsInvalidContact() throws Exception {
        AuthSession validSession = session(Set.of());
        MvcResult created = mockMvc.perform(post("/api/v1/patients/self")
                        .cookie(validSession.cookie()).header("X-MediCore-Tab-Context", validSession.context())
                        .header("X-CSRF-Token", validSession.csrfToken())
                        .header("Idempotency-Key", "patient-self-contact-valid")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fullName":"Own Contact Patient","dateOfBirth":"1990-01-01",
                                "emergencyContact":{"version":1,"fullName":"Nguyen Van B","phone":"0901234567","relationship":"SPOUSE"}}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.emergencyContact.version").value(1))
                .andExpect(jsonPath("$.emergencyContact.fullName").value("Nguyen Van B"))
                .andExpect(jsonPath("$.emergencyContact.phone").value("0901234567"))
                .andExpect(jsonPath("$.emergencyContact.relationship").value("SPOUSE"))
                .andReturn();
        UUID patientId = UUID.fromString(objectMapper.readTree(created.getResponse().getContentAsString()).path("id").asText());
        assertThat(jdbc().queryForObject("""
                select count(*) from patient_account_link
                where account_id = ? and patient_id = ? and relationship = 'OWN' and status = 'ACTIVE'
                """, Integer.class, validSession.accountId(), patientId)).isEqualTo(1);

        AuthSession invalidSession = session(Set.of());
        mockMvc.perform(post("/api/v1/patients/self")
                        .cookie(invalidSession.cookie()).header("X-MediCore-Tab-Context", invalidSession.context())
                        .header("X-CSRF-Token", invalidSession.csrfToken())
                        .header("Idempotency-Key", "patient-self-contact-invalid")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fullName":"Invalid Contact Patient","dateOfBirth":"1990-01-01",
                                "emergencyContact":{"fullName":"Nguyen Van B","phone":"0901234567","relationship":"SPOUSE"}}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_INVALID_REQUEST"))
                .andExpect(jsonPath("$.detail").value("Emergency contact is invalid"));
    }

    @Test
    void patientCreateReplaysAndAuditsRealTraceContext() throws Exception {
        AuthSession administrator = patientAdministrator();
        String key = "patient-replay-key";
        String body = patientBody("Trace Patient", "1990-01-01", "0901234567", "trace@example.com");
        MvcResult first = mockMvc.perform(post("/api/v1/patients")
                        .cookie(administrator.cookie()).header("X-MediCore-Tab-Context", administrator.context())
                        .header("X-CSRF-Token", administrator.csrfToken())
                        .header("X-Request-Id", "patient-request")
                        .header("X-Correlation-Id", "patient-correlation")
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(header().string("ETag", "\"0\""))
                .andReturn();
        UUID patientId = UUID.fromString(objectMapper.readTree(first.getResponse().getContentAsString()).path("id").asText());
        String firstBody = first.getResponse().getContentAsString();

        mockMvc.perform(post("/api/v1/patients")
                        .cookie(administrator.cookie()).header("X-MediCore-Tab-Context", administrator.context())
                        .header("X-CSRF-Token", administrator.csrfToken())
                        .header("X-Request-Id", "other-request")
                        .header("X-Correlation-Id", "other-correlation")
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Request-Id", "patient-request"))
                .andExpect(result -> assertThat(result.getResponse().getContentAsString()).isEqualTo(firstBody));

        Map<String, Object> audit = jdbc().queryForMap("""
                select actor_account_id, patient_id, resource_id, resource_version, session_id, request_id, correlation_id, reason
                from audit_event where resource_id = ? and action = 'patient.create'
                """, patientId);
        assertThat(audit).containsEntry("actor_account_id", administrator.accountId())
                .containsEntry("patient_id", patientId).containsEntry("resource_id", patientId)
                .containsEntry("resource_version", 0L).containsEntry("session_id", administrator.sessionId().toString())
                .containsEntry("request_id", "patient-request").containsEntry("correlation_id", "patient-correlation")
                .containsEntry("reason", "created");
    }

    @Test
    void duplicateReviewUsesCanonicalPermissionAndRetainsPatients() throws Exception {
        AuthSession administrator = patientAdministrator();
        UUID firstPatientId = createPatient(administrator, "Duplicate Person", "1990-01-01", "0901888999", "one@example.com");
        UUID secondPatientId = createPatient(administrator, "Duplicate Person", "1990-01-01", "0901888999", "two@example.com");
        JsonNode page = body(get("/api/v1/patient-duplicate-candidates?status=PENDING").cookie(administrator.cookie()).header("X-MediCore-Tab-Context", administrator.context()));
        JsonNode candidate = null;
        for (JsonNode value : page.path("items")) {
            if (value.path("sourcePatientId").asText().equals(firstPatientId.toString())
                    && value.path("candidatePatientId").asText().equals(secondPatientId.toString())
                    || value.path("sourcePatientId").asText().equals(secondPatientId.toString())
                    && value.path("candidatePatientId").asText().equals(firstPatientId.toString())) {
                candidate = value;
                break;
            }
        }
        assertThat(candidate).isNotNull();
        UUID candidateId = UUID.fromString(candidate.path("id").asText());
        mockMvc.perform(post("/api/v1/patient-duplicate-candidates/%s/actions/review".formatted(candidateId))
                        .cookie(administrator.cookie()).header("X-MediCore-Tab-Context", administrator.context())
                        .header("X-CSRF-Token", administrator.csrfToken())
                        .header("If-Match", "\"0\"")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"REJECTED\",\"reviewReason\":\"Not same person\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"));
        assertThat(jdbc().queryForObject("select count(*) from patient where id in (?, ?)", Integer.class, firstPatientId, secondPatientId))
                .isEqualTo(2);
        assertThat(jdbc().queryForObject("select reason from audit_event where resource_id = ? and action = 'patient_duplicate.review'",
                String.class, candidateId)).isEqualTo("reviewed");
    }

    @Test
    void identifierStoresCiphertextAndReturnsSuffixOnly() throws Exception {
        AuthSession administrator = patientAdministrator();
        UUID patientId = createPatient(administrator, "Identifier Patient", "1991-01-01", null, null);
        MvcResult result = mockMvc.perform(post("/api/v1/patients/%s/identifiers".formatted(patientId))
                        .cookie(administrator.cookie()).header("X-MediCore-Tab-Context", administrator.context())
                        .header("X-CSRF-Token", administrator.csrfToken())
                        .header("Idempotency-Key", "patient-identifier-key")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"identifierType\":\"CCCD\",\"issuer\":\"VN\",\"jurisdiction\":\"VN\",\"value\":\"001234567890\",\"verificationSource\":\"STAFF_RECORDED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displaySuffix").value("7890"))
                .andExpect(jsonPath("$.value").doesNotExist())
                .andReturn();
        UUID identifierId = UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString()).path("id").asText());
        Map<String, Object> row = jdbc().queryForMap("select protected_value, comparison_token from patient_identifier where id = ?", identifierId);
        assertThat(row.get("protected_value").toString()).doesNotContain("001234567890");
        assertThat(row.get("comparison_token").toString()).doesNotContain("001234567890");
    }

    private UUID createPatient(AuthSession session, String name, String dob, String phone, String email) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/patients")
                        .cookie(session.cookie()).header("X-MediCore-Tab-Context", session.context())
                        .header("X-CSRF-Token", session.csrfToken())
                        .header("Idempotency-Key", "patient-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(patientBody(name, dob, phone, email)))
                .andExpect(status().isOk()).andReturn();
        return UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString()).path("id").asText());
    }

    private JsonNode body(org.springframework.test.web.servlet.RequestBuilder request) throws Exception {
        MvcResult result = mockMvc.perform(request).andExpect(status().isOk()).andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private AuthSession patientAdministrator() {
        return session(Set.of(PATIENT_ADMINISTRATOR_ROLE_ID));
    }

    private AuthSession session(Set<UUID> roleIds) {
        UUID accountId = UUID.randomUUID();
        UUID sessionId = UUID.randomUUID();
        String rawSession = "session-" + UUID.randomUUID();
        String csrfToken = "csrf-" + UUID.randomUUID();
        jdbc().update("""
                insert into user_account(id, normalized_email, display_email, status, failed_login_count, version, created_at, updated_at)
                values (?, ?, ?, 'ACTIVE', 0, 0, now(), now())
                """, accountId, accountId + "@example.com", accountId + "@example.com");
        for (UUID roleId : roleIds) {
            jdbc().update("""
                    insert into account_role_assignment(id, account_id, role_id, department_id, effective_from, effective_to,
                        status, assigned_by_account_id, reason, version)
                    values (?, ?, ?, null, now() - interval '1 minute', null, 'ACTIVE', ?, 'Patient test role', 0)
                    """, UUID.randomUUID(), accountId, roleId, accountId);
        }
        jdbc().update("""
                insert into account_session(id, account_id, session_token_hash, csrf_token_hash, tab_context_hash, status,
                    authenticated_at, last_seen_at, absolute_expires_at, version)
                values (?, ?, ?, ?, ?, 'ACTIVE', now(), now(), now() + interval '1 hour', 0)
                """, sessionId, accountId, secretHasher.hash("SESSION", rawSession), secretHasher.hash("CSRF", csrfToken),
                secretHasher.hash("SESSION_CONTEXT", TAB_CONTEXT));
        return new AuthSession(accountId, sessionId, new MockCookie("MEDICORE_SESSION_" + TAB_CONTEXT, rawSession), csrfToken, TAB_CONTEXT);
    }

    private static String patientBody(String fullName, String dateOfBirth, String phone, String email) {
        return """
                {"fullName":"%s","dateOfBirth":"%s","phone":%s,"email":%s}
                """.formatted(fullName, dateOfBirth, nullableJson(phone), nullableJson(email));
    }

    private static String nullableJson(String value) {
        return value == null ? "null" : "\"%s\"".formatted(value);
    }

    private JdbcTemplate jdbc() {
        return new JdbcTemplate(dataSource);
    }

    private record AuthSession(UUID accountId, UUID sessionId, MockCookie cookie, String csrfToken, String context) {
    }
}
