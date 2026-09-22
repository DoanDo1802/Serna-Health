package vn.medicore.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
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
import vn.medicore.service.PaymentProviderAdapter;
import vn.medicore.service.PaymentService;

@Testcontainers
@SpringBootTest(classes = MediCoreApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class RescheduleIT {

    private static final String TAB_CONTEXT = "TabContextHashValue001";

    private static final UUID IDENTITY_ADMIN_ROLE_ID = UUID.fromString("01980000-0000-7000-8000-000000000001");
    private static final UUID CATALOG_ADMIN_ROLE_ID = UUID.fromString("01980000-0000-7000-8000-000000000004");
    private static final UUID PATIENT_ROLE_ID = UUID.fromString("01980000-0000-7000-8000-000000000005");

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17.10");

    @Autowired MockMvc mockMvc;
    @Autowired DataSource dataSource;
    @Autowired SecretHasher secretHasher;
    @Autowired ObjectMapper objectMapper;
    @Autowired PaymentProviderAdapter adapter;
    @Autowired PaymentService paymentService;

    private UUID departmentId;
    private UUID roomId;
    private UUID secondaryRoomId;
    private UUID service80kId;
    private UUID service120kId;
    private UUID service50kId;
    private UUID practitionerRoleId;
    private UUID secondaryPractitionerRoleId;
    private UUID slot80kId;
    private UUID targetSlot80kId;
    private UUID secondTargetSlot80kId;
    private UUID targetSlot120kId;
    private UUID targetSlot50kId;

    @BeforeEach
    void setupFixtures() throws Exception {
        AuthSession admin = session(Set.of(CATALOG_ADMIN_ROLE_ID, IDENTITY_ADMIN_ROLE_ID));

        departmentId = createResource(admin, "POST", "/api/v1/departments",
                "{\"code\":\"RESCHED-DEPT-%s\",\"name\":\"Reschedule Dept\",\"effectiveFrom\":\"2020-01-01T00:00:00Z\"}"
                        .formatted(UUID.randomUUID()));

        roomId = createResource(admin, "POST", "/api/v1/rooms",
                "{\"departmentId\":\"%s\",\"code\":\"RESCHED-ROOM-%s\",\"name\":\"Room R\",\"effectiveFrom\":\"2020-01-01T00:00:00Z\"}"
                        .formatted(departmentId, UUID.randomUUID()));

        secondaryRoomId = createResource(admin, "POST", "/api/v1/rooms",
                "{\"departmentId\":\"%s\",\"code\":\"RESCHED-ROOM-SECONDARY-%s\",\"name\":\"Room S\",\"effectiveFrom\":\"2020-01-01T00:00:00Z\"}"
                        .formatted(departmentId, UUID.randomUUID()));

        service80kId = createResource(admin, "POST", "/api/v1/services",
                "{\"code\":\"RESCHED-SVC80-%s\",\"name\":\"Standard Consultation\",\"serviceType\":\"CONSULTATION\",\"effectiveFrom\":\"2020-01-01T00:00:00Z\"}"
                        .formatted(UUID.randomUUID()));

        service120kId = createResource(admin, "POST", "/api/v1/services",
                "{\"code\":\"RESCHED-SVC120-%s\",\"name\":\"Specialist Consultation\",\"serviceType\":\"CONSULTATION\",\"effectiveFrom\":\"2020-01-01T00:00:00Z\"}"
                        .formatted(UUID.randomUUID()));

        service50kId = createResource(admin, "POST", "/api/v1/services",
                "{\"code\":\"RESCHED-SVC50-%s\",\"name\":\"Basic Consultation\",\"serviceType\":\"CONSULTATION\",\"effectiveFrom\":\"2020-01-01T00:00:00Z\"}"
                        .formatted(UUID.randomUUID()));

        JdbcTemplate jdbc = jdbc();
        jdbc.update("insert into service_price (id, service_id, amount, currency, effective_from, created_at) " +
                        "values (?, ?, ?, 'VND', now() - interval '1 minute', now())",
                UUID.randomUUID(), service80kId, new BigDecimal("80000.00"));

        jdbc.update("insert into service_price (id, service_id, amount, currency, effective_from, created_at) " +
                        "values (?, ?, ?, 'VND', now() - interval '1 minute', now())",
                UUID.randomUUID(), service120kId, new BigDecimal("120000.00"));

        jdbc.update("insert into service_price (id, service_id, amount, currency, effective_from, created_at) " +
                        "values (?, ?, ?, 'VND', now() - interval '1 minute', now())",
                UUID.randomUUID(), service50kId, new BigDecimal("50000.00"));

        UUID practitionerId = UUID.randomUUID();
        jdbc.update("insert into practitioner (id, staff_code, full_name, active, created_at, updated_at) " +
                        "values (?, ?, 'Dr. Rescheduler', true, now(), now())",
                practitionerId, "RESCHED-" + UUID.randomUUID());

        practitionerRoleId = UUID.randomUUID();
        jdbc.update("insert into practitioner_role (id, practitioner_id, department_id, role_code, status, effective_from, created_at, updated_at) " +
                        "values (?, ?, ?, 'DOCTOR', 'ACTIVE', now(), now(), now())",
                practitionerRoleId, practitionerId, departmentId);
        UUID secondaryPractitionerId = UUID.randomUUID();
        jdbc.update("insert into practitioner (id, staff_code, full_name, active, created_at, updated_at) " +
                        "values (?, ?, 'Dr. Rescheduler Two', true, now(), now())",
                secondaryPractitionerId, "RESCHED-" + UUID.randomUUID());
        secondaryPractitionerRoleId = UUID.randomUUID();
        jdbc.update("insert into practitioner_role (id, practitioner_id, department_id, role_code, status, effective_from, created_at, updated_at) " +
                        "values (?, ?, ?, 'DOCTOR', 'ACTIVE', now(), now(), now())",
                secondaryPractitionerRoleId, secondaryPractitionerId, departmentId);

        Instant baseStart = Instant.now().plus(2, ChronoUnit.DAYS);

        // Initial slot (80k)
        slot80kId = createResource(admin, "POST", "/api/v1/appointment-slots",
                """
                {"practitionerRoleId":"%s","departmentId":"%s","roomId":"%s","serviceId":"%s",
                "session":"MORNING","startAt":"%s","endAt":"%s","capacity":5}
                """.formatted(practitionerRoleId, departmentId, roomId, service80kId,
                        baseStart.toString(), baseStart.plus(30, ChronoUnit.MINUTES).toString()));

        // Target slot 1: Equal deposit (80k)
        targetSlot80kId = createResource(admin, "POST", "/api/v1/appointment-slots",
                """
                {"practitionerRoleId":"%s","departmentId":"%s","roomId":"%s","serviceId":"%s",
                "session":"AFTERNOON","startAt":"%s","endAt":"%s","capacity":5}
                """.formatted(practitionerRoleId, departmentId, roomId, service80kId,
                        baseStart.plus(2, ChronoUnit.HOURS).toString(), baseStart.plus(2, ChronoUnit.HOURS).plus(30, ChronoUnit.MINUTES).toString()));

        // Distinct target slot for transfer-chain regression (80k).
        secondTargetSlot80kId = createResource(admin, "POST", "/api/v1/appointment-slots",
                """
                {"practitionerRoleId":"%s","departmentId":"%s","roomId":"%s","serviceId":"%s",
                "session":"AFTERNOON","startAt":"%s","endAt":"%s","capacity":5}
                """.formatted(secondaryPractitionerRoleId, departmentId, secondaryRoomId, service80kId,
                        baseStart.plus(3, ChronoUnit.HOURS).toString(), baseStart.plus(3, ChronoUnit.HOURS).plus(30, ChronoUnit.MINUTES).toString()));

        // Target slot 2: Higher deposit (120k)
        targetSlot120kId = createResource(admin, "POST", "/api/v1/appointment-slots",
                """
                {"practitionerRoleId":"%s","departmentId":"%s","roomId":"%s","serviceId":"%s",
                "session":"AFTERNOON","startAt":"%s","endAt":"%s","capacity":5}
                """.formatted(practitionerRoleId, departmentId, roomId, service120kId,
                        baseStart.plus(4, ChronoUnit.HOURS).toString(), baseStart.plus(4, ChronoUnit.HOURS).plus(30, ChronoUnit.MINUTES).toString()));

        // Target slot 3: Lower deposit (50k)
        targetSlot50kId = createResource(admin, "POST", "/api/v1/appointment-slots",
                """
                {"practitionerRoleId":"%s","departmentId":"%s","roomId":"%s","serviceId":"%s",
                "session":"MORNING","startAt":"%s","endAt":"%s","capacity":5}
                """.formatted(practitionerRoleId, departmentId, roomId, service50kId,
                        baseStart.plus(6, ChronoUnit.HOURS).toString(), baseStart.plus(6, ChronoUnit.HOURS).plus(30, ChronoUnit.MINUTES).toString()));
    }

    @Test
    void SC_R1_RESCHEDULE_01_atomicEqualDepositTransferCommitAndIdempotentReplay() throws Exception {
        UUID patientId = insertPatient("Equal Deposit Patient");
        AuthSession patientSession = sessionWithPatient(patientId);

        // 1. Create original appointment with payment
        UUID oldAppointmentId = createPaidAppointment(patientSession, slot80kId, patientId, new BigDecimal("80000.00"));

        // 2. Create target slot hold
        UUID targetHoldId = createFixtureSlotHold(patientSession, targetSlot80kId, patientId);

        // 3. Reschedule appointment
        String idempotencyKey = "resched-equal-" + UUID.randomUUID();
        MvcResult rescheduleResult = mockMvc.perform(post("/api/v1/appointments/{appointmentId}/actions/reschedule", oldAppointmentId)
                        .cookie(patientSession.cookie()).header("X-MediCore-Tab-Context", patientSession.context())
                        .header("X-CSRF-Token", patientSession.csrfToken())
                        .header("If-Match", "\"0\"")
                        .header("Idempotency-Key", idempotencyKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetSlotHoldId\":\"%s\",\"reason\":\"Patient requested change\"}".formatted(targetHoldId)))
                .andExpect(status().isOk())
                .andExpect(header().string("ETag", "\"1\""))
                .andExpect(jsonPath("$.oldAppointmentId").value(oldAppointmentId.toString()))
                .andExpect(jsonPath("$.oldAppointmentVersion").value(1))
                .andExpect(jsonPath("$.newAppointmentVersion").value(0))
                .andExpect(jsonPath("$.transferredAmount").value(80000.00))
                .andExpect(jsonPath("$.differenceAmount").value(0.00))
                .andExpect(jsonPath("$.differenceDisposition").value("NONE"))
                .andExpect(jsonPath("$.currency").value("VND"))
                .andReturn();

        JsonNode responseJson = objectMapper.readTree(rescheduleResult.getResponse().getContentAsString());
        UUID newAppointmentId = UUID.fromString(responseJson.path("newAppointmentId").asText());
        UUID transferId = UUID.fromString(responseJson.path("depositTransferId").asText());

        // 4. Assert DB state
        JdbcTemplate jdbc = jdbc();

        // Old appointment is RESCHEDULED with reciprocal link to new appointment
        String oldStatus = jdbc.queryForObject("select status from appointment where id = ?", String.class, oldAppointmentId);
        UUID oldRescheduledTo = jdbc.queryForObject("select rescheduled_to_id from appointment where id = ?", UUID.class, oldAppointmentId);
        assertThat(oldStatus).isEqualTo("RESCHEDULED");
        assertThat(oldRescheduledTo).isEqualTo(newAppointmentId);

        // New appointment is CONFIRMED with reciprocal link from old appointment
        String newStatus = jdbc.queryForObject("select status from appointment where id = ?", String.class, newAppointmentId);
        UUID newRescheduledFrom = jdbc.queryForObject("select rescheduled_from_id from appointment where id = ?", UUID.class, newAppointmentId);
        assertThat(newStatus).isEqualTo("CONFIRMED");
        assertThat(newRescheduledFrom).isEqualTo(oldAppointmentId);

        // Target hold is CONSUMED
        String targetHoldStatus = jdbc.queryForObject("select status from slot_hold where id = ?", String.class, targetHoldId);
        assertThat(targetHoldStatus).isEqualTo("CONSUMED");

        // Source allocation is TRANSFERRED
        String sourceAllocStatus = jdbc.queryForObject("select status from deposit_allocation where appointment_id = ? and allocation_type = 'ORIGINAL'", String.class, oldAppointmentId);
        assertThat(sourceAllocStatus).isEqualTo("TRANSFERRED");

        // Target allocation is ACTIVE (TRANSFER_IN)
        String targetAllocStatus = jdbc.queryForObject("select status from deposit_allocation where appointment_id = ? and allocation_type = 'TRANSFER_IN'", String.class, newAppointmentId);
        assertThat(targetAllocStatus).isEqualTo("ACTIVE");

        // DepositTransfer record is persisted
        String disposition = jdbc.queryForObject("select difference_disposition from deposit_transfer where id = ?", String.class, transferId);
        assertThat(disposition).isEqualTo("NONE");

        // Outbox event is emitted
        Integer outboxCount = jdbc.queryForObject("select count(*) from outbox_event where aggregate_id = ? and event_type = 'appointment.rescheduled.v1'", Integer.class, newAppointmentId);
        assertThat(outboxCount).isEqualTo(1);

        // 5. Idempotent replay: sending same request with same key returns identical 200 response
        mockMvc.perform(post("/api/v1/appointments/{appointmentId}/actions/reschedule", oldAppointmentId)
                        .cookie(patientSession.cookie()).header("X-MediCore-Tab-Context", patientSession.context())
                        .header("X-CSRF-Token", patientSession.csrfToken())
                        .header("If-Match", "\"0\"")
                        .header("Idempotency-Key", idempotencyKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetSlotHoldId\":\"%s\",\"reason\":\"Patient requested change\"}".formatted(targetHoldId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.newAppointmentId").value(newAppointmentId.toString()))
                .andExpect(jsonPath("$.depositTransferId").value(transferId.toString()));
    }

    @Test
    void rescheduleAvailabilityMarksCurrentSlotAndExcludesSourceConflict() throws Exception {
        UUID patientId = insertPatient("Availability Source Exclusion Patient");
        AuthSession patientSession = sessionWithPatient(patientId);
        UUID appointmentId = createPaidAppointment(patientSession, slot80kId, patientId, new BigDecimal("80000.00"));
        Instant sourceStart = jdbc().queryForObject("select start_at from appointment_slot where id = ?", Instant.class, slot80kId);
        UUID overlapSlotId = UUID.randomUUID();
        jdbc().update("""
                insert into appointment_slot (id, practitioner_role_id, department_id, room_id, service_id,
                    session, start_at, end_at, capacity, status, version, created_at, updated_at)
                values (?, ?, ?, ?, ?, 'MORNING', ?, ?, 5, 'ACTIVE', 0, now(), now())
                """, overlapSlotId, secondaryPractitionerRoleId, departmentId, secondaryRoomId, service80kId,
                Timestamp.from(sourceStart.plus(15, ChronoUnit.MINUTES)),
                Timestamp.from(sourceStart.plus(45, ChronoUnit.MINUTES)));

        MvcResult availability = mockMvc.perform(get("/api/v1/appointments/{appointmentId}/actions/reschedule-availability", appointmentId)
                        .cookie(patientSession.cookie()).header("X-MediCore-Tab-Context", patientSession.context())
                        .param("limit", "100"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode items = objectMapper.readTree(availability.getResponse().getContentAsString()).path("items");
        assertThat(availabilitySlot(items, slot80kId).path("disabledReason").asText()).isEqualTo("CURRENT_APPOINTMENT");
        assertThat(availabilitySlot(items, overlapSlotId).path("canCreateHold").asBoolean()).isTrue();
    }

    @Test
    void rescheduleCatalogRequiresRescheduleScopeAndReturnsAllMetadata() throws Exception {
        UUID patientId = insertPatient("Reschedule Catalog Patient");
        AuthSession patientSession = sessionWithPatient(patientId);
        UUID appointmentId = createPaidAppointment(patientSession, slot80kId, patientId, new BigDecimal("80000.00"));

        // 1. Unauthenticated -> 401
        mockMvc.perform(get("/api/v1/appointments/{appointmentId}/actions/reschedule-catalog", appointmentId))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_REQUIRED"));

        // 2. Different patient -> 403
        UUID otherPatientId = insertPatient("Other Patient");
        AuthSession otherSession = sessionWithPatient(otherPatientId);
        mockMvc.perform(get("/api/v1/appointments/{appointmentId}/actions/reschedule-catalog", appointmentId)
                        .cookie(otherSession.cookie()).header("X-MediCore-Tab-Context", otherSession.context()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));

        // 3. Appointment owner -> 200 with all 5 catalog arrays
        mockMvc.perform(get("/api/v1/appointments/{appointmentId}/actions/reschedule-catalog", appointmentId)
                        .cookie(patientSession.cookie()).header("X-MediCore-Tab-Context", patientSession.context()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.departments").isArray())
                .andExpect(jsonPath("$.rooms").isArray())
                .andExpect(jsonPath("$.services").isArray())
                .andExpect(jsonPath("$.practitioners").isArray())
                .andExpect(jsonPath("$.practitionerRoles").isArray())
                .andExpect(jsonPath("$.practitioners[*].staffCode").doesNotExist())
                .andExpect(jsonPath("$.practitioners[*].userAccountId").doesNotExist());
    }

    @Test
    void rescheduleTargetHoldExcludesOnlySourceAppointment() throws Exception {
        UUID patientId = insertPatient("Source Exclusion Patient");
        AuthSession patientSession = sessionWithPatient(patientId);
        UUID oldAppointmentId = createPaidAppointment(patientSession, slot80kId, patientId, new BigDecimal("80000.00"));

        UUID overlappingSlotId = UUID.randomUUID();
        Instant sourceStart = jdbc().queryForObject("select start_at from appointment_slot where id = ?", Instant.class, slot80kId);
        jdbc().update("""
                insert into appointment_slot (id, practitioner_role_id, department_id, room_id, service_id,
                    session, start_at, end_at, capacity, status, version, created_at, updated_at)
                values (?, ?, ?, ?, ?, 'MORNING', ?, ?, 5, 'ACTIVE', 0, now(), now())
                """, overlappingSlotId, secondaryPractitionerRoleId, departmentId, secondaryRoomId, service80kId,
                Timestamp.from(sourceStart.plus(15, ChronoUnit.MINUTES)),
                Timestamp.from(sourceStart.plus(45, ChronoUnit.MINUTES)));

        MvcResult targetHoldResult = mockMvc.perform(post("/api/v1/appointments/{appointmentId}/actions/reschedule-slot-holds", oldAppointmentId)
                        .cookie(patientSession.cookie()).header("X-MediCore-Tab-Context", patientSession.context())
                        .header("X-CSRF-Token", patientSession.csrfToken())
                        .header("Idempotency-Key", "reschedule-overlap-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"slotId\":\"%s\"}".formatted(overlappingSlotId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slotId").value(overlappingSlotId.toString()))
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andReturn();

        UUID targetHoldId = UUID.fromString(objectMapper.readTree(targetHoldResult.getResponse().getContentAsString()).path("id").asText());
        mockMvc.perform(post("/api/v1/appointments/{appointmentId}/actions/reschedule", oldAppointmentId)
                        .cookie(patientSession.cookie()).header("X-MediCore-Tab-Context", patientSession.context())
                        .header("X-CSRF-Token", patientSession.csrfToken())
                        .header("If-Match", "\"0\"")
                        .header("Idempotency-Key", "reschedule-overlap-final-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetSlotHoldId\":\"%s\"}".formatted(targetHoldId)))
                .andExpect(status().isOk());
    }

    @Test
    void SC_R1_RESCHEDULE_02_higherDepositWithCapturedTopUpSucceeds() throws Exception {
        UUID patientId = insertPatient("Higher Deposit Patient");
        AuthSession patientSession = sessionWithPatient(patientId);

        // 1. Original appointment with 50k deposit
        UUID oldAppointmentId = createPaidAppointment(patientSession, targetSlot50kId, patientId, new BigDecimal("50000.00"));

        // 2. Target hold with 80k deposit (difference: 30k)
        UUID targetHoldId = createFixtureSlotHold(patientSession, targetSlot80kId, patientId);

        // 3. Create top-up payment intent through public reschedule flow.
        MvcResult topUpResult = mockMvc.perform(post("/api/v1/appointments/{appointmentId}/actions/reschedule-top-up", oldAppointmentId)
                        .cookie(patientSession.cookie()).header("X-MediCore-Tab-Context", patientSession.context())
                        .header("X-CSRF-Token", patientSession.csrfToken())
                        .header("If-Match", "\"0\"")
                        .header("Idempotency-Key", "topup-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetSlotHoldId\":\"%s\",\"reason\":\"Upgraded to standard\"}".formatted(targetHoldId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.amount").value(30000.00))
                .andReturn();
        UUID topUpIntentId = UUID.fromString(objectMapper.readTree(topUpResult.getResponse().getContentAsString()).path("id").asText());

        // 4. Simulate mock capture for top-up intent
        mockMvc.perform(post("/api/v1/mock-payment-intents/{intentId}/actions/simulate", topUpIntentId)
                        .cookie(patientSession.cookie()).header("X-MediCore-Tab-Context", patientSession.context())
                        .header("X-CSRF-Token", patientSession.csrfToken())
                        .header("Idempotency-Key", "sim-topup-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"outcome\":\"SUCCEEDED\"}"))
                .andExpect(status().isAccepted());

        // 5. Execute reschedule with top-up intent
        MvcResult rescheduleResult = mockMvc.perform(post("/api/v1/appointments/{appointmentId}/actions/reschedule", oldAppointmentId)
                        .cookie(patientSession.cookie()).header("X-MediCore-Tab-Context", patientSession.context())
                        .header("X-CSRF-Token", patientSession.csrfToken())
                        .header("If-Match", "\"0\"")
                        .header("Idempotency-Key", "resched-higher-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"targetSlotHoldId":"%s","reason":"Upgraded to standard","topUpPaymentIntentId":"%s"}
                                """.formatted(targetHoldId, topUpIntentId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.transferredAmount").value(50000.00))
                .andExpect(jsonPath("$.differenceAmount").value(30000.00))
                .andExpect(jsonPath("$.differenceDisposition").value("ADDITIONAL_CAPTURE"))
                .andReturn();

        JsonNode responseJson = objectMapper.readTree(rescheduleResult.getResponse().getContentAsString());
        UUID newAppointmentId = UUID.fromString(responseJson.path("newAppointmentId").asText());

        // New appointment has 2 active deposit allocations: 50k transfer + 30k top-up.
        JdbcTemplate jdbc = jdbc();
        Integer allocCount = jdbc.queryForObject("select count(*) from deposit_allocation where appointment_id = ? and status = 'ACTIVE'", Integer.class, newAppointmentId);
        assertThat(allocCount).isEqualTo(2);
        assertThat(jdbc.queryForObject("select status from reschedule_top_up where payment_intent_id = ?", String.class, topUpIntentId))
                .isEqualTo("CONSUMED");

        // Reschedule again. Both active allocations move through independent transfer legs.
        UUID secondTargetHoldId = createFixtureSlotHold(patientSession, secondTargetSlot80kId, patientId);
        MvcResult secondReschedule = mockMvc.perform(post("/api/v1/appointments/{appointmentId}/actions/reschedule", newAppointmentId)
                        .cookie(patientSession.cookie()).header("X-MediCore-Tab-Context", patientSession.context())
                        .header("X-CSRF-Token", patientSession.csrfToken())
                        .header("If-Match", "\"0\"")
                        .header("Idempotency-Key", "resched-higher-second-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetSlotHoldId\":\"%s\",\"reason\":\"Second change\"}".formatted(secondTargetHoldId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.transferredAmount").value(80000.00))
                .andExpect(jsonPath("$.differenceDisposition").value("NONE"))
                .andReturn();
        UUID secondTransferId = UUID.fromString(objectMapper.readTree(secondReschedule.getResponse().getContentAsString())
                .path("depositTransferId").asText());
        assertThat(jdbc.queryForObject("select count(*) from deposit_transfer_leg where deposit_transfer_id = ?", Integer.class,
                secondTransferId)).isEqualTo(2);
        assertThat(jdbc.queryForObject("select coalesce(sum(amount), 0) from deposit_transfer_leg where deposit_transfer_id = ?",
                BigDecimal.class, secondTransferId)).isEqualByComparingTo("80000.00");
    }

    @Test
    void SC_R1_RESCHEDULE_02_lowerDepositLeavesRefundPendingOutbox() throws Exception {
        UUID patientId = insertPatient("Lower Deposit Patient");
        AuthSession patientSession = sessionWithPatient(patientId);

        // 1. Original appointment with 80k deposit
        UUID oldAppointmentId = createPaidAppointment(patientSession, slot80kId, patientId, new BigDecimal("80000.00"));

        // 2. Target hold with 50k deposit (difference: 30k excess)
        UUID targetHoldId = createFixtureSlotHold(patientSession, targetSlot50kId, patientId);

        // 3. Execute reschedule
        MvcResult rescheduleResult = mockMvc.perform(post("/api/v1/appointments/{appointmentId}/actions/reschedule", oldAppointmentId)
                        .cookie(patientSession.cookie()).header("X-MediCore-Tab-Context", patientSession.context())
                        .header("X-CSRF-Token", patientSession.csrfToken())
                        .header("If-Match", "\"0\"")
                        .header("Idempotency-Key", "resched-lower-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetSlotHoldId\":\"%s\",\"reason\":\"Downgraded to basic\"}".formatted(targetHoldId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.transferredAmount").value(50000.00))
                .andExpect(jsonPath("$.differenceAmount").value(30000.00))
                .andExpect(jsonPath("$.differenceDisposition").value("REFUND_PENDING"))
                .andExpect(jsonPath("$.refundPendingAllocationId").isNotEmpty())
                .andReturn();

        JsonNode responseJson = objectMapper.readTree(rescheduleResult.getResponse().getContentAsString());
        UUID refundPendingAllocId = UUID.fromString(responseJson.path("refundPendingAllocationId").asText());

        JdbcTemplate jdbc = jdbc();
        // Excess allocation is marked REFUND_PENDING
        String refundStatus = jdbc.queryForObject("select status from deposit_allocation where id = ?", String.class, refundPendingAllocId);
        assertThat(refundStatus).isEqualTo("REFUND_PENDING");

        // Outbox event payment.refund_pending.v1 is created
        Integer refundOutboxCount = jdbc.queryForObject("select count(*) from outbox_event where aggregate_id = ? and event_type = 'payment.refund_pending.v1'", Integer.class, refundPendingAllocId);
        assertThat(refundOutboxCount).isEqualTo(1);
    }

    @Test
    void rescheduleWithoutSourceAllocationRejectsBeforeLineageOrHoldMutation() throws Exception {
        UUID patientId = insertPatient("Missing Allocation Patient");
        AuthSession patientSession = sessionWithPatient(patientId);
        UUID oldAppointmentId = createPaidAppointment(patientSession, slot80kId, patientId, new BigDecimal("80000.00"));
        UUID targetHoldId = createFixtureSlotHold(patientSession, targetSlot80kId, patientId);
        jdbc().update("update deposit_allocation set status = 'ENTERED_IN_ERROR' where appointment_id = ?", oldAppointmentId);

        mockMvc.perform(post("/api/v1/appointments/{appointmentId}/actions/reschedule", oldAppointmentId)
                        .cookie(patientSession.cookie()).header("X-MediCore-Tab-Context", patientSession.context())
                        .header("X-CSRF-Token", patientSession.csrfToken())
                        .header("If-Match", "\"0\"")
                        .header("Idempotency-Key", "resched-missing-funding-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetSlotHoldId\":\"%s\",\"reason\":\"Change\"}".formatted(targetHoldId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PAYMENT_SOURCE_ALLOCATION_MISSING"));

        assertThat(jdbc().queryForObject("select status from appointment where id = ?", String.class, oldAppointmentId))
                .isEqualTo("CONFIRMED");
        assertThat(jdbc().queryForObject("select status from slot_hold where id = ?", String.class, targetHoldId))
                .isEqualTo("ACTIVE");
        assertThat(jdbc().queryForObject("select count(*) from appointment where rescheduled_from_id = ?", Integer.class, oldAppointmentId))
                .isZero();
    }

    @Test
    void rescheduleRejectsZeroDepositTargetWithoutMutatingLineageOrHold() throws Exception {
        UUID patientId = insertPatient("Zero Target Patient");
        AuthSession patientSession = sessionWithPatient(patientId);
        UUID oldAppointmentId = createPaidAppointment(patientSession, slot80kId, patientId, new BigDecimal("80000.00"));
        UUID zeroTargetHoldId = createFixtureSlotHold(patientSession, targetSlot80kId, patientId);
        jdbc().update("update slot_hold set deposit_amount = 0.00 where id = ?", zeroTargetHoldId);

        mockMvc.perform(post("/api/v1/appointments/{appointmentId}/actions/reschedule", oldAppointmentId)
                        .cookie(patientSession.cookie()).header("X-MediCore-Tab-Context", patientSession.context())
                        .header("X-CSRF-Token", patientSession.csrfToken())
                        .header("If-Match", "\"0\"")
                        .header("Idempotency-Key", "resched-zero-target-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetSlotHoldId\":\"%s\",\"reason\":\"Change\"}".formatted(zeroTargetHoldId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PAYMENT_TARGET_DEPOSIT_UNSUPPORTED"));

        assertThat(jdbc().queryForObject("select status from appointment where id = ?", String.class, oldAppointmentId))
                .isEqualTo("CONFIRMED");
        assertThat(jdbc().queryForObject("select status from slot_hold where id = ?", String.class, zeroTargetHoldId))
                .isEqualTo("ACTIVE");
    }

    @Test
    void rescheduleRequiresIfMatchAndRejectsStaleVersion() throws Exception {
        UUID patientId = insertPatient("IfMatch Test Patient");
        AuthSession patientSession = sessionWithPatient(patientId);
        UUID oldAppointmentId = createPaidAppointment(patientSession, slot80kId, patientId, new BigDecimal("80000.00"));
        UUID targetHoldId = createFixtureSlotHold(patientSession, targetSlot80kId, patientId);

        // Missing If-Match header -> 428 Precondition Required
        mockMvc.perform(post("/api/v1/appointments/{appointmentId}/actions/reschedule", oldAppointmentId)
                        .cookie(patientSession.cookie()).header("X-MediCore-Tab-Context", patientSession.context())
                        .header("X-CSRF-Token", patientSession.csrfToken())
                        .header("Idempotency-Key", "resched-no-ifmatch-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetSlotHoldId\":\"%s\"}".formatted(targetHoldId)))
                .andExpect(status().isPreconditionRequired());

        // Stale If-Match header -> 412 Precondition Failed
        mockMvc.perform(post("/api/v1/appointments/{appointmentId}/actions/reschedule", oldAppointmentId)
                        .cookie(patientSession.cookie()).header("X-MediCore-Tab-Context", patientSession.context())
                        .header("X-CSRF-Token", patientSession.csrfToken())
                        .header("If-Match", "\"999\"")
                        .header("Idempotency-Key", "resched-stale-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetSlotHoldId\":\"%s\"}".formatted(targetHoldId)))
                .andExpect(status().isPreconditionFailed());
    }

    @Test
    void idempotencyConflictWhenSameKeyUsedWithDifferentPayload() throws Exception {
        UUID patientId = insertPatient("Idempotency Conflict Patient");
        AuthSession patientSession = sessionWithPatient(patientId);
        UUID oldAppointmentId = createPaidAppointment(patientSession, slot80kId, patientId, new BigDecimal("80000.00"));
        UUID targetHold1 = createFixtureSlotHold(patientSession, targetSlot80kId, patientId);
        UUID targetHold2 = createFixtureSlotHold(patientSession, targetSlot50kId, patientId);

        String idempotencyKey = "resched-conflict-" + UUID.randomUUID();

        // First call
        mockMvc.perform(post("/api/v1/appointments/{appointmentId}/actions/reschedule", oldAppointmentId)
                        .cookie(patientSession.cookie()).header("X-MediCore-Tab-Context", patientSession.context())
                        .header("X-CSRF-Token", patientSession.csrfToken())
                        .header("If-Match", "\"0\"")
                        .header("Idempotency-Key", idempotencyKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetSlotHoldId\":\"%s\"}".formatted(targetHold1)))
                .andExpect(status().isOk());

        // Second call with same key but different targetSlotHoldId -> 409 Conflict
        mockMvc.perform(post("/api/v1/appointments/{appointmentId}/actions/reschedule", oldAppointmentId)
                        .cookie(patientSession.cookie()).header("X-MediCore-Tab-Context", patientSession.context())
                        .header("X-CSRF-Token", patientSession.csrfToken())
                        .header("If-Match", "\"0\"")
                        .header("Idempotency-Key", idempotencyKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetSlotHoldId\":\"%s\"}".formatted(targetHold2)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("IDEMPOTENCY_KEY_REUSED"));
    }

    @Test
    void crossPatientHoldOrUnauthorizedDelegateIsForbidden() throws Exception {
        UUID ownerPatientId = insertPatient("Owner Patient");
        UUID otherPatientId = insertPatient("Other Patient");
        AuthSession ownerSession = sessionWithPatient(ownerPatientId);
        AuthSession otherSession = sessionWithPatient(otherPatientId);

        UUID oldAppointmentId = createPaidAppointment(ownerSession, slot80kId, ownerPatientId, new BigDecimal("80000.00"));

        // Other session creates hold for other patient
        UUID otherHoldId = createFixtureSlotHold(otherSession, targetSlot80kId, otherPatientId);

        // Other session tries to reschedule owner's appointment -> 403 Forbidden
        mockMvc.perform(post("/api/v1/appointments/{appointmentId}/actions/reschedule", oldAppointmentId)
                        .cookie(otherSession.cookie()).header("X-MediCore-Tab-Context", otherSession.context())
                        .header("X-CSRF-Token", otherSession.csrfToken())
                        .header("If-Match", "\"0\"")
                        .header("Idempotency-Key", "resched-other-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetSlotHoldId\":\"%s\"}".formatted(otherHoldId)))
                .andExpect(status().isForbidden());
    }

    @Test
    void SC_R1_RESCHEDULE_06_patientSelfServiceRejectedWithin24HoursOfSourceSlot() throws Exception {
        UUID patientId = insertPatient("Cutoff Patient");
        AuthSession patientSession = sessionWithPatient(patientId);
        UUID oldAppointmentId = createPaidAppointment(patientSession, slot80kId, patientId, new BigDecimal("80000.00"));
        moveSlotTo(slot80kId, Instant.now().plus(23, ChronoUnit.HOURS));

        mockMvc.perform(get("/api/v1/appointments/{appointmentId}/actions/reschedule-availability", oldAppointmentId)
                        .cookie(patientSession.cookie()).header("X-MediCore-Tab-Context", patientSession.context())
                        .param("limit", "20"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SELF_SERVICE_RESCHEDULE_WINDOW_CLOSED"));

        mockMvc.perform(post("/api/v1/appointments/{appointmentId}/actions/reschedule-slot-holds", oldAppointmentId)
                        .cookie(patientSession.cookie()).header("X-MediCore-Tab-Context", patientSession.context())
                        .header("X-CSRF-Token", patientSession.csrfToken())
                        .header("Idempotency-Key", "cutoff-target-hold-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"slotId\":\"%s\"}".formatted(targetSlot80kId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SELF_SERVICE_RESCHEDULE_WINDOW_CLOSED"));

        UUID targetHoldId = createFixtureSlotHold(patientSession, targetSlot80kId, patientId);

        mockMvc.perform(post("/api/v1/appointments/{appointmentId}/actions/reschedule", oldAppointmentId)
                        .cookie(patientSession.cookie()).header("X-MediCore-Tab-Context", patientSession.context())
                        .header("X-CSRF-Token", patientSession.csrfToken())
                        .header("If-Match", "\"0\"")
                        .header("Idempotency-Key", "cutoff-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetSlotHoldId\":\"%s\",\"reason\":\"Patient wants change\"}".formatted(targetHoldId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SELF_SERVICE_RESCHEDULE_WINDOW_CLOSED"));

        assertThat(jdbc().queryForObject("select status from appointment where id = ?", String.class, oldAppointmentId))
                .isEqualTo("CONFIRMED");
        assertThat(jdbc().queryForObject("select status from slot_hold where id = ?", String.class, targetHoldId))
                .isEqualTo("ACTIVE");
    }

    @Test
    void patientRescheduleAllowedWhenAppointmentIsOlderThan24HoursButSourceSlotIsLater() throws Exception {
        UUID patientId = insertPatient("Old Booking Future Slot Patient");
        AuthSession patientSession = sessionWithPatient(patientId);
        UUID oldAppointmentId = createPaidAppointment(patientSession, slot80kId, patientId, new BigDecimal("80000.00"));
        jdbc().update("update appointment set created_at = now() - interval '25 hours' where id = ?", oldAppointmentId);

        mockMvc.perform(get("/api/v1/appointments/{appointmentId}/actions/reschedule-availability", oldAppointmentId)
                        .cookie(patientSession.cookie()).header("X-MediCore-Tab-Context", patientSession.context())
                        .param("limit", "20"))
                .andExpect(status().isOk());

        MvcResult targetHoldResult = mockMvc.perform(post("/api/v1/appointments/{appointmentId}/actions/reschedule-slot-holds", oldAppointmentId)
                        .cookie(patientSession.cookie()).header("X-MediCore-Tab-Context", patientSession.context())
                        .header("X-CSRF-Token", patientSession.csrfToken())
                        .header("Idempotency-Key", "old-booking-future-slot-hold-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"slotId\":\"%s\"}".formatted(targetSlot80kId)))
                .andExpect(status().isOk())
                .andReturn();
        UUID targetHoldId = UUID.fromString(objectMapper.readTree(targetHoldResult.getResponse().getContentAsString()).path("id").asText());

        mockMvc.perform(post("/api/v1/appointments/{appointmentId}/actions/reschedule", oldAppointmentId)
                        .cookie(patientSession.cookie()).header("X-MediCore-Tab-Context", patientSession.context())
                        .header("X-CSRF-Token", patientSession.csrfToken())
                        .header("If-Match", "\"0\"")
                        .header("Idempotency-Key", "old-booking-future-slot-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetSlotHoldId\":\"%s\",\"reason\":\"Patient wants change\"}".formatted(targetHoldId)))
                .andExpect(status().isOk());
    }

    @Test
    void SC_R1_RESCHEDULE_07_patientTopUpRejectedWithin24HoursOfSourceSlot() throws Exception {
        UUID patientId = insertPatient("TopUp Cutoff Patient");
        AuthSession patientSession = sessionWithPatient(patientId);
        UUID oldAppointmentId = createPaidAppointment(patientSession, targetSlot50kId, patientId, new BigDecimal("50000.00"));
        moveSlotTo(targetSlot50kId, Instant.now().plus(23, ChronoUnit.HOURS));
        UUID targetHoldId = createFixtureSlotHold(patientSession, targetSlot80kId, patientId);

        mockMvc.perform(post("/api/v1/appointments/{appointmentId}/actions/reschedule-top-up", oldAppointmentId)
                        .cookie(patientSession.cookie()).header("X-MediCore-Tab-Context", patientSession.context())
                        .header("X-CSRF-Token", patientSession.csrfToken())
                        .header("If-Match", "\"0\"")
                        .header("Idempotency-Key", "topup-cutoff-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetSlotHoldId\":\"%s\"}".formatted(targetHoldId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SELF_SERVICE_RESCHEDULE_WINDOW_CLOSED"));

        assertThat(jdbc().queryForObject("select count(*) from reschedule_top_up where old_appointment_id = ?", Integer.class, oldAppointmentId))
                .isZero();
    }

    @Test
    void SC_R1_RESCHEDULE_08_staffExceptionAllowedWithin24HoursWithReason() throws Exception {
        UUID patientId = insertPatient("Staff Exception Patient");
        AuthSession patientSession = sessionWithPatient(patientId);
        AuthSession staffSession = session(Set.of(CATALOG_ADMIN_ROLE_ID));
        UUID oldAppointmentId = createPaidAppointment(patientSession, slot80kId, patientId, new BigDecimal("80000.00"));
        moveSlotTo(slot80kId, Instant.now().plus(23, ChronoUnit.HOURS));
        UUID targetHoldId = createFixtureSlotHold(patientSession, targetSlot80kId, patientId);

        mockMvc.perform(post("/api/v1/appointments/{appointmentId}/actions/reschedule", oldAppointmentId)
                        .cookie(staffSession.cookie()).header("X-MediCore-Tab-Context", staffSession.context())
                        .header("X-CSRF-Token", staffSession.csrfToken())
                        .header("If-Match", "\"0\"")
                        .header("Idempotency-Key", "staff-resched-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetSlotHoldId\":\"%s\",\"reason\":\"Front-desk medical emergency reschedule\"}".formatted(targetHoldId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.differenceDisposition").value("NONE"));

        assertThat(jdbc().queryForObject("select status from appointment where id = ?", String.class, oldAppointmentId))
                .isEqualTo("RESCHEDULED");
    }

    @Test
    void SC_R1_RESCHEDULE_09_staffExceptionRejectedWithin24HoursWithoutReason() throws Exception {
        UUID patientId = insertPatient("Staff No Reason Patient");
        AuthSession patientSession = sessionWithPatient(patientId);
        AuthSession staffSession = session(Set.of(CATALOG_ADMIN_ROLE_ID));
        UUID oldAppointmentId = createPaidAppointment(patientSession, slot80kId, patientId, new BigDecimal("80000.00"));
        moveSlotTo(slot80kId, Instant.now().plus(23, ChronoUnit.HOURS));
        UUID targetHoldId = createFixtureSlotHold(patientSession, targetSlot80kId, patientId);

        mockMvc.perform(post("/api/v1/appointments/{appointmentId}/actions/reschedule", oldAppointmentId)
                        .cookie(staffSession.cookie()).header("X-MediCore-Tab-Context", staffSession.context())
                        .header("X-CSRF-Token", staffSession.csrfToken())
                        .header("If-Match", "\"0\"")
                        .header("Idempotency-Key", "staff-noreason-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetSlotHoldId\":\"%s\"}".formatted(targetHoldId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_INVALID_REQUEST"));
    }

    @Test
    void cancellationUsesSourceSlotCutoffAndQueuesCapturedDepositRefund() throws Exception {
        UUID patientId = insertPatient("Cancellation Future Slot Patient");
        AuthSession patientSession = sessionWithPatient(patientId);
        UUID appointmentId = createPaidAppointment(patientSession, slot80kId, patientId, new BigDecimal("80000.00"));
        jdbc().update("update appointment set created_at = now() - interval '25 hours' where id = ?", appointmentId);
        String idempotencyKey = "cancel-old-booking-" + UUID.randomUUID();

        mockMvc.perform(post("/api/v1/appointments/{appointmentId}/actions/cancel", appointmentId)
                        .cookie(patientSession.cookie()).header("X-MediCore-Tab-Context", patientSession.context())
                        .header("X-CSRF-Token", patientSession.csrfToken())
                        .header("If-Match", "\"0\"")
                        .header("Idempotency-Key", idempotencyKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"No longer available\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));

        assertThat(jdbc().queryForObject("select status from deposit_allocation where appointment_id = ?", String.class, appointmentId))
                .isEqualTo("REFUND_PENDING");
        UUID allocationId = jdbc().queryForObject(
                "select id from deposit_allocation where appointment_id = ?", UUID.class, appointmentId);
        assertThat(jdbc().queryForObject(
                "select count(*) from outbox_event where aggregate_id = ? and event_type = 'appointment.cancelled.refund_pending.v1'",
                Integer.class, allocationId)).isEqualTo(1);
        assertThat(jdbc().queryForObject(
                "select count(*) from audit_event where action = 'appointment.cancel' and outcome = 'SUCCEEDED' and resource_id = ?",
                Integer.class, appointmentId)).isEqualTo(1);

        mockMvc.perform(post("/api/v1/appointments/{appointmentId}/actions/cancel", appointmentId)
                        .cookie(patientSession.cookie()).header("X-MediCore-Tab-Context", patientSession.context())
                        .header("X-CSRF-Token", patientSession.csrfToken())
                        .header("If-Match", "\"0\"")
                        .header("Idempotency-Key", idempotencyKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"No longer available\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));
    }

    @Test
    void cancellationRejectsWithin24HoursAndStaleVersion() throws Exception {
        UUID patientId = insertPatient("Cancellation Cutoff Patient");
        AuthSession patientSession = sessionWithPatient(patientId);
        UUID appointmentId = createPaidAppointment(patientSession, slot80kId, patientId, new BigDecimal("80000.00"));
        moveSlotTo(slot80kId, Instant.now().plus(23, ChronoUnit.HOURS));

        mockMvc.perform(post("/api/v1/appointments/{appointmentId}/actions/cancel", appointmentId)
                        .cookie(patientSession.cookie()).header("X-MediCore-Tab-Context", patientSession.context())
                        .header("X-CSRF-Token", patientSession.csrfToken())
                        .header("If-Match", "\"0\"")
                        .header("Idempotency-Key", "cancel-cutoff-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"No longer available\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SELF_SERVICE_CANCEL_WINDOW_CLOSED"));

        moveSlotTo(slot80kId, Instant.now().plus(2, ChronoUnit.DAYS));
        mockMvc.perform(post("/api/v1/appointments/{appointmentId}/actions/cancel", appointmentId)
                        .cookie(patientSession.cookie()).header("X-MediCore-Tab-Context", patientSession.context())
                        .header("X-CSRF-Token", patientSession.csrfToken())
                        .header("If-Match", "\"999\"")
                        .header("Idempotency-Key", "cancel-stale-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"No longer available\"}"))
                .andExpect(status().isPreconditionFailed())
                .andExpect(jsonPath("$.code").value("CONCURRENCY_STALE_VERSION"));
    }

    @Test
    void cancellationRequiresCsrfAndValidReasonLength() throws Exception {
        UUID patientId = insertPatient("Cancellation Validation Patient");
        AuthSession patientSession = sessionWithPatient(patientId);
        UUID appointmentId = createPaidAppointment(patientSession, slot80kId, patientId, new BigDecimal("80000.00"));

        mockMvc.perform(post("/api/v1/appointments/{appointmentId}/actions/cancel", appointmentId)
                        .cookie(patientSession.cookie()).header("X-MediCore-Tab-Context", patientSession.context())
                        .header("If-Match", "\"0\"")
                        .header("Idempotency-Key", "cancel-no-csrf-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"No longer available\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));

        mockMvc.perform(post("/api/v1/appointments/{appointmentId}/actions/cancel", appointmentId)
                        .cookie(patientSession.cookie()).header("X-MediCore-Tab-Context", patientSession.context())
                        .header("X-CSRF-Token", patientSession.csrfToken())
                        .header("If-Match", "\"0\"")
                        .header("Idempotency-Key", "cancel-long-reason-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"%s\"}".formatted("x".repeat(501))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_INVALID_REQUEST"));
    }

    @Test
    void verifiedRepresentativeWithCancellationScopeCanCancel() throws Exception {
        UUID patientId = insertPatient("Representative Cancellation Patient");
        AuthSession ownerSession = sessionWithPatient(patientId);
        AuthSession representativeSession = session(Set.of(PATIENT_ROLE_ID));
        UUID appointmentId = createPaidAppointment(ownerSession, slot80kId, patientId, new BigDecimal("80000.00"));
        jdbc().update("""
                insert into patient_account_link
                    (id, patient_id, account_id, relationship, verification_tier, permission_scope,
                     status, valid_from, version, created_at, updated_at)
                values (?, ?, ?, 'PARENT', 'REPRESENTATION_VERIFIED',
                    '{"version":"1","appointment.cancel":true}'::jsonb,
                    'ACTIVE', now() - interval '1 minute', 0, now(), now())
                """, UUID.randomUUID(), patientId, representativeSession.accountId());

        mockMvc.perform(post("/api/v1/appointments/{appointmentId}/actions/cancel", appointmentId)
                        .cookie(representativeSession.cookie()).header("X-MediCore-Tab-Context", representativeSession.context())
                        .header("X-CSRF-Token", representativeSession.csrfToken())
                        .header("If-Match", "\"0\"")
                        .header("Idempotency-Key", "representative-cancel-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Parent requested cancellation\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));
    }

    private void moveSlotTo(UUID slotId, Instant startAt) {
        jdbc().update("update appointment_slot set start_at = ?, end_at = ? where id = ?",
                Timestamp.from(startAt), Timestamp.from(startAt.plus(30, ChronoUnit.MINUTES)), slotId);
    }

    private static JsonNode availabilitySlot(JsonNode items, UUID slotId) {
        for (JsonNode item : items) {
            if (slotId.toString().equals(item.path("id").asText())) {
                return item;
            }
        }
        throw new AssertionError("Availability slot not found: " + slotId);
    }

    private UUID createPaidAppointment(AuthSession session, UUID targetSlotId, UUID patientId, BigDecimal deposit) throws Exception {
        UUID holdId = createFixtureSlotHold(session, targetSlotId, patientId);

        MvcResult intentResult = mockMvc.perform(post("/api/v1/slot-holds/{holdId}/payment-intents", holdId)
                        .cookie(session.cookie()).header("X-MediCore-Tab-Context", session.context())
                        .header("X-CSRF-Token", session.csrfToken())
                        .header("Idempotency-Key", "intent-" + UUID.randomUUID()))
                .andExpect(status().isOk())
                .andReturn();

        UUID intentId = UUID.fromString(objectMapper.readTree(intentResult.getResponse().getContentAsString()).path("id").asText());

        mockMvc.perform(post("/api/v1/mock-payment-intents/{intentId}/actions/simulate", intentId)
                        .cookie(session.cookie()).header("X-MediCore-Tab-Context", session.context())
                        .header("X-CSRF-Token", session.csrfToken())
                        .header("Idempotency-Key", "sim-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"outcome\":\"SUCCEEDED\"}"))
                .andExpect(status().isAccepted());

        return jdbc().queryForObject("select id from appointment where slot_hold_id = ?", UUID.class, holdId);
    }

    private UUID createFixtureSlotHold(AuthSession session, UUID targetSlotId, UUID patientId) {
        return createRescheduleSlotHold(session, targetSlotId, patientId);
    }

    private UUID createRescheduleSlotHold(AuthSession session, UUID targetSlotId, UUID patientId) {
        UUID holdId = UUID.randomUUID();
        BigDecimal depositAmount = jdbc().queryForObject("""
                select least(price.amount, 100000.00)
                from appointment_slot slot
                join lateral (
                    select amount
                    from service_price
                    where service_id = slot.service_id
                      and currency = 'VND'
                      and effective_from <= now()
                      and (effective_to is null or effective_to > now())
                    order by effective_from desc, id desc
                    limit 1
                ) price on true
                where slot.id = ?
                """, BigDecimal.class, targetSlotId);
        jdbc().update("""
                insert into slot_hold (id, slot_id, patient_id, expires_at, deposit_amount, currency, status, version, created_at, updated_at)
                values (?, ?, ?, now() + interval '5 minutes', ?, 'VND', 'ACTIVE', 0, now(), now())
                """, holdId, targetSlotId, patientId, depositAmount);
        return holdId;
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

    private UUID insertPatient(String name) {
        UUID patientId = UUID.randomUUID();
        jdbc().update("insert into patient (id, full_name, date_of_birth, version, created_at, updated_at) " +
                "values (?, ?, date '1990-01-01', 0, now(), now())", patientId, name);
        return patientId;
    }

    private void linkPatientToAccount(UUID patientId, UUID accountId) {
        jdbc().update("""
                insert into patient_account_link
                    (id, patient_id, account_id, relationship, verification_tier, permission_scope,
                     status, valid_from, version, created_at, updated_at)
                values (?, ?, ?, 'OWN', 'IDENTITY_VERIFIED',
                    '{"version":"1","slot_hold.create":true,"slot_hold.read":true,"slot_hold.cancel":true,"payment_intent.create":true,"payment_intent.read":true,"appointment.reschedule":true,"appointment.cancel":true}'::jsonb,
                    'ACTIVE', now() - interval '1 minute', 0, now(), now())
                """, UUID.randomUUID(), patientId, accountId);
    }

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
                """, accountId, accountId + "@resched.test", accountId + "@resched.test");
        for (UUID roleId : roleIds) {
            jdbc.update("""
                    insert into account_role_assignment(id, account_id, role_id, department_id,
                        effective_from, effective_to, status, assigned_by_account_id, reason, version)
                    values (?, ?, ?, null, now() - interval '1 minute', null, 'ACTIVE', ?, 'Reschedule test', 0)
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

    private record AuthSession(UUID accountId, UUID sessionId, MockCookie cookie, String csrfToken, String context) {}
}
