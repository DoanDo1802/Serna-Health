package vn.medicore.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
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
class ReceptionClinicalIT {

    private static final String TAB_CONTEXT = "ctx-123456789012345678";
    private static final String SESSION_COOKIE = "MEDICORE_SESSION";

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17.10");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private SecretHasher secretHasher;

    private AuthSession doctorSession;
    private UUID practitionerRoleId;
    private UUID departmentId;
    private UUID patientId;
    private UUID appointmentId;

    private record AuthSession(UUID accountId, UUID sessionId, MockCookie cookie, String csrfToken) {
    }

    @BeforeEach
    void setupTestData() {
        UUID doctorRoleId = UUID.fromString("01980000-0000-7000-8000-000000000003");
        doctorSession = createSession(Set.of(doctorRoleId));

        departmentId = UUID.fromString("01980000-0000-7000-8000-000000000010");
        UUID practitionerId = UUID.randomUUID();
        practitionerRoleId = UUID.randomUUID();
        patientId = UUID.randomUUID();
        appointmentId = UUID.randomUUID();
        UUID slotId = UUID.randomUUID();
        UUID roomId = UUID.fromString("01980000-0000-7000-8000-000000000020");
        UUID serviceId = UUID.fromString("01980000-0000-7000-8000-000000000030");

        // Ensure department, room, service exist
        jdbc.update("""
            insert into department(id, code, name, active, effective_from, version, created_at, updated_at)
            values (?, 'TEST_DEPT', 'Department Test', true, now(), 0, now(), now())
            on conflict (id) do nothing
            """, departmentId);

        jdbc.update("""
            insert into room(id, department_id, code, name, active, version, created_at, updated_at)
            values (?, ?, 'R101', 'Room 101', true, 0, now(), now())
            on conflict (id) do nothing
            """, roomId, departmentId);

        jdbc.update("""
            insert into service(id, code, name, service_type, active, version, created_at, updated_at)
            values (?, 'KHAM_TQ', 'Kham Tong Quat', 'CONSULTATION', true, 0, now(), now())
            on conflict (id) do nothing
            """, serviceId);

        // Practitioner & role
        jdbc.update("""
            insert into practitioner (id, user_account_id, staff_code, full_name, active, created_at, updated_at)
            values (?, ?, ?, 'BS. Test Flow', true, now(), now())
            """, practitionerId, doctorSession.accountId(), "DOC-" + practitionerId.toString().substring(0, 8));

        jdbc.update("""
            insert into practitioner_role (id, practitioner_id, department_id, role_code, status, effective_from, created_at, updated_at)
            values (?, ?, ?, 'DOCTOR', 'ACTIVE', now(), now(), now())
            """, practitionerRoleId, practitionerId, departmentId);

        // Patient
        jdbc.update("""
            insert into patient (id, full_name, date_of_birth, declared_gender, phone, version, created_at, updated_at)
            values (?, 'Bệnh nhân Test', date '1990-01-01', 'MALE', '0901234567', 0, now(), now())
            """, patientId);

        UUID slotHoldId = UUID.randomUUID();
        // Slot, hold & appointment
        jdbc.update("""
            insert into appointment_slot (id, practitioner_role_id, department_id, room_id, service_id, session, start_at, end_at, capacity, status, created_at, updated_at)
            values (?, ?, ?, ?, ?, 'MORNING', now(), now() + interval '1 hour', 10, 'ACTIVE', now(), now())
            """, slotId, practitionerRoleId, departmentId, roomId, serviceId);

        jdbc.update("""
            insert into slot_hold (id, slot_id, patient_id, expires_at, deposit_amount, currency, status, version, created_at, updated_at)
            values (?, ?, ?, now() + interval '10 minutes', 0.00, 'VND', 'ACTIVE', 0, now(), now())
            """, slotHoldId, slotId, patientId);

        jdbc.update("""
            insert into appointment (id, patient_id, slot_hold_id, slot_id, status, version, created_at, updated_at)
            values (?, ?, ?, ?, 'CONFIRMED', 0, now(), now())
            """, appointmentId, patientId, slotHoldId, slotId);
    }

    private AuthSession createSession(Set<UUID> roleIds) {
        UUID accountId = UUID.randomUUID();
        UUID sessionId = UUID.randomUUID();
        String rawSession = "session-" + UUID.randomUUID();
        String csrfToken = "csrf-" + UUID.randomUUID();
        jdbc.update("""
                insert into user_account(id, normalized_email, display_email, status, failed_login_count, version, created_at, updated_at)
                values (?, ?, ?, 'ACTIVE', 0, 0, now(), now())
                """, accountId, accountId + "@example.com", accountId + "@example.com");
        for (UUID roleId : roleIds) {
            jdbc.update("""
                    insert into account_role_assignment(id, account_id, role_id, department_id, effective_from, effective_to,
                        status, assigned_by_account_id, reason, version)
                    values (?, ?, ?, null, now() - interval '1 minute', null, 'ACTIVE', ?, 'Test role', 0)
                    """, UUID.randomUUID(), accountId, roleId, accountId);
        }
        jdbc.update("""
                insert into account_session(id, account_id, session_token_hash, csrf_token_hash, tab_context_hash, status,
                    authenticated_at, last_seen_at, absolute_expires_at, version)
                values (?, ?, ?, ?, ?, 'ACTIVE', now(), now(), now() + interval '1 hour', 0)
                """, sessionId, accountId, secretHasher.hash("SESSION", rawSession), secretHasher.hash("CSRF", csrfToken),
                secretHasher.hash("SESSION_CONTEXT", TAB_CONTEXT));
        return new AuthSession(accountId, sessionId, new MockCookie("MEDICORE_SESSION_" + TAB_CONTEXT, rawSession), csrfToken);
    }

    @Test
    void completeDoctorVisitEncounterWorkflow() throws Exception {
        // Step 1: Check-in appointment -> creates Visit, Encounter, EncounterParticipant
        MvcResult checkInResult = mockMvc.perform(post("/api/v1/appointments/" + appointmentId + "/check-ins")
                .header("X-MediCore-Tab-Context", TAB_CONTEXT)
                .cookie(doctorSession.cookie())
                .header("X-CSRF-Token", doctorSession.csrfToken())
                .header("Idempotency-Key", "idemp-checkin-" + UUID.randomUUID())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    { "notes": "Bệnh nhân đã đến phòng khám" }
                    """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.appointmentId").value(appointmentId.toString()))
                .andReturn();

        JsonNode checkInJson = objectMapper.readTree(checkInResult.getResponse().getContentAsString());
        UUID visitId = UUID.fromString(checkInJson.path("visitId").asText());
        assertThat(visitId).isNotNull();

        // Check Visit is ARRIVED
        mockMvc.perform(get("/api/v1/visits/" + visitId)
                .header("X-MediCore-Tab-Context", TAB_CONTEXT)
                .cookie(doctorSession.cookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ARRIVED"));

        // List visit encounters
        MvcResult encountersResult = mockMvc.perform(get("/api/v1/visits/" + visitId + "/encounters")
                .header("X-MediCore-Tab-Context", TAB_CONTEXT)
                .cookie(doctorSession.cookie()))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode encountersJson = objectMapper.readTree(encountersResult.getResponse().getContentAsString());
        assertThat(encountersJson.path("items")).hasSize(1);
        UUID encounterId = UUID.fromString(encountersJson.path("items").get(0).path("id").asText());
        long encounterVersion = encountersJson.path("items").get(0).path("version").asLong();
        assertThat(encountersJson.path("items").get(0).path("status").asText()).isEqualTo("PLANNED");

        // Step 2: Start encounter (PLANNED -> IN_PROGRESS)
        MvcResult startResult = mockMvc.perform(post("/api/v1/encounters/" + encounterId + "/actions/start")
                .header("X-MediCore-Tab-Context", TAB_CONTEXT)
                .cookie(doctorSession.cookie())
                .header("X-CSRF-Token", doctorSession.csrfToken())
                .header("Idempotency-Key", "idemp-start-" + UUID.randomUUID())
                .header("If-Match", "\"" + encounterVersion + "\""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andReturn();

        JsonNode startJson = objectMapper.readTree(startResult.getResponse().getContentAsString());
        long inProgressVersion = startJson.path("version").asLong();

        // Step 3: Attempting to complete encounter before creating & finalizing note must fail
        mockMvc.perform(post("/api/v1/encounters/" + encounterId + "/actions/complete")
                .header("X-MediCore-Tab-Context", TAB_CONTEXT)
                .cookie(doctorSession.cookie())
                .header("X-CSRF-Token", doctorSession.csrfToken())
                .header("Idempotency-Key", "idemp-comp-fail-" + UUID.randomUUID())
                .header("If-Match", "\"" + inProgressVersion + "\""))
                .andExpect(status().isConflict());

        // Step 4: Create draft clinical note
        MvcResult noteResult = mockMvc.perform(post("/api/v1/encounters/" + encounterId + "/clinical-notes")
                .header("X-MediCore-Tab-Context", TAB_CONTEXT)
                .cookie(doctorSession.cookie())
                .header("X-CSRF-Token", doctorSession.csrfToken())
                .header("Idempotency-Key", "idemp-note-" + UUID.randomUUID())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                        "noteType": "EXAMINATION",
                        "contentSchemaVersion": "1.0",
                        "content": {
                            "symptoms": "Ho khan, sốt nhẹ",
                            "physicalExamination": "Họng đỏ nhẹ",
                            "mainDiagnosis": "Viêm họng cấp",
                            "icdCode": "J00"
                        }
                    }
                    """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.noteType").value("EXAMINATION"))
                .andReturn();

        JsonNode noteJson = objectMapper.readTree(noteResult.getResponse().getContentAsString());
        UUID versionId = UUID.fromString(noteJson.path("currentVersion").path("id").asText());
        long noteVersion = noteJson.path("currentVersion").path("version").asLong();

        // Step 5: Update draft clinical note
        MvcResult updateResult = mockMvc.perform(patch("/api/v1/clinical-note-versions/" + versionId)
                .header("X-MediCore-Tab-Context", TAB_CONTEXT)
                .cookie(doctorSession.cookie())
                .header("X-CSRF-Token", doctorSession.csrfToken())
                .header("If-Match", "\"" + noteVersion + "\"")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                        "contentSchemaVersion": "1.0",
                        "content": {
                            "symptoms": "Ho khan, sốt nhẹ, mệt mỏi",
                            "physicalExamination": "Họng đỏ nhẹ, amidan không sưng",
                            "mainDiagnosis": "Viêm họng cấp",
                            "icdCode": "J00",
                            "treatment": "Nghỉ ngơi, uống nhiều nước"
                        }
                    }
                    """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andReturn();

        JsonNode updatedJson = objectMapper.readTree(updateResult.getResponse().getContentAsString());
        long updatedNoteVersion = updatedJson.path("version").asLong();

        // Step 6: Finalize clinical note version
        mockMvc.perform(post("/api/v1/clinical-note-versions/" + versionId + "/actions/finalize")
                .header("X-MediCore-Tab-Context", TAB_CONTEXT)
                .cookie(doctorSession.cookie())
                .header("X-CSRF-Token", doctorSession.csrfToken())
                .header("Idempotency-Key", "idemp-finalize-" + UUID.randomUUID())
                .header("If-Match", "\"" + updatedNoteVersion + "\""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("FINALIZED"));

        // Step 7: Now complete encounter -> succeeds
        mockMvc.perform(post("/api/v1/encounters/" + encounterId + "/actions/complete")
                .header("X-MediCore-Tab-Context", TAB_CONTEXT)
                .cookie(doctorSession.cookie())
                .header("X-CSRF-Token", doctorSession.csrfToken())
                .header("Idempotency-Key", "idemp-complete-" + UUID.randomUUID())
                .header("If-Match", "\"" + inProgressVersion + "\""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"));

        // Step 8: Verify patient clinical history persists
        mockMvc.perform(get("/api/v1/patients/" + patientId + "/clinical-notes")
                .header("X-MediCore-Tab-Context", TAB_CONTEXT)
                .cookie(doctorSession.cookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.items[0].status").value("FINALIZED"))
                .andExpect(jsonPath("$.items[0].currentVersion.content.mainDiagnosis").value("Viêm họng cấp"));
    }
}
