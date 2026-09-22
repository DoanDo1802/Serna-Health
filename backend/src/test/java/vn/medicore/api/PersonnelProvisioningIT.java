package vn.medicore.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
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
class PersonnelProvisioningIT {

    private static final String TAB_CONTEXT = "CCCCCCCCCCCCCCCCCCCCCC";
    private static final String SESSION_COOKIE = "MEDICORE_SESSION_" + TAB_CONTEXT;

    private static final UUID IDENTITY_ADMINISTRATOR_ROLE_ID = UUID.fromString("01980000-0000-7000-8000-000000000001");
    private static final UUID DOCTOR_ROLE_ID = UUID.fromString("01980000-0000-7000-8000-000000000003");
    private static final UUID RECEPTIONIST_ROLE_ID = UUID.fromString("01980000-0000-7000-8000-000000000006");

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
    void provisionDoctorIsAtomicIdempotentAndDoesNotExposePassword() throws Exception {
        AuthSession administrator = administrator();
        UUID departmentId = department("PERSONNEL-DOCTOR");
        String password = "safe-initial-password-123";
        String body = doctorBody("doctor.personnel@example.com", password, "DOC-PROVISION-1", "Doctor Provision", departmentId);

        MvcResult first = mockMvc.perform(post("/api/v1/admin/personnel")
                        .header("X-MediCore-Tab-Context", TAB_CONTEXT)
                        .cookie(administrator.cookie())
                        .header("X-CSRF-Token", administrator.csrfToken())
                        .header("X-Request-Id", "personnel-doctor-request")
                        .header("X-Correlation-Id", "personnel-doctor-correlation")
                        .header("Idempotency-Key", "personnel-doctor-create-key")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(header().string("ETag", "\"0\""))
                .andExpect(jsonPath("$.type").value("DOCTOR"))
                .andExpect(jsonPath("$.departmentId").value(departmentId.toString()))
                .andExpect(jsonPath("$.doctorProfile.phone").value("+84912345678"))
                .andReturn();

        String response = first.getResponse().getContentAsString();
        assertThat(response).doesNotContain(password).doesNotContain("initialPassword").doesNotContain("encodedHash");
        UUID accountId = UUID.fromString(objectMapper.readTree(response).path("accountId").asText());
        JdbcTemplate jdbc = jdbc();
        assertThat(jdbc.queryForObject("select status from user_account where id = ?", String.class, accountId)).isEqualTo("ACTIVE");
        assertThat(jdbc.queryForObject("select email_verified_at from user_account where id = ?", Object.class, accountId)).isNull();
        assertThat(jdbc.queryForObject("select encoded_hash from password_credential where account_id = ?", String.class, accountId))
                .startsWith("$argon2").doesNotContain(password);
        assertThat(jdbc.queryForObject("select count(*) from practitioner where user_account_id = ?", Integer.class, accountId)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from practitioner_profile pp join practitioner p on p.id = pp.practitioner_id where p.user_account_id = ?", Integer.class, accountId)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select pp.phone from practitioner_profile pp join practitioner p on p.id = pp.practitioner_id where p.user_account_id = ?", String.class, accountId))
                .isEqualTo("+84912345678");
        assertThat(jdbc.queryForObject("select count(*) from practitioner_role pr join practitioner p on p.id = pr.practitioner_id where p.user_account_id = ? and pr.role_code = 'DOCTOR' and pr.status = 'ACTIVE'", Integer.class, accountId)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from account_role_assignment where account_id = ? and role_id = ? and status = 'ACTIVE'", Integer.class, accountId, DOCTOR_ROLE_ID)).isEqualTo(1);

        mockMvc.perform(post("/api/v1/admin/personnel")
                        .header("X-MediCore-Tab-Context", TAB_CONTEXT)
                        .cookie(administrator.cookie())
                        .header("X-CSRF-Token", administrator.csrfToken())
                        .header("Idempotency-Key", "personnel-doctor-create-key")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentAsString()).isEqualTo(response));
        assertThat(jdbc.queryForObject("select count(*) from user_account where normalized_email = 'doctor.personnel@example.com'", Integer.class)).isEqualTo(1);

        mockMvc.perform(post("/api/v1/admin/personnel")
                        .header("X-MediCore-Tab-Context", TAB_CONTEXT)
                        .cookie(administrator.cookie())
                        .header("X-CSRF-Token", administrator.csrfToken())
                        .header("Idempotency-Key", "personnel-doctor-create-key")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body.replace("Doctor Provision", "Different Doctor")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("IDEMPOTENCY_KEY_REUSED"));
    }

    @Test
    void duplicateDoctorLicenseRollsBackEntireProvision() throws Exception {
        AuthSession administrator = administrator();
        UUID departmentId = department("PERSONNEL-LICENSE");
        String first = doctorBody("licensed.one@example.com", "safe-initial-password-123", "DOC-LICENSE-1", "Licensed One", departmentId);
        mockMvc.perform(post("/api/v1/admin/personnel")
                        .header("X-MediCore-Tab-Context", TAB_CONTEXT)
                        .cookie(administrator.cookie())
                        .header("X-CSRF-Token", administrator.csrfToken())
                        .header("Idempotency-Key", "personnel-license-first-key")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(first))
                .andExpect(status().isOk());

        String duplicateLicense = doctorBody("licensed.two@example.com", "safe-initial-password-123", "DOC-LICENSE-2", "Licensed Two", departmentId)
                .replace("LICENSE-DOC-LICENSE-2", "LICENSE-DOC-LICENSE-1");
        mockMvc.perform(post("/api/v1/admin/personnel")
                        .header("X-MediCore-Tab-Context", TAB_CONTEXT)
                        .cookie(administrator.cookie())
                        .header("X-CSRF-Token", administrator.csrfToken())
                        .header("Idempotency-Key", "personnel-license-duplicate-key")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(duplicateLicense))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STATE_CONFLICT"));

        assertThat(jdbc().queryForObject("select count(*) from user_account where normalized_email = 'licensed.two@example.com'", Integer.class))
                .isZero();
        assertThat(jdbc().queryForObject("select count(*) from practitioner where staff_code = 'DOC-LICENSE-2'", Integer.class))
                .isZero();
    }

    @Test
    void staffProvisionMapsToReceptionistAndDeactivateRevokesAccess() throws Exception {
        AuthSession administrator = administrator();
        String password = "safe-initial-password-123";
        String body = staffBody("staff.personnel@example.com", password, "STAFF-PROVISION-1", "Staff Provision");
        MvcResult created = mockMvc.perform(post("/api/v1/admin/personnel")
                        .header("X-MediCore-Tab-Context", TAB_CONTEXT)
                        .cookie(administrator.cookie())
                        .header("X-CSRF-Token", administrator.csrfToken())
                        .header("Idempotency-Key", "personnel-staff-create-key")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(header().string("ETag", "\"0\""))
                .andExpect(jsonPath("$.type").value("STAFF"))
                .andReturn();
        UUID accountId = UUID.fromString(objectMapper.readTree(created.getResponse().getContentAsString()).path("accountId").asText());
        assertThat(jdbc().queryForObject("select count(*) from personnel_member where account_id = ?", Integer.class, accountId)).isEqualTo(1);
        assertThat(jdbc().queryForObject("select count(*) from account_role_assignment where account_id = ? and role_id = ? and status = 'ACTIVE'", Integer.class, accountId, RECEPTIONIST_ROLE_ID)).isEqualTo(1);
        assertThat(jdbc().queryForObject("select count(*) from practitioner where user_account_id = ?", Integer.class, accountId)).isZero();

        String updateBody = staffUpdateBody("STAFF-PROVISION-UPDATED", "Updated Staff Provision");
        mockMvc.perform(patch("/api/v1/admin/personnel/%s".formatted(accountId))
                        .header("X-MediCore-Tab-Context", TAB_CONTEXT)
                        .cookie(administrator.cookie())
                        .header("X-CSRF-Token", administrator.csrfToken())
                        .header("If-Match", "\"0\"")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody))
                .andExpect(status().isOk())
                .andExpect(header().string("ETag", "\"1\""))
                .andExpect(jsonPath("$.staffCode").value("STAFF-PROVISION-UPDATED"));

        mockMvc.perform(patch("/api/v1/admin/personnel/%s".formatted(accountId))
                        .header("X-MediCore-Tab-Context", TAB_CONTEXT)
                        .cookie(administrator.cookie())
                        .header("X-CSRF-Token", administrator.csrfToken())
                        .header("If-Match", "\"0\"")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody))
                .andExpect(status().isPreconditionFailed())
                .andExpect(jsonPath("$.code").value("CONCURRENCY_STALE_VERSION"));

        mockMvc.perform(post("/api/v1/admin/personnel/%s/actions/deactivate".formatted(accountId))
                        .header("X-MediCore-Tab-Context", TAB_CONTEXT)
                        .cookie(administrator.cookie())
                        .header("X-CSRF-Token", administrator.csrfToken())
                        .header("Idempotency-Key", "personnel-staff-deactivate-key")
                        .header("If-Match", "\"1\"")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"No longer employed\"}"))
                .andExpect(status().isOk())
                .andExpect(header().string("ETag", "\"2\""))
                .andExpect(jsonPath("$.active").value(false));
        assertThat(jdbc().queryForObject("select status from user_account where id = ?", String.class, accountId)).isEqualTo("DISABLED");
        assertThat(jdbc().queryForObject("select count(*) from password_credential where account_id = ? and status = 'ACTIVE'", Integer.class, accountId)).isZero();
        assertThat(jdbc().queryForObject("select count(*) from account_role_assignment where account_id = ? and status = 'ACTIVE'", Integer.class, accountId)).isZero();

        mockMvc.perform(get("/api/v1/admin/personnel/%s".formatted(accountId)).header("X-MediCore-Tab-Context", TAB_CONTEXT)
                        .cookie(administrator.cookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));

        mockMvc.perform(post("/api/v1/auth/password-sessions")
                        .header("X-MediCore-Tab-Context", TAB_CONTEXT)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"staff.personnel@example.com\",\"password\":\"%s\"}".formatted(password)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_FAILED"));
    }

    @Test
    void personnelEndpointsRequireSessionCsrfAndRejectInvalidDoctorProfileBeforeWrites() throws Exception {
        UUID departmentId = department("PERSONNEL-VALIDATE");
        String body = doctorBody("invalid.personnel@example.com", "safe-initial-password-123", "DOC-INVALID-1", "Invalid Doctor", departmentId)
                .replace("+84912345678", "+849");

        mockMvc.perform(post("/api/v1/admin/personnel")
                        .header("Idempotency-Key", "personnel-unauthorized-key")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isUnauthorized());

        AuthSession administrator = administrator();
        mockMvc.perform(post("/api/v1/admin/personnel")
                        .header("X-MediCore-Tab-Context", TAB_CONTEXT)
                        .cookie(administrator.cookie())
                        .header("Idempotency-Key", "personnel-csrf-key")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/admin/personnel")
                        .header("X-MediCore-Tab-Context", TAB_CONTEXT)
                        .cookie(administrator.cookie())
                        .header("X-CSRF-Token", administrator.csrfToken())
                        .header("Idempotency-Key", "personnel-invalid-profile-key")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_INVALID_REQUEST"));
        assertThat(jdbc().queryForObject("select count(*) from user_account where normalized_email = 'invalid.personnel@example.com'", Integer.class)).isZero();
    }

    private AuthSession administrator() {
        UUID accountId = UUID.randomUUID();
        UUID sessionId = UUID.randomUUID();
        String rawSession = "personnel-session-" + UUID.randomUUID();
        String csrfToken = "personnel-csrf-" + UUID.randomUUID();
        JdbcTemplate jdbc = jdbc();
        jdbc.update("""
                insert into user_account(id, normalized_email, display_email, status, failed_login_count, version, created_at, updated_at)
                values (?, ?, ?, 'ACTIVE', 0, 0, now(), now())
                """, accountId, accountId + "@example.com", accountId + "@example.com");
        jdbc.update("""
                insert into account_role_assignment(id, account_id, role_id, department_id, effective_from, effective_to,
                    status, assigned_by_account_id, reason, version)
                values (?, ?, ?, null, now() - interval '1 minute', null, 'ACTIVE', ?, 'Personnel test administrator', 0)
                """, UUID.randomUUID(), accountId, IDENTITY_ADMINISTRATOR_ROLE_ID, accountId);
        jdbc.update("""
                insert into account_session(id, account_id, session_token_hash, csrf_token_hash, tab_context_hash, status,
                    authenticated_at, last_seen_at, absolute_expires_at, version)
                values (?, ?, ?, ?, ?, 'ACTIVE', now(), now(), now() + interval '1 hour', 0)
                """, sessionId, accountId, secretHasher.hash("SESSION", rawSession), secretHasher.hash("CSRF", csrfToken),
                secretHasher.hash("SESSION_CONTEXT", TAB_CONTEXT));
        return new AuthSession(new MockCookie(SESSION_COOKIE, rawSession), csrfToken);
    }

    private UUID department(String code) {
        UUID id = UUID.randomUUID();
        jdbc().update("""
                insert into department(id, code, name, active, effective_from, version, created_at, updated_at)
                values (?, ?, ?, true, now() - interval '1 minute', 0, now(), now())
                """, id, code, code + " Department");
        return id;
    }

    private static String doctorBody(String email, String password, String staffCode, String fullName, UUID departmentId) {
        return """
                {"type":"DOCTOR","email":"%s","initialPassword":"%s","staffCode":"%s","fullName":"%s",
                 "departmentId":"%s","doctorProfile":{"phone":"+84912345678","dateOfBirth":"1980-01-01",
                 "gender":"FEMALE","address":"1 Medical Street","professionalTitle":"Bác sĩ","academicDegree":"Thạc sĩ",
                 "specialtyDesignation":"Nội khoa","licenseNumber":"LICENSE-%s","licensingAuthority":"Ministry of Health",
                 "licenseIssuedOn":"2020-01-01","licenseExpiresOn":"2030-01-01","yearsExperience":10}}
                """.formatted(email, password, staffCode, fullName, departmentId, staffCode);
    }

    private static String staffBody(String email, String password, String staffCode, String fullName) {
        return """
                {"type":"STAFF","email":"%s","initialPassword":"%s","staffCode":"%s","fullName":"%s"}
                """.formatted(email, password, staffCode, fullName);
    }

    private static String staffUpdateBody(String staffCode, String fullName) {
        return """
                {"type":"STAFF","staffCode":"%s","fullName":"%s"}
                """.formatted(staffCode, fullName);
    }

    private JdbcTemplate jdbc() {
        return new JdbcTemplate(dataSource);
    }

    private record AuthSession(MockCookie cookie, String csrfToken) {
    }
}
