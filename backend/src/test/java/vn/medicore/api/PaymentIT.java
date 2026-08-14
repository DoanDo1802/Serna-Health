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
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
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

@Testcontainers
@SpringBootTest(classes = MediCoreApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PaymentIT {

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

    private UUID departmentId;
    private UUID roomId;
    private UUID serviceId;
    private UUID practitionerRoleId;
    private UUID slotId;

    @BeforeEach
    void setupFixtures() throws Exception {
        AuthSession admin = session(Set.of(CATALOG_ADMIN_ROLE_ID));

        departmentId = createResource(admin, "POST", "/api/v1/departments",
                "{\"code\":\"PAY-DEPT-%s\",\"name\":\"Payment Dept\",\"effectiveFrom\":\"2030-01-01T00:00:00Z\"}"
                        .formatted(UUID.randomUUID()));

        roomId = createResource(admin, "POST", "/api/v1/rooms",
                "{\"departmentId\":\"%s\",\"code\":\"PAY-ROOM-%s\",\"name\":\"Room A\",\"effectiveFrom\":\"2030-01-01T00:00:00Z\"}"
                        .formatted(departmentId, UUID.randomUUID()));

        serviceId = createResource(admin, "POST", "/api/v1/services",
                "{\"code\":\"PAY-SVC-%s\",\"name\":\"Consultation\",\"serviceType\":\"CONSULTATION\",\"effectiveFrom\":\"2030-01-01T00:00:00Z\"}"
                        .formatted(UUID.randomUUID()));

        JdbcTemplate jdbc = jdbc();
        jdbc.update("insert into service_price (id, service_id, amount, currency, effective_from, created_at) " +
                        "values (?, ?, ?, 'VND', now() - interval '1 minute', now())",
                UUID.randomUUID(), serviceId, new BigDecimal("80000.00"));

        UUID practitionerId = UUID.randomUUID();
        jdbc.update("insert into practitioner (id, staff_code, full_name, active, created_at, updated_at) " +
                        "values (?, ?, 'Dr. Payment', true, now(), now())",
                practitionerId, "PAY-" + UUID.randomUUID());

        practitionerRoleId = UUID.randomUUID();
        jdbc.update("insert into practitioner_role (id, practitioner_id, department_id, role_code, status, effective_from, created_at, updated_at) " +
                        "values (?, ?, ?, 'DOCTOR', 'ACTIVE', now(), now(), now())",
                practitionerRoleId, practitionerId, departmentId);

        Instant start = Instant.now().plus(1, ChronoUnit.DAYS);
        slotId = createResource(admin, "POST", "/api/v1/appointment-slots",
                """
                {"practitionerRoleId":"%s","departmentId":"%s","roomId":"%s","serviceId":"%s",
                "session":"MORNING","startAt":"%s","endAt":"%s","capacity":5}
                """.formatted(practitionerRoleId, departmentId, roomId, serviceId,
                        start.toString(), start.plus(30, ChronoUnit.MINUTES).toString()));
    }

    @Test
    void SC_R1_PAY_01_timelyTrustedPaymentAtomicallyCapturesConfirmsAppointmentAndEmitsOutbox() throws Exception {
        UUID patientId = insertPatient("Happy Path Patient");
        AuthSession patientSession = sessionWithPatient(patientId);

        // 1. Create slot hold
        UUID holdId = createSlotHold(patientSession, slotId, patientId);

        // 2. Create payment intent
        MvcResult intentResult = mockMvc.perform(post("/api/v1/slot-holds/{holdId}/payment-intents", holdId)
                        .cookie(patientSession.cookie())
                        .header("X-CSRF-Token", patientSession.csrfToken())
                        .header("Idempotency-Key", "intent-" + UUID.randomUUID()))
                .andExpect(status().isOk())
                .andExpect(header().exists("ETag"))
                .andExpect(jsonPath("$.status").value("REQUIRES_PAYMENT_METHOD"))
                .andExpect(jsonPath("$.amount").value(80000.00))
                .andExpect(jsonPath("$.currency").value("VND"))
                .andExpect(jsonPath("$.provider").value("MOCK_PAY"))
                .andReturn();

        JsonNode intentJson = objectMapper.readTree(intentResult.getResponse().getContentAsString());
        UUID intentId = UUID.fromString(intentJson.path("id").asText());
        String providerReference = intentJson.path("providerReference").asText();

        // 3. Simulate mock payment outcome via simulation endpoint
        mockMvc.perform(post("/api/v1/mock-payment-intents/{intentId}/actions/simulate", intentId)
                        .cookie(patientSession.cookie())
                        .header("X-CSRF-Token", patientSession.csrfToken())
                        .header("Idempotency-Key", "sim-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"outcome\":\"SUCCEEDED\"}"))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.status").value("ACCEPTED"));

        // 4. Assert DB state: Payment CAPTURED, Intent SUCCEEDED, Hold CONSUMED, Appointment CONFIRMED, Outbox PENDING
        JdbcTemplate jdbc = jdbc();
        String paymentStatus = jdbc.queryForObject("select status from payment where payment_intent_id = ?", String.class, intentId);
        assertThat(paymentStatus).isEqualTo("CAPTURED");

        String updatedIntentStatus = jdbc.queryForObject("select status from payment_intent where id = ?", String.class, intentId);
        assertThat(updatedIntentStatus).isEqualTo("SUCCEEDED");

        String holdStatus = jdbc.queryForObject("select status from slot_hold where id = ?", String.class, holdId);
        assertThat(holdStatus).isEqualTo("CONSUMED");

        Integer appointmentCount = jdbc.queryForObject("select count(*) from appointment where slot_hold_id = ? and status = 'CONFIRMED'", Integer.class, holdId);
        assertThat(appointmentCount).isEqualTo(1);

        Integer outboxCount = jdbc.queryForObject("select count(*) from outbox_event where event_type = 'payment.captured.v1'", Integer.class);
        assertThat(outboxCount).isGreaterThanOrEqualTo(1);

        // 5. Query payment-intent API
        mockMvc.perform(get("/api/v1/payment-intents/{intentId}", intentId)
                        .cookie(patientSession.cookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCEEDED"));
    }

    @Test
    void webhookDuplicateDeliveryIsDeduplicatedAtInboxBoundary() throws Exception {
        UUID patientId = insertPatient("Webhook Dedup Patient");
        AuthSession patientSession = sessionWithPatient(patientId);
        UUID holdId = createSlotHold(patientSession, slotId, patientId);

        MvcResult intentResult = mockMvc.perform(post("/api/v1/slot-holds/{holdId}/payment-intents", holdId)
                        .cookie(patientSession.cookie())
                        .header("X-CSRF-Token", patientSession.csrfToken())
                        .header("Idempotency-Key", "intent-" + UUID.randomUUID()))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode intentJson = objectMapper.readTree(intentResult.getResponse().getContentAsString());
        String providerReference = intentJson.path("providerReference").asText();

        String eventId = "evt_dedup_" + UUID.randomUUID();
        String txId = "tx_dedup_" + UUID.randomUUID();
        Instant now = Instant.now();
        String payload = """
                {"eventId":"%s","eventType":"payment.succeeded","providerTransactionId":"%s",
                "providerOccurredAt":"%s","providerReference":"%s","amount":"80000.00","currency":"VND"}
                """.formatted(eventId, txId, now.toString(), providerReference);
        byte[] payloadBytes = payload.getBytes(StandardCharsets.UTF_8);
        String sig = adapter.sign(payloadBytes, eventId, now.toString());

        // First delivery
        mockMvc.perform(post("/api/v1/webhooks/payments/MOCK_PAY")
                        .header("X-Provider-Event-Id", eventId)
                        .header("X-Provider-Timestamp", now.toString())
                        .header("X-Provider-Signature", sig)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payloadBytes))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.status").value("ACCEPTED"));

        // Second duplicate delivery with same eventId
        mockMvc.perform(post("/api/v1/webhooks/payments/MOCK_PAY")
                        .header("X-Provider-Event-Id", eventId)
                        .header("X-Provider-Timestamp", now.toString())
                        .header("X-Provider-Signature", sig)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payloadBytes))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.status").value("ACCEPTED"));

        JdbcTemplate jdbc = jdbc();
        Integer paymentCount = jdbc.queryForObject("select count(*) from payment where provider_transaction_id = ?", Integer.class, txId);
        assertThat(paymentCount).isEqualTo(1);

        Integer appointmentCount = jdbc.queryForObject("select count(*) from appointment where slot_hold_id = ?", Integer.class, holdId);
        assertThat(appointmentCount).isEqualTo(1);
    }

    @Test
    void invalidSignatureNeverCapturesPaymentOrCreatesAppointment() throws Exception {
        UUID patientId = insertPatient("Invalid Sig Patient");
        AuthSession patientSession = sessionWithPatient(patientId);
        UUID holdId = createSlotHold(patientSession, slotId, patientId);

        MvcResult intentResult = mockMvc.perform(post("/api/v1/slot-holds/{holdId}/payment-intents", holdId)
                        .cookie(patientSession.cookie())
                        .header("X-CSRF-Token", patientSession.csrfToken())
                        .header("Idempotency-Key", "intent-" + UUID.randomUUID()))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode intentJson = objectMapper.readTree(intentResult.getResponse().getContentAsString());
        UUID intentId = UUID.fromString(intentJson.path("id").asText());
        String providerReference = intentJson.path("providerReference").asText();

        String eventId = "evt_invalid_" + UUID.randomUUID();
        String txId = "tx_invalid_" + UUID.randomUUID();
        Instant now = Instant.now();
        String payload = """
                {"eventId":"%s","eventType":"payment.succeeded","providerTransactionId":"%s",
                "providerOccurredAt":"%s","providerReference":"%s","amount":"80000.00","currency":"VND"}
                """.formatted(eventId, txId, now.toString(), providerReference);

        mockMvc.perform(post("/api/v1/webhooks/payments/MOCK_PAY")
                        .header("X-Provider-Event-Id", eventId)
                        .header("X-Provider-Timestamp", now.toString())
                        .header("X-Provider-Signature", "v1=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload.getBytes(StandardCharsets.UTF_8)))
                .andExpect(status().isAccepted());

        JdbcTemplate jdbc = jdbc();
        Integer paymentCount = jdbc.queryForObject("select count(*) from payment where provider_transaction_id = ?", Integer.class, txId);
        assertThat(paymentCount).isZero();

        Integer appointmentCount = jdbc.queryForObject("select count(*) from appointment where slot_hold_id = ?", Integer.class, holdId);
        assertThat(appointmentCount).isZero();

        String intentStatus = jdbc.queryForObject("select status from payment_intent where id = ?", String.class, intentId);
        assertThat(intentStatus).isEqualTo("RECONCILIATION_REQUIRED");

        String reconciliationReason = jdbc.queryForObject("select reconciliation_reason from payment_intent where id = ?", String.class, intentId);
        assertThat(reconciliationReason).isEqualTo("INVALID_SIGNATURE");
    }

    @Test
    void latePaymentOccurredAfterHoldExpiryMarksReconciliationRequiredAndNoAppointment() throws Exception {
        UUID patientId = insertPatient("Late Payment Patient");
        AuthSession patientSession = sessionWithPatient(patientId);
        UUID holdId = createSlotHold(patientSession, slotId, patientId);

        MvcResult intentResult = mockMvc.perform(post("/api/v1/slot-holds/{holdId}/payment-intents", holdId)
                        .cookie(patientSession.cookie())
                        .header("X-CSRF-Token", patientSession.csrfToken())
                        .header("Idempotency-Key", "intent-" + UUID.randomUUID()))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode intentJson = objectMapper.readTree(intentResult.getResponse().getContentAsString());
        UUID intentId = UUID.fromString(intentJson.path("id").asText());
        String providerReference = intentJson.path("providerReference").asText();

        // Expire hold in DB
        JdbcTemplate jdbc = jdbc();
        jdbc.update("update slot_hold set created_at = now() - interval '10 minutes', expires_at = now() - interval '5 minutes' where id = ?", holdId);

        // Simulate payment with occurred time after hold expiry
        Instant occurredTime = Instant.now();
        String eventId = "evt_late_" + UUID.randomUUID();
        String txId = "tx_late_" + UUID.randomUUID();
        String payload = """
                {"eventId":"%s","eventType":"payment.succeeded","providerTransactionId":"%s",
                "providerOccurredAt":"%s","providerReference":"%s","amount":"80000.00","currency":"VND"}
                """.formatted(eventId, txId, occurredTime.toString(), providerReference);
        byte[] payloadBytes = payload.getBytes(StandardCharsets.UTF_8);
        String sig = adapter.sign(payloadBytes, eventId, occurredTime.toString());

        mockMvc.perform(post("/api/v1/webhooks/payments/MOCK_PAY")
                        .header("X-Provider-Event-Id", eventId)
                        .header("X-Provider-Timestamp", occurredTime.toString())
                        .header("X-Provider-Signature", sig)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payloadBytes))
                .andExpect(status().isAccepted());

        // Assert: payment CAPTURED (money evidence), intent RECONCILIATION_REQUIRED, NO appointment, hold EXPIRED
        String paymentStatus = jdbc.queryForObject("select status from payment where provider_transaction_id = ?", String.class, txId);
        assertThat(paymentStatus).isEqualTo("CAPTURED");

        String intentStatus = jdbc.queryForObject("select status from payment_intent where id = ?", String.class, intentId);
        assertThat(intentStatus).isEqualTo("RECONCILIATION_REQUIRED");

        String reason = jdbc.queryForObject("select reconciliation_reason from payment_intent where id = ?", String.class, intentId);
        assertThat(reason).isEqualTo("LATE_PAYMENT_AFTER_HOLD_EXPIRY");

        Integer appointmentCount = jdbc.queryForObject("select count(*) from appointment where slot_hold_id = ?", Integer.class, holdId);
        assertThat(appointmentCount).isZero();
    }

    @Test
    void amountMismatchMarksReconciliationRequiredAndNeverCreatesAppointment() throws Exception {
        UUID patientId = insertPatient("Amount Mismatch Patient");
        AuthSession patientSession = sessionWithPatient(patientId);
        UUID holdId = createSlotHold(patientSession, slotId, patientId);

        MvcResult intentResult = mockMvc.perform(post("/api/v1/slot-holds/{holdId}/payment-intents", holdId)
                        .cookie(patientSession.cookie())
                        .header("X-CSRF-Token", patientSession.csrfToken())
                        .header("Idempotency-Key", "intent-" + UUID.randomUUID()))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode intentJson = objectMapper.readTree(intentResult.getResponse().getContentAsString());
        UUID intentId = UUID.fromString(intentJson.path("id").asText());
        String providerReference = intentJson.path("providerReference").asText();

        String eventId = "evt_mismatch_" + UUID.randomUUID();
        String txId = "tx_mismatch_" + UUID.randomUUID();
        Instant now = Instant.now();
        String payload = """
                {"eventId":"%s","eventType":"payment.succeeded","providerTransactionId":"%s",
                "providerOccurredAt":"%s","providerReference":"%s","amount":"50000.00","currency":"VND"}
                """.formatted(eventId, txId, now.toString(), providerReference);
        byte[] payloadBytes = payload.getBytes(StandardCharsets.UTF_8);
        String sig = adapter.sign(payloadBytes, eventId, now.toString());

        mockMvc.perform(post("/api/v1/webhooks/payments/MOCK_PAY")
                        .header("X-Provider-Event-Id", eventId)
                        .header("X-Provider-Timestamp", now.toString())
                        .header("X-Provider-Signature", sig)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payloadBytes))
                .andExpect(status().isAccepted());

        JdbcTemplate jdbc = jdbc();
        String intentStatus = jdbc.queryForObject("select status from payment_intent where id = ?", String.class, intentId);
        assertThat(intentStatus).isEqualTo("RECONCILIATION_REQUIRED");

        String reason = jdbc.queryForObject("select reconciliation_reason from payment_intent where id = ?", String.class, intentId);
        assertThat(reason).isEqualTo("AMOUNT_MISMATCH");

        Integer appointmentCount = jdbc.queryForObject("select count(*) from appointment where slot_hold_id = ?", Integer.class, holdId);
        assertThat(appointmentCount).isZero();
    }

    @Test
    void providerFailureEventMarksPaymentIntentFailed() throws Exception {
        UUID patientId = insertPatient("Provider Failure Patient");
        AuthSession patientSession = sessionWithPatient(patientId);
        UUID holdId = createSlotHold(patientSession, slotId, patientId);

        MvcResult intentResult = mockMvc.perform(post("/api/v1/slot-holds/{holdId}/payment-intents", holdId)
                        .cookie(patientSession.cookie())
                        .header("X-CSRF-Token", patientSession.csrfToken())
                        .header("Idempotency-Key", "intent-" + UUID.randomUUID()))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode intentJson = objectMapper.readTree(intentResult.getResponse().getContentAsString());
        UUID intentId = UUID.fromString(intentJson.path("id").asText());
        String providerReference = intentJson.path("providerReference").asText();

        String eventId = "evt_fail_" + UUID.randomUUID();
        String txId = "tx_fail_" + UUID.randomUUID();
        Instant now = Instant.now();
        String payload = """
                {"eventId":"%s","eventType":"payment.failed","providerTransactionId":"%s",
                "providerOccurredAt":"%s","providerReference":"%s","amount":"80000.00","currency":"VND"}
                """.formatted(eventId, txId, now.toString(), providerReference);
        byte[] payloadBytes = payload.getBytes(StandardCharsets.UTF_8);
        String sig = adapter.sign(payloadBytes, eventId, now.toString());

        mockMvc.perform(post("/api/v1/webhooks/payments/MOCK_PAY")
                        .header("X-Provider-Event-Id", eventId)
                        .header("X-Provider-Timestamp", now.toString())
                        .header("X-Provider-Signature", sig)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payloadBytes))
                .andExpect(status().isAccepted());

        JdbcTemplate jdbc = jdbc();
        String intentStatus = jdbc.queryForObject("select status from payment_intent where id = ?", String.class, intentId);
        assertThat(intentStatus).isEqualTo("FAILED");

        Integer appointmentCount = jdbc.queryForObject("select count(*) from appointment where slot_hold_id = ?", Integer.class, holdId);
        assertThat(appointmentCount).isZero();
    }

    @Test
    void customerAndDelegateAuthorizationEnforcedOnIntentEndpoints() throws Exception {
        UUID ownerPatientId = insertPatient("Owner Patient");
        UUID otherPatientId = insertPatient("Other Patient");
        AuthSession ownerSession = sessionWithPatient(ownerPatientId);
        AuthSession otherSession = sessionWithPatient(otherPatientId);

        UUID holdId = createSlotHold(ownerSession, slotId, ownerPatientId);

        // Other session cannot create payment intent on owner's hold
        mockMvc.perform(post("/api/v1/slot-holds/{holdId}/payment-intents", holdId)
                        .cookie(otherSession.cookie())
                        .header("X-CSRF-Token", otherSession.csrfToken())
                        .header("Idempotency-Key", "intent-" + UUID.randomUUID()))
                .andExpect(status().isForbidden());

        // Owner can create intent
        MvcResult intentResult = mockMvc.perform(post("/api/v1/slot-holds/{holdId}/payment-intents", holdId)
                        .cookie(ownerSession.cookie())
                        .header("X-CSRF-Token", ownerSession.csrfToken())
                        .header("Idempotency-Key", "intent-" + UUID.randomUUID()))
                .andExpect(status().isOk())
                .andReturn();

        UUID intentId = UUID.fromString(objectMapper.readTree(intentResult.getResponse().getContentAsString()).path("id").asText());

        // Other session cannot read owner's intent
        mockMvc.perform(get("/api/v1/payment-intents/{intentId}", intentId)
                        .cookie(otherSession.cookie()))
                .andExpect(status().isForbidden());

        // Owner can read intent
        mockMvc.perform(get("/api/v1/payment-intents/{intentId}", intentId)
                        .cookie(ownerSession.cookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(intentId.toString()));
    }

    private UUID createSlotHold(AuthSession session, UUID slotId, UUID patientId) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/slot-holds")
                        .cookie(session.cookie())
                        .header("X-CSRF-Token", session.csrfToken())
                        .header("Idempotency-Key", "hold-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"slotId\":\"%s\",\"patientId\":\"%s\"}".formatted(slotId, patientId)))
                .andExpect(status().isOk())
                .andReturn();
        return UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString()).path("id").asText());
    }

    private UUID createResource(AuthSession session, String method, String path, String body) throws Exception {
        MvcResult result = mockMvc.perform(post(path)
                        .cookie(session.cookie())
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
                    '{"version":"1","slot_hold.create":true,"slot_hold.read":true,"slot_hold.cancel":true,"payment_intent.create":true,"payment_intent.read":true}'::jsonb,
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
                """, accountId, accountId + "@sched.test", accountId + "@sched.test");
        for (UUID roleId : roleIds) {
            jdbc.update("""
                    insert into account_role_assignment(id, account_id, role_id, department_id,
                        effective_from, effective_to, status, assigned_by_account_id, reason, version)
                    values (?, ?, ?, null, now() - interval '1 minute', null, 'ACTIVE', ?, 'Scheduling test', 0)
                    """, UUID.randomUUID(), accountId, roleId, accountId);
        }
        jdbc.update("""
                insert into account_session(id, account_id, session_token_hash, csrf_token_hash, status,
                    authenticated_at, last_seen_at, absolute_expires_at, version)
                values (?, ?, ?, ?, 'ACTIVE', now(), now(), now() + interval '1 hour', 0)
                """, sessionId, accountId,
                secretHasher.hash("SESSION", rawSession), secretHasher.hash("CSRF", csrfToken));
        return new AuthSession(accountId, sessionId, new MockCookie("MEDICORE_SESSION", rawSession), csrfToken);
    }

    private JdbcTemplate jdbc() {
        return new JdbcTemplate(dataSource);
    }

    private record AuthSession(UUID accountId, UUID sessionId, MockCookie cookie, String csrfToken) {}
}
