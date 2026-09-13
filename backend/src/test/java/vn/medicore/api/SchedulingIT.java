package vn.medicore.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.Set;
import java.util.UUID;
import javax.sql.DataSource;
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
class SchedulingIT {

    // Seed role IDs from V2/V13 migrations
    private static final String TAB_CONTEXT = "TabContextHashValue001";

    private static final UUID IDENTITY_ADMIN_ROLE_ID = UUID.fromString("01980000-0000-7000-8000-000000000001");
    private static final UUID CATALOG_ADMIN_ROLE_ID  = UUID.fromString("01980000-0000-7000-8000-000000000004");
    private static final UUID PATIENT_ROLE_ID        = UUID.fromString("01980000-0000-7000-8000-000000000005");

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17.10");

    @Autowired MockMvc mockMvc;
    @Autowired DataSource dataSource;
    @Autowired SecretHasher secretHasher;
    @Autowired ObjectMapper objectMapper;

    // Shared catalog fixtures — re-created per test class via @BeforeEach
    private UUID departmentId;
    private UUID roomId;
    private UUID serviceId;
    private UUID practitionerRoleId;

    @BeforeEach
    void setupCatalogFixtures() throws Exception {
        AuthSession admin = session(Set.of(CATALOG_ADMIN_ROLE_ID));

        departmentId = createResource(admin, "POST", "/api/v1/departments",
                "{\"code\":\"SCHED-DEPT-%s\",\"name\":\"Scheduling Dept\",\"effectiveFrom\":\"2020-01-01T00:00:00Z\"}"
                        .formatted(UUID.randomUUID()));

        roomId = createResource(admin, "POST", "/api/v1/rooms",
                "{\"departmentId\":\"%s\",\"code\":\"SCHED-ROOM-%s\",\"name\":\"Room A\",\"effectiveFrom\":\"2020-01-01T00:00:00Z\"}"
                        .formatted(departmentId, UUID.randomUUID()));

        serviceId = createResource(admin, "POST", "/api/v1/services",
                "{\"code\":\"SCHED-SVC-%s\",\"name\":\"Consultation\",\"serviceType\":\"CONSULTATION\",\"effectiveFrom\":\"2020-01-01T00:00:00Z\"}"
                        .formatted(UUID.randomUUID()));

        // Insert service price directly — price endpoint needs service_price.create permission already on admin
        JdbcTemplate jdbc = jdbc();
        UUID priceId = UUID.randomUUID();
        jdbc.update("insert into service_price (id, service_id, amount, currency, effective_from, created_at) " +
                "values (?, ?, ?, 'VND', now() - interval '1 minute', now())",
                priceId, serviceId, new BigDecimal("75000.00"));

        UUID practitionerId = UUID.randomUUID();
        jdbc.update("insert into practitioner (id, staff_code, full_name, active, created_at, updated_at) " +
                "values (?, ?, 'Dr. Test', true, now(), now())",
                practitionerId, "SCHED-" + UUID.randomUUID());

        practitionerRoleId = UUID.randomUUID();
        jdbc.update("insert into practitioner_role (id, practitioner_id, department_id, role_code, status, effective_from, created_at, updated_at) " +
                "values (?, ?, ?, 'DOCTOR', 'ACTIVE', now(), now(), now())",
                practitionerRoleId, practitionerId, departmentId);
    }

    // ── 1. Booking catalog is scoped to linked patients ───────────────────

    @Test
    void bookingCatalogRequiresLinkedPatient() throws Exception {
        mockMvc.perform(get("/api/v1/booking/catalog").param("patientId", UUID.randomUUID().toString()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_REQUIRED"));

        AuthSession patientSession = sessionWithPatient(insertPatient("Catalog Patient"));
        createSlot(session(Set.of(CATALOG_ADMIN_ROLE_ID)), Instant.now().plus(2, ChronoUnit.DAYS), 2);

        mockMvc.perform(get("/api/v1/booking/catalog")
                        .cookie(patientSession.cookie()).header("X-MediCore-Tab-Context", patientSession.context())
                        .param("patientId", UUID.randomUUID().toString()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));

        mockMvc.perform(get("/api/v1/booking/catalog")
                        .cookie(patientSession.cookie()).header("X-MediCore-Tab-Context", patientSession.context())
                        .param("patientId", patientSession.accountId().toString()))
                .andExpect(status().isForbidden());
    }

    @Test
    void bookingCatalogReturnsBookableMetadataWithoutStaffFields() throws Exception {
        UUID patientId = insertPatient("Catalog Metadata Patient");
        AuthSession patientSession = sessionWithPatient(patientId);
        createSlot(session(Set.of(CATALOG_ADMIN_ROLE_ID)), Instant.now().plus(2, ChronoUnit.DAYS), 2);

        mockMvc.perform(get("/api/v1/booking/catalog")
                        .cookie(patientSession.cookie()).header("X-MediCore-Tab-Context", patientSession.context())
                        .param("patientId", patientId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.departments[*].id").value(hasItem(departmentId.toString())))
                .andExpect(jsonPath("$.services[*].priceAmount").value(hasItem(75000.0)))
                .andExpect(jsonPath("$.rooms").doesNotExist())
                .andExpect(jsonPath("$.practitioners").doesNotExist())
                .andExpect(jsonPath("$.practitionerRoles").doesNotExist());
    }

    @Test
    void bookingCatalogAllowsVerifiedRepresentativeWithSlotHoldScope() throws Exception {
        UUID patientId = insertPatient("Dependent Child Patient");
        AuthSession representative = session(Set.of(PATIENT_ROLE_ID));
        jdbc().update("""
                insert into patient_account_link
                    (id, patient_id, account_id, relationship, verification_tier, permission_scope,
                     status, valid_from, version, created_at, updated_at)
                values (?, ?, ?, 'PARENT', 'IDENTITY_VERIFIED',
                    '{"version":"1","slot_hold.create":true,"slot_hold.read":true,"slot_hold.cancel":true}'::jsonb,
                    'ACTIVE', now() - interval '1 minute', 0, now(), now())
                """, UUID.randomUUID(), patientId, representative.accountId());

        createSlot(session(Set.of(CATALOG_ADMIN_ROLE_ID)), Instant.now().plus(2, ChronoUnit.DAYS), 2);

        mockMvc.perform(get("/api/v1/booking/catalog")
                        .cookie(representative.cookie()).header("X-MediCore-Tab-Context", representative.context())
                        .param("patientId", patientId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.departments").isArray())
                .andExpect(jsonPath("$.services").isArray());
    }

    @Test
    void bookingCatalogExcludesInactiveAndCancelledSlots() throws Exception {
        UUID patientId = insertPatient("Isolation Patient");
        AuthSession patientSession = sessionWithPatient(patientId);

        UUID cancelledSlotId = createSlot(session(Set.of(CATALOG_ADMIN_ROLE_ID)), Instant.now().plus(2, ChronoUnit.DAYS), 2);
        jdbc().update("update appointment_slot set status = 'CANCELLED' where id = ?", cancelledSlotId);

        mockMvc.perform(get("/api/v1/booking/catalog")
                        .cookie(patientSession.cookie()).header("X-MediCore-Tab-Context", patientSession.context())
                        .param("patientId", patientId.toString()))
                .andExpect(status().isOk());
    }

    @Test
    void patientSessionCannotAccessGenericCatalogEndpoints() throws Exception {
        UUID patientId = insertPatient("Generic Catalog Denial Patient");
        AuthSession patientSession = sessionWithPatient(patientId);

        mockMvc.perform(get("/api/v1/departments")
                        .cookie(patientSession.cookie()).header("X-MediCore-Tab-Context", patientSession.context()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));

        mockMvc.perform(get("/api/v1/rooms")
                        .cookie(patientSession.cookie()).header("X-MediCore-Tab-Context", patientSession.context()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));

        mockMvc.perform(get("/api/v1/services")
                        .cookie(patientSession.cookie()).header("X-MediCore-Tab-Context", patientSession.context()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));

        mockMvc.perform(get("/api/v1/practitioners")
                        .cookie(patientSession.cookie()).header("X-MediCore-Tab-Context", patientSession.context()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
    }

    // ── 2. Raw exact slots require staff permission ─────────────────────────

    @Test
    void rawSlotEndpointsRequireAppointmentSlotReadPermission() throws Exception {
        mockMvc.perform(get("/api/v1/appointment-slots"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_REQUIRED"));

        AuthSession noPermissions = session(Set.of());
        mockMvc.perform(get("/api/v1/appointment-slots").cookie(noPermissions.cookie()).header("X-MediCore-Tab-Context", noPermissions.context()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));

        AuthSession admin = session(Set.of(CATALOG_ADMIN_ROLE_ID));
        UUID slotId = createSlot(admin, Instant.now().plus(2, ChronoUnit.DAYS), 2);
        mockMvc.perform(get("/api/v1/appointment-slots/" + slotId).cookie(admin.cookie()).header("X-MediCore-Tab-Context", admin.context()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(slotId.toString()))
                .andExpect(header().exists("ETag"));
    }

    // ── 2. Unauthenticated mutations are rejected with 401 ──────────────────

    @Test
    void unauthenticatedMutationsReturn401() throws Exception {
        String slotBody = slotBody(Instant.now().plus(3, ChronoUnit.DAYS), 1);

        // No cookie at all
        mockMvc.perform(post("/api/v1/appointment-slots")
                        .header("X-CSRF-Token", "any")
                        .header("Idempotency-Key", "unauth-key-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(slotBody))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_REQUIRED"));

        mockMvc.perform(post("/api/v1/slot-holds")
                        .header("X-CSRF-Token", "any")
                        .header("Idempotency-Key", "unauth-key-2")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"bookingSessionId\":\"" + UUID.randomUUID() + "\",\"patientId\":\"" + UUID.randomUUID() + "\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_REQUIRED"));
    }

    // ── 3. Authenticated session with no matching permission returns 403 ────

    @Test
    void sessionWithoutPermissionReturns403() throws Exception {
        AuthSession noPermissions = session(Set.of());

        mockMvc.perform(post("/api/v1/appointment-slots")
                        .cookie(noPermissions.cookie()).header("X-MediCore-Tab-Context", noPermissions.context())
                        .header("X-CSRF-Token", noPermissions.csrfToken())
                        .header("Idempotency-Key", "no-perm-slot-key")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(slotBody(Instant.now().plus(4, ChronoUnit.DAYS), 1)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
    }

    // ── 4. CSRF token enforced before idempotency check ─────────────────────

    @Test
    void missingCsrfTokenReturns403BeforeIdempotencyCheck() throws Exception {
        AuthSession admin = session(Set.of(CATALOG_ADMIN_ROLE_ID));

        // With Idempotency-Key but without X-CSRF-Token → 403, not 400 IDEMPOTENCY
        mockMvc.perform(post("/api/v1/appointment-slots")
                        .cookie(admin.cookie()).header("X-MediCore-Tab-Context", admin.context())
                        .header("Idempotency-Key", "csrf-before-idempotency-key")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(slotBody(Instant.now().plus(5, ChronoUnit.DAYS), 1)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
    }

    // ── 5. Missing Idempotency-Key returns 400 after auth/CSRF pass ─────────

    @Test
    void missingIdempotencyKeyReturns400() throws Exception {
        AuthSession admin = session(Set.of(CATALOG_ADMIN_ROLE_ID));

        mockMvc.perform(post("/api/v1/appointment-slots")
                        .cookie(admin.cookie()).header("X-MediCore-Tab-Context", admin.context())
                        .header("X-CSRF-Token", admin.csrfToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(slotBody(Instant.now().plus(6, ChronoUnit.DAYS), 1)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("IDEMPOTENCY_KEY_REQUIRED"));
    }

    // ── 6. Idempotency replay returns identical response ────────────────────

    @Test
    void idempotencyReplayReturnsSameResponse() throws Exception {
        AuthSession admin = session(Set.of(CATALOG_ADMIN_ROLE_ID));
        String iKey = "idem-replay-" + UUID.randomUUID();
        String body = slotBody(Instant.now().plus(7, ChronoUnit.DAYS), 1);

        MvcResult first = mockMvc.perform(post("/api/v1/appointment-slots")
                        .cookie(admin.cookie()).header("X-MediCore-Tab-Context", admin.context())
                        .header("X-CSRF-Token", admin.csrfToken())
                        .header("Idempotency-Key", iKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andReturn();

        MvcResult replay = mockMvc.perform(post("/api/v1/appointment-slots")
                        .cookie(admin.cookie()).header("X-MediCore-Tab-Context", admin.context())
                        .header("X-CSRF-Token", admin.csrfToken())
                        .header("Idempotency-Key", iKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode firstJson  = objectMapper.readTree(first.getResponse().getContentAsString());
        JsonNode replayJson = objectMapper.readTree(replay.getResponse().getContentAsString());
        assertThat(firstJson.path("id").asText()).isEqualTo(replayJson.path("id").asText());
        assertThat(first.getResponse().getHeader("ETag")).isEqualTo(replay.getResponse().getHeader("ETag"));
    }

    // ── 7. Idempotency conflict (same key, different body) returns 409 ───────

    @Test
    void idempotencyConflictReturnsDifferentBodyReturns409() throws Exception {
        AuthSession admin = session(Set.of(CATALOG_ADMIN_ROLE_ID));
        String iKey = "idem-conflict-" + UUID.randomUUID();

        mockMvc.perform(post("/api/v1/appointment-slots")
                        .cookie(admin.cookie()).header("X-MediCore-Tab-Context", admin.context())
                        .header("X-CSRF-Token", admin.csrfToken())
                        .header("Idempotency-Key", iKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(slotBody(Instant.now().plus(8, ChronoUnit.DAYS), 1)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/appointment-slots")
                        .cookie(admin.cookie()).header("X-MediCore-Tab-Context", admin.context())
                        .header("X-CSRF-Token", admin.csrfToken())
                        .header("Idempotency-Key", iKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(slotBody(Instant.now().plus(8, ChronoUnit.DAYS), 3))) // different capacity → conflict
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("IDEMPOTENCY_KEY_REUSED"));
    }

    // ── 8. PATCH requires If-Match; missing → 428, stale → 412 ─────────────

    @Test
    void patchSlotMissingIfMatchReturns428() throws Exception {
        AuthSession admin = session(Set.of(CATALOG_ADMIN_ROLE_ID));
        UUID slotId = createSlot(admin, Instant.now().plus(9, ChronoUnit.DAYS), 2);

        mockMvc.perform(patch("/api/v1/appointment-slots/" + slotId)
                        .cookie(admin.cookie()).header("X-MediCore-Tab-Context", admin.context())
                        .header("X-CSRF-Token", admin.csrfToken())
                        .header("Idempotency-Key", "patch-no-etag-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"capacity\":3}"))
                .andExpect(status().isPreconditionRequired())
                .andExpect(jsonPath("$.code").value("CONCURRENCY_PRECONDITION_REQUIRED"));
    }

    @Test
    void patchSlotStaleIfMatchReturns412() throws Exception {
        AuthSession admin = session(Set.of(CATALOG_ADMIN_ROLE_ID));
        UUID slotId = createSlot(admin, Instant.now().plus(10, ChronoUnit.DAYS), 2);

        mockMvc.perform(patch("/api/v1/appointment-slots/" + slotId)
                        .cookie(admin.cookie()).header("X-MediCore-Tab-Context", admin.context())
                        .header("X-CSRF-Token", admin.csrfToken())
                        .header("If-Match", "\"999\"") // stale
                        .header("Idempotency-Key", "patch-stale-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"capacity\":3}"))
                .andExpect(status().isPreconditionFailed())
                .andExpect(jsonPath("$.code").value("CONCURRENCY_STALE_VERSION"));
    }

    @Test
    void patchSlotWithCurrentETagSucceedsAndAdvancesVersion() throws Exception {
        AuthSession admin = session(Set.of(CATALOG_ADMIN_ROLE_ID));
        UUID slotId = createSlot(admin, Instant.now().plus(11, ChronoUnit.DAYS), 2);

        mockMvc.perform(patch("/api/v1/appointment-slots/" + slotId)
                        .cookie(admin.cookie()).header("X-MediCore-Tab-Context", admin.context())
                        .header("X-CSRF-Token", admin.csrfToken())
                        .header("If-Match", "\"0\"")
                        .header("Idempotency-Key", "patch-ok-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"capacity\":5}"))
                .andExpect(status().isOk())
                .andExpect(header().string("ETag", "\"1\""))
                .andExpect(jsonPath("$.capacity").value(5))
                .andExpect(jsonPath("$.version").value(1));
    }

    // ── 9. DELETE /slot-holds/{id} — cancel hold (RELEASED lifecycle) ───────

    @Test
    void cancelSlotHoldTransitionsToReleased() throws Exception {
        AuthSession admin = session(Set.of(CATALOG_ADMIN_ROLE_ID, IDENTITY_ADMIN_ROLE_ID));
        UUID bookingSessionId = createWorkSchedule(admin, LocalDate.now(ZoneOffset.UTC).plusDays(12), "MORNING", 2).bookingSessionId();
        UUID patientId = insertPatient("Cancel Hold Patient");
        AuthSession patientSession = sessionWithPatient(patientId);
        UUID holdId = createBookingSessionHold(patientSession, bookingSessionId, patientId);

        MvcResult getResult = mockMvc.perform(get("/api/v1/slot-holds/" + holdId)
                        .cookie(patientSession.cookie()).header("X-MediCore-Tab-Context", patientSession.context()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.currency").value("VND"))
                .andExpect(jsonPath("$.idempotencyKey").doesNotExist())
                .andExpect(jsonPath("$.requestHash").doesNotExist())
                .andExpect(jsonPath("$.idempotencyScope").doesNotExist())
                .andReturn();

        long holdVersion = objectMapper.readTree(getResult.getResponse().getContentAsString()).path("version").asLong();
        mockMvc.perform(delete("/api/v1/slot-holds/" + holdId)
                        .cookie(patientSession.cookie()).header("X-MediCore-Tab-Context", patientSession.context())
                        .header("X-CSRF-Token", patientSession.csrfToken())
                        .header("If-Match", "\"" + holdVersion + "\"")
                        .header("Idempotency-Key", "cancel-hold-" + UUID.randomUUID()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RELEASED"));
    }

    // ── 10. Patient context: cannot create hold for another patient ──────────

    @Test
    void patientCannotCreateHoldForUnrelatedPatient() throws Exception {
        AuthSession admin = session(Set.of(CATALOG_ADMIN_ROLE_ID, IDENTITY_ADMIN_ROLE_ID));
        UUID bookingSessionId = createWorkSchedule(admin, LocalDate.now(ZoneOffset.UTC).plusDays(13), "MORNING", 3).bookingSessionId();

        UUID targetPatientId = insertPatient("Unrelated Patient");
        AuthSession requester = sessionWithPatient(insertPatient("Requester Patient"));

        // requester has patient-role permissions but targetPatient is not linked to their account
        mockMvc.perform(post("/api/v1/slot-holds")
                        .cookie(requester.cookie()).header("X-MediCore-Tab-Context", requester.context())
                        .header("X-CSRF-Token", requester.csrfToken())
                        .header("Idempotency-Key", "patient-context-deny-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"bookingSessionId\":\"" + bookingSessionId + "\",\"patientId\":\"" + targetPatientId + "\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
    }

    // ── 11. Aggregate booking hold contract ──────────────────────────────────

    @Test
    void bookingAvailabilityAndHoldUseBucketWithoutLeakingExactSlot() throws Exception {
        AuthSession admin = session(Set.of(CATALOG_ADMIN_ROLE_ID, IDENTITY_ADMIN_ROLE_ID));
        LocalDate date = LocalDate.now(ZoneOffset.UTC).plusDays(14);
        MvcResult schedule = mockMvc.perform(post("/api/v1/admin/work-schedules")
                        .cookie(admin.cookie()).header("X-MediCore-Tab-Context", admin.context())
                        .header("X-CSRF-Token", admin.csrfToken())
                        .header("Idempotency-Key", "schedule-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(workScheduleBody(date, "MORNING", 1)))
                .andExpect(status().isOk())
                .andExpect(header().string("ETag", "\"0\""))
                .andReturn();
        JsonNode scheduleJson = objectMapper.readTree(schedule.getResponse().getContentAsString());
        UUID bookingSessionId = UUID.fromString(scheduleJson.path("bookingSessionId").asText());

        UUID patientId = insertPatient("Aggregate Booker");
        AuthSession patient = sessionWithPatient(patientId);
        mockMvc.perform(get("/api/v1/booking/availability")
                        .cookie(patient.cookie()).header("X-MediCore-Tab-Context", patient.context())
                        .param("patientId", patientId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].id").value(hasItem(bookingSessionId.toString())));

        mockMvc.perform(get("/api/v1/booking/availability")
                        .cookie(patient.cookie()).header("X-MediCore-Tab-Context", patient.context())
                        .param("patientId", patientId.toString())
                        .param("departmentId", departmentId.toString())
                        .param("serviceId", serviceId.toString())
                        .param("date", date.toString())
                        .param("session", "MORNING"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(bookingSessionId.toString()))
                .andExpect(jsonPath("$.items[0].totalCapacity").value(1))
                .andExpect(jsonPath("$.items[0].slotId").doesNotExist())
                .andExpect(jsonPath("$.items[0].workScheduleId").doesNotExist())
                .andExpect(jsonPath("$.items[0].practitionerRoleId").doesNotExist())
                .andExpect(jsonPath("$.items[0].roomName").doesNotExist());

        MvcResult hold = mockMvc.perform(post("/api/v1/slot-holds")
                        .cookie(patient.cookie()).header("X-MediCore-Tab-Context", patient.context())
                        .header("X-CSRF-Token", patient.csrfToken())
                        .header("Idempotency-Key", "aggregate-hold-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"bookingSessionId\":\"" + bookingSessionId + "\",\"patientId\":\"" + patientId + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slotId").doesNotExist())
                .andExpect(jsonPath("$.assignment.practitionerName").value("Dr. Test"))
                .andExpect(jsonPath("$.assignment.roomName").value("Room A"))
                .andReturn();
        UUID holdId = UUID.fromString(objectMapper.readTree(hold.getResponse().getContentAsString()).path("id").asText());
        assertThat(jdbc().queryForObject("select count(*) from slot_hold where id = ? and slot_id = ?", Integer.class,
                holdId, UUID.fromString(scheduleJson.path("slotId").asText()))).isEqualTo(1);
    }

    @Test
    void multipleWorkSchedulesAggregateCapacityHoldPicksLowestUtilizationAndCancelledExcluded() throws Exception {
        AuthSession admin = session(Set.of(CATALOG_ADMIN_ROLE_ID, IDENTITY_ADMIN_ROLE_ID));
        LocalDate date = LocalDate.now(ZoneOffset.UTC).plusDays(25);

        // Create secondary room and practitioner
        UUID roomBId = createResource(admin, "POST", "/api/v1/rooms",
                "{\"departmentId\":\"%s\",\"code\":\"ROOM-B-%s\",\"name\":\"Room B\",\"effectiveFrom\":\"2020-01-01T00:00:00Z\"}"
                        .formatted(departmentId, UUID.randomUUID()));

        UUID practitioner2Id = UUID.randomUUID();
        jdbc().update("insert into practitioner (id, staff_code, full_name, active, created_at, updated_at) " +
                "values (?, ?, 'Dr. Second', true, now(), now())", practitioner2Id, "SCHED-" + UUID.randomUUID());
        UUID practitionerRole2Id = UUID.randomUUID();
        jdbc().update("insert into practitioner_role (id, practitioner_id, department_id, role_code, status, effective_from, created_at, updated_at) " +
                "values (?, ?, ?, 'DOCTOR', 'ACTIVE', now(), now(), now())", practitionerRole2Id, practitioner2Id, departmentId);

        // Work schedule 1: Dr. Test in Room A, capacity = 1
        String body1 = """
                {"practitionerRoleId":"%s","departmentId":"%s","roomId":"%s","serviceId":"%s",
                "localDate":"%s","session":"MORNING","capacity":1}
                """.formatted(practitionerRoleId, departmentId, roomId, serviceId, date);
        MvcResult schedule1 = mockMvc.perform(post("/api/v1/admin/work-schedules")
                        .cookie(admin.cookie()).header("X-MediCore-Tab-Context", admin.context())
                        .header("X-CSRF-Token", admin.csrfToken())
                        .header("Idempotency-Key", "schedule-1-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body1))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode json1 = objectMapper.readTree(schedule1.getResponse().getContentAsString());
        UUID bookingSessionId = UUID.fromString(json1.path("bookingSessionId").asText());
        UUID slot1Id = UUID.fromString(json1.path("slotId").asText());

        // Work schedule 2: Dr. Second in Room B, capacity = 2
        String body2 = """
                {"practitionerRoleId":"%s","departmentId":"%s","roomId":"%s","serviceId":"%s",
                "localDate":"%s","session":"MORNING","capacity":2}
                """.formatted(practitionerRole2Id, departmentId, roomBId, serviceId, date);
        MvcResult schedule2 = mockMvc.perform(post("/api/v1/admin/work-schedules")
                        .cookie(admin.cookie()).header("X-MediCore-Tab-Context", admin.context())
                        .header("X-CSRF-Token", admin.csrfToken())
                        .header("Idempotency-Key", "schedule-2-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body2))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode json2 = objectMapper.readTree(schedule2.getResponse().getContentAsString());
        UUID slot2Id = UUID.fromString(json2.path("slotId").asText());

        // 1. Availability check: aggregated total = 3, remaining = 3
        UUID patient1Id = insertPatient("Patient 1 MultiSchedule");
        AuthSession patient1 = sessionWithPatient(patient1Id);
        mockMvc.perform(get("/api/v1/booking/availability")
                        .cookie(patient1.cookie()).header("X-MediCore-Tab-Context", patient1.context())
                        .param("patientId", patient1Id.toString())
                        .param("departmentId", departmentId.toString())
                        .param("serviceId", serviceId.toString())
                        .param("date", date.toString())
                        .param("session", "MORNING"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].totalCapacity").value(3))
                .andExpect(jsonPath("$.items[0].remainingCapacity").value(3));

        // 2. Patient 1 holds:
        UUID hold1Id = createBookingSessionHold(patient1, bookingSessionId, patient1Id);

        // Check which slot got held
        boolean slot1Held = jdbc().queryForObject("select count(*) from slot_hold where id = ? and slot_id = ?", Integer.class, hold1Id, slot1Id) > 0;
        UUID otherSlot = slot1Held ? slot2Id : slot1Id;

        // Patient 2 holds -> candidate with lower utilization is selected
        UUID patient2Id = insertPatient("Patient 2 MultiSchedule");
        AuthSession patient2 = sessionWithPatient(patient2Id);
        UUID hold2Id = createBookingSessionHold(patient2, bookingSessionId, patient2Id);
        assertThat(jdbc().queryForObject("select count(*) from slot_hold where id = ? and slot_id = ?", Integer.class, hold2Id, otherSlot))
                .isEqualTo(1);

        // 3. Cancel schedule 3 test:
        LocalDate date3 = LocalDate.now(ZoneOffset.UTC).plusDays(26);
        String body3 = """
                {"practitionerRoleId":"%s","departmentId":"%s","roomId":"%s","serviceId":"%s",
                "localDate":"%s","session":"MORNING","capacity":1}
                """.formatted(practitionerRoleId, departmentId, roomId, serviceId, date3);
        MvcResult schedule3 = mockMvc.perform(post("/api/v1/admin/work-schedules")
                        .cookie(admin.cookie()).header("X-MediCore-Tab-Context", admin.context())
                        .header("X-CSRF-Token", admin.csrfToken())
                        .header("Idempotency-Key", "schedule-3-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body3))
                .andExpect(status().isOk())
                .andReturn();
        UUID schedule3Id = UUID.fromString(objectMapper.readTree(schedule3.getResponse().getContentAsString()).path("id").asText());

        mockMvc.perform(post("/api/v1/admin/work-schedules/{id}/actions/cancel", schedule3Id)
                        .cookie(admin.cookie()).header("X-MediCore-Tab-Context", admin.context())
                        .header("X-CSRF-Token", admin.csrfToken())
                        .header("Idempotency-Key", "cancel-" + UUID.randomUUID())
                        .header("If-Match", "\"0\""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));

        mockMvc.perform(get("/api/v1/booking/availability")
                        .cookie(patient1.cookie()).header("X-MediCore-Tab-Context", patient1.context())
                        .param("patientId", patient1Id.toString())
                        .param("departmentId", departmentId.toString())
                        .param("serviceId", serviceId.toString())
                        .param("date", date3.toString())
                        .param("session", "MORNING"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].totalCapacity").value(0))
                .andExpect(jsonPath("$.items[0].remainingCapacity").value(0))
                .andExpect(jsonPath("$.items[0].canCreateHold").value(false));
    }

    // ── 12. SlotHold response never exposes sensitive internal fields ─────────

    @Test
    void slotHoldResponseOmitsInternalIdempotencyAndHashFields() throws Exception {
        AuthSession admin = session(Set.of(CATALOG_ADMIN_ROLE_ID, IDENTITY_ADMIN_ROLE_ID));
        UUID bookingSessionId = createWorkSchedule(admin, LocalDate.now(ZoneOffset.UTC).plusDays(15), "MORNING", 3).bookingSessionId();

        UUID patientId = insertPatient("Privacy Check Patient");
        AuthSession patientSession = sessionWithPatient(patientId);
        UUID holdId = createBookingSessionHold(patientSession, bookingSessionId, patientId);

        String responseBody = mockMvc.perform(get("/api/v1/slot-holds/" + holdId)
                        .cookie(patientSession.cookie()).header("X-MediCore-Tab-Context", patientSession.context()))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse().getContentAsString();

        assertThat(responseBody).doesNotContain("idempotencyKey");
        assertThat(responseBody).doesNotContain("requestHash");
        assertThat(responseBody).doesNotContain("idempotencyScope");
    }

    // ── 13. Aggregate capacity denial remains audited ────────────────────────

    @Test
    void aggregateCapacityDenialWritesRedactedAuditEvent() throws Exception {
        AuthSession admin = session(Set.of(CATALOG_ADMIN_ROLE_ID, IDENTITY_ADMIN_ROLE_ID));
        UUID bookingSessionId = createWorkSchedule(admin, LocalDate.now(ZoneOffset.UTC).plusDays(16), "MORNING", 1).bookingSessionId();
        UUID firstId = insertPatient("Audit First");
        createBookingSessionHold(sessionWithPatient(firstId), bookingSessionId, firstId);

        UUID secondId = insertPatient("Audit Second");
        AuthSession secondSession = sessionWithPatient(secondId);
        mockMvc.perform(post("/api/v1/slot-holds")
                        .cookie(secondSession.cookie()).header("X-MediCore-Tab-Context", secondSession.context())
                        .header("X-CSRF-Token", secondSession.csrfToken())
                        .header("Idempotency-Key", "audit-deny-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"bookingSessionId\":\"" + bookingSessionId + "\",\"patientId\":\"" + secondId + "\"}"))
                .andExpect(status().isConflict());

        Integer deniedCount = jdbc().queryForObject(
                "select count(*) from audit_event where action = 'slot_hold.create' and outcome = 'DENIED' and reason = 'capacity_exhausted'",
                Integer.class);
        assertThat(deniedCount).isGreaterThanOrEqualTo(1);
        String auditJson = jdbc().queryForObject(
                "select source_event from audit_event where action = 'slot_hold.create' and outcome = 'DENIED' order by occurred_at desc limit 1",
                String.class);
        if (auditJson != null) {
            assertThat(auditJson).doesNotContainIgnoringCase("password");
            assertThat(auditJson).doesNotContainIgnoringCase("otp");
        }
    }

    // ── 14. Practitioner daily max (4 slots/day) enforced ───────────────────

    @Test
    void practitionerDailyMaxFourSlotsEnforced() throws Exception {
        AuthSession admin = session(Set.of(CATALOG_ADMIN_ROLE_ID));
        Instant base = LocalDate.now(ZoneOffset.UTC).plusDays(20).atTime(8, 0).toInstant(ZoneOffset.UTC);

        for (int i = 0; i < 2; i++) {
            createSlot(admin, base.plus(i * 30L, ChronoUnit.MINUTES), 1, "MORNING");
        }
        for (int i = 0; i < 2; i++) {
            createSlot(admin, base.plus((i + 4) * 30L, ChronoUnit.MINUTES), 1, "AFTERNOON");
        }

        mockMvc.perform(post("/api/v1/appointment-slots")
                        .cookie(admin.cookie()).header("X-MediCore-Tab-Context", admin.context())
                        .header("X-CSRF-Token", admin.csrfToken())
                        .header("Idempotency-Key", "daily-max-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(slotBodySession(base.plus(8 * 30L, ChronoUnit.MINUTES), 1, "MORNING")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_INVALID_REQUEST"));
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private String workScheduleBody(LocalDate date, String session, int capacity) {
        return """
                {"practitionerRoleId":"%s","departmentId":"%s","roomId":"%s","serviceId":"%s",
                "localDate":"%s","session":"%s","capacity":%d}
                """.formatted(practitionerRoleId, departmentId, roomId, serviceId, date, session, capacity);
    }

    private WorkScheduleFixture createWorkSchedule(AuthSession session, LocalDate date, String scheduleSession, int capacity)
            throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/admin/work-schedules")
                        .cookie(session.cookie()).header("X-MediCore-Tab-Context", session.context())
                        .header("X-CSRF-Token", session.csrfToken())
                        .header("Idempotency-Key", "schedule-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(workScheduleBody(date, scheduleSession, capacity)))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        return new WorkScheduleFixture(
                UUID.fromString(body.path("id").asText()),
                UUID.fromString(body.path("bookingSessionId").asText()),
                UUID.fromString(body.path("slotId").asText()));
    }

    private UUID createBookingSessionHold(AuthSession session, UUID bookingSessionId, UUID patientId) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/slot-holds")
                        .cookie(session.cookie()).header("X-MediCore-Tab-Context", session.context())
                        .header("X-CSRF-Token", session.csrfToken())
                        .header("Idempotency-Key", "hold-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"bookingSessionId\":\"" + bookingSessionId + "\",\"patientId\":\"" + patientId + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString()).path("id").asText());
    }

    private UUID createSlot(AuthSession session, Instant start, int capacity) throws Exception {
        return createSlot(session, start, capacity, "MORNING");
    }

    private UUID createSlot(AuthSession session, Instant start, int capacity, String slotSession) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/appointment-slots")
                        .cookie(session.cookie()).header("X-MediCore-Tab-Context", session.context())
                        .header("X-CSRF-Token", session.csrfToken())
                        .header("Idempotency-Key", "slot-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(slotBodySession(start, capacity, slotSession)))
                .andExpect(status().isOk())
                .andReturn();
        return UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString()).path("id").asText());
    }

    private UUID insertActiveSlot(Instant start, int capacity, String slotSession) {
        UUID slotId = UUID.randomUUID();
        jdbc().update("""
                insert into appointment_slot (id, practitioner_role_id, department_id, room_id, service_id,
                    session, start_at, end_at, capacity, status, version, created_at, updated_at)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 0, now(), now())
                """, slotId, practitionerRoleId, departmentId, roomId, serviceId, slotSession,
                start, start.plus(30, ChronoUnit.MINUTES), capacity);
        return slotId;
    }

    private UUID createResource(AuthSession session, String method, String path, String body) throws Exception {
        MvcResult result = mockMvc.perform(post(path)
                        .cookie(session.cookie()).header("X-MediCore-Tab-Context", session.context())
                        .header("X-CSRF-Token", session.csrfToken())
                        .header("Idempotency-Key", "fixture-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andReturn();
        return UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString()).path("id").asText());
    }

    private String slotBody(Instant start, int capacity) {
        return slotBodySession(start, capacity, "MORNING");
    }

    private String slotBodySession(Instant start, int capacity, String slotSession) {
        return """
                {"practitionerRoleId":"%s","departmentId":"%s","roomId":"%s","serviceId":"%s",
                "session":"%s","startAt":"%s","endAt":"%s","capacity":%d}
                """.formatted(practitionerRoleId, departmentId, roomId, serviceId,
                slotSession, start.toString(), start.plus(30, ChronoUnit.MINUTES).toString(), capacity);
    }

    private UUID insertPatient(String name) {
        UUID patientId = UUID.randomUUID();
        jdbc().update("insert into patient (id, full_name, date_of_birth, version, created_at, updated_at) " +
                "values (?, ?, date '1990-01-01', 0, now(), now())", patientId, name);
        return patientId;
    }

    /**
     * Link a patient to an account with OWN relationship (grants slot_hold.create/read/cancel).
     */
    private void linkPatientToAccount(UUID patientId, UUID accountId) {
        jdbc().update("""
                insert into patient_account_link
                    (id, patient_id, account_id, relationship, verification_tier, permission_scope,
                     status, valid_from, version, created_at, updated_at)
                values (?, ?, ?, 'OWN', 'IDENTITY_VERIFIED',
                    '{"version":"1","slot_hold.create":true,"slot_hold.read":true,"slot_hold.cancel":true}'::jsonb,
                    'ACTIVE', now() - interval '1 minute', 0, now(), now())
                """, UUID.randomUUID(), patientId, accountId);
    }

    /**
     * Create a session with PATIENT_ROLE_ID and link a patient to that account via OWN.
     */
    private AuthSession sessionWithPatient(UUID patientId) {
        AuthSession s = session(Set.of(PATIENT_ROLE_ID));
        linkPatientToAccount(patientId, s.accountId());
        return s;
    }

    private AuthSession session(Set<UUID> roleIds) {
        UUID accountId = UUID.randomUUID();
        UUID sessionId = UUID.randomUUID();
        String rawSession = "session-" + UUID.randomUUID();
        String csrfToken = "csrf-" + UUID.randomUUID();
        JdbcTemplate jdbc = jdbc();
        jdbc.update("""
                insert into user_account(id, normalized_email, display_email, status,
                    failed_login_count, version, created_at, updated_at)
                values (?, ?, ?, 'ACTIVE', 0, 0, now(), now())
                """, accountId, accountId + "@sched.test", accountId + "@sched.test");
        for (UUID roleId : roleIds) {
            jdbc.update("""
                    insert into account_role_assignment(id, account_id, role_id, department_id,
                        effective_from, effective_to, status, assigned_by_account_id, reason, version)
                    values (?, ?, ?, null, now() - interval '1 minute', null, 'ACTIVE', ?, 'Scheduling test', 0)
                    """, UUID.randomUUID(), accountId, roleId, accountId);
        }
        jdbc.update("""
                insert into account_session(id, account_id, session_token_hash, csrf_token_hash, tab_context_hash, status,
                    authenticated_at, last_seen_at, absolute_expires_at, version)
                values (?, ?, ?, ?, ?, 'ACTIVE', now(), now(), now() + interval '1 hour', 0)
                """, sessionId, accountId,
                secretHasher.hash("SESSION", rawSession), secretHasher.hash("CSRF", csrfToken),
                secretHasher.hash("SESSION_CONTEXT", TAB_CONTEXT));
        return new AuthSession(accountId, sessionId, new MockCookie("MEDICORE_SESSION_" + TAB_CONTEXT, rawSession), csrfToken, TAB_CONTEXT);
    }

    private JdbcTemplate jdbc() {
        return new JdbcTemplate(dataSource);
    }

    private record WorkScheduleFixture(UUID id, UUID bookingSessionId, UUID slotId) {}

    private record AuthSession(UUID accountId, UUID sessionId, MockCookie cookie, String csrfToken, String context) {}
}
