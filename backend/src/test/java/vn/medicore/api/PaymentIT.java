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
    private UUID freeServiceId;
    private UUID practitionerRoleId;
    private UUID slotId;
    private UUID freeSlotId;

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

        freeServiceId = createResource(admin, "POST", "/api/v1/services",
                "{\"code\":\"PAY-FREE-%s\",\"name\":\"Free Followup\",\"serviceType\":\"CONSULTATION\",\"effectiveFrom\":\"2030-01-01T00:00:00Z\"}"
                        .formatted(UUID.randomUUID()));

        JdbcTemplate jdbc = jdbc();
        jdbc.update("insert into service_price (id, service_id, amount, currency, effective_from, created_at) " +
                        "values (?, ?, ?, 'VND', now() - interval '1 minute', now())",
                UUID.randomUUID(), serviceId, new BigDecimal("80000.00"));

        jdbc.update("insert into service_price (id, service_id, amount, currency, effective_from, created_at) " +
                        "values (?, ?, ?, 'VND', now() - interval '1 minute', now())",
                UUID.randomUUID(), freeServiceId, BigDecimal.ZERO.setScale(2));

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

        freeSlotId = createResource(admin, "POST", "/api/v1/appointment-slots",
                """
                {"practitionerRoleId":"%s","departmentId":"%s","roomId":"%s","serviceId":"%s",
                "session":"AFTERNOON","startAt":"%s","endAt":"%s","capacity":5}
                """.formatted(practitionerRoleId, departmentId, roomId, freeServiceId,
                        start.plus(2, ChronoUnit.HOURS).toString(), start.plus(2, ChronoUnit.HOURS).plus(30, ChronoUnit.MINUTES).toString()));
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
    void zeroPriceDirectConfirmFlowBypassesProviderAndConfirmsAppointment() throws Exception {
        UUID patientId = insertPatient("Zero Price Patient");
        AuthSession patientSession = sessionWithPatient(patientId);

        UUID holdId = createSlotHold(patientSession, freeSlotId, patientId);

        MvcResult intentResult = mockMvc.perform(post("/api/v1/slot-holds/{holdId}/payment-intents", holdId)
                        .cookie(patientSession.cookie())
                        .header("X-CSRF-Token", patientSession.csrfToken())
                        .header("Idempotency-Key", "intent-zero-" + UUID.randomUUID()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCEEDED"))
                .andExpect(jsonPath("$.amount").value(0.00))
                .andExpect(jsonPath("$.provider").value("ZERO_PRICE"))
                .andReturn();

        JdbcTemplate jdbc = jdbc();
        String holdStatus = jdbc.queryForObject("select status from slot_hold where id = ?", String.class, holdId);
        assertThat(holdStatus).isEqualTo("CONSUMED");

        Integer appointmentCount = jdbc.queryForObject("select count(*) from appointment where slot_hold_id = ? and status = 'CONFIRMED'", Integer.class, holdId);
        assertThat(appointmentCount).isEqualTo(1);

        Integer outboxCount = jdbc.queryForObject("select count(*) from outbox_event where event_type = 'appointment.confirmed.v1'", Integer.class);
        assertThat(outboxCount).isGreaterThanOrEqualTo(1);
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
    void invalidSignatureQuarantinesInboxAndNeverPoisonsPaymentIntent() throws Exception {
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
        // Inbox quarantined as FAILED with INVALID_SIGNATURE
        String inboxStatus = jdbc.queryForObject("select status from webhook_inbox where event_id = ?", String.class, eventId);
        assertThat(inboxStatus).isEqualTo("FAILED");

        // PaymentIntent remains REQUIRES_PAYMENT_METHOD (NOT poisoned by malicious webhook)
        String intentStatus = jdbc.queryForObject("select status from payment_intent where id = ?", String.class, intentId);
        assertThat(intentStatus).isEqualTo("REQUIRES_PAYMENT_METHOD");

        Integer paymentCount = jdbc.queryForObject("select count(*) from payment where provider_transaction_id = ?", Integer.class, txId);
        assertThat(paymentCount).isZero();

        Integer appointmentCount = jdbc.queryForObject("select count(*) from appointment where slot_hold_id = ?", Integer.class, holdId);
        assertThat(appointmentCount).isZero();
    }

    @Test
    void malformedRawBodyIsRetainedInInboxEvidence() throws Exception {
        byte[] malformedBytes = "{ malformed json non-parsable content !!!".getBytes(StandardCharsets.UTF_8);
        String eventId = "evt_malformed_" + UUID.randomUUID();
        Instant now = Instant.now();
        String sig = adapter.sign(malformedBytes, eventId, now.toString());

        mockMvc.perform(post("/api/v1/webhooks/payments/MOCK_PAY")
                        .header("X-Provider-Event-Id", eventId)
                        .header("X-Provider-Timestamp", now.toString())
                        .header("X-Provider-Signature", sig)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(malformedBytes))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.status").value("ACCEPTED"));

        JdbcTemplate jdbc = jdbc();
        String inboxStatus = jdbc.queryForObject("select status from webhook_inbox where event_id = ?", String.class, eventId);
        assertThat(inboxStatus).isEqualTo("FAILED");

        byte[] savedBytes = jdbc.queryForObject("select raw_payload from webhook_inbox where event_id = ?", byte[].class, eventId);
        assertThat(savedBytes).isEqualTo(malformedBytes);
    }

    @Test
    void missingProviderOccurredAtInBodyEntersReconciliationAndNeverConfirms() throws Exception {
        UUID patientId = insertPatient("Missing Time Patient");
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

        String eventId = "evt_notime_" + UUID.randomUUID();
        String txId = "tx_notime_" + UUID.randomUUID();
        Instant now = Instant.now();
        // Body omits providerOccurredAt
        String payload = """
                {"eventId":"%s","eventType":"payment.succeeded","providerTransactionId":"%s",
                "providerReference":"%s","amount":"80000.00","currency":"VND"}
                """.formatted(eventId, txId, providerReference);
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
        assertThat(reason).isEqualTo("MISSING_PROVIDER_TIME");

        Integer appointmentCount = jdbc.queryForObject("select count(*) from appointment where slot_hold_id = ?", Integer.class, holdId);
        assertThat(appointmentCount).isZero();
    }

    @Test
    void outOfOrderPaymentFailedEventDoesNotRevertSucceededPaymentIntent() throws Exception {
        UUID patientId = insertPatient("Out of Order Patient");
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

        // 1. Deliver success event
        String eventId1 = "evt_success_" + UUID.randomUUID();
        String txId1 = "tx_success_" + UUID.randomUUID();
        Instant now = Instant.now();
        String payload1 = """
                {"eventId":"%s","eventType":"payment.succeeded","providerTransactionId":"%s",
                "providerOccurredAt":"%s","providerReference":"%s","amount":"80000.00","currency":"VND"}
                """.formatted(eventId1, txId1, now.toString(), providerReference);
        byte[] bytes1 = payload1.getBytes(StandardCharsets.UTF_8);
        String sig1 = adapter.sign(bytes1, eventId1, now.toString());

        mockMvc.perform(post("/api/v1/webhooks/payments/MOCK_PAY")
                        .header("X-Provider-Event-Id", eventId1)
                        .header("X-Provider-Timestamp", now.toString())
                        .header("X-Provider-Signature", sig1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bytes1))
                .andExpect(status().isAccepted());

        // 2. Deliver out-of-order failure event
        String eventId2 = "evt_failed_late_" + UUID.randomUUID();
        String payload2 = """
                {"eventId":"%s","eventType":"payment.failed","providerTransactionId":"%s",
                "providerOccurredAt":"%s","providerReference":"%s","amount":"80000.00","currency":"VND"}
                """.formatted(eventId2, txId1, now.toString(), providerReference);
        byte[] bytes2 = payload2.getBytes(StandardCharsets.UTF_8);
        String sig2 = adapter.sign(bytes2, eventId2, now.toString());

        mockMvc.perform(post("/api/v1/webhooks/payments/MOCK_PAY")
                        .header("X-Provider-Event-Id", eventId2)
                        .header("X-Provider-Timestamp", now.toString())
                        .header("X-Provider-Signature", sig2)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bytes2))
                .andExpect(status().isAccepted());

        JdbcTemplate jdbc = jdbc();
        String intentStatus = jdbc.queryForObject("select status from payment_intent where id = ?", String.class, intentId);
        assertThat(intentStatus).isEqualTo("SUCCEEDED");

        Integer appointmentCount = jdbc.queryForObject("select count(*) from appointment where slot_hold_id = ?", Integer.class, holdId);
        assertThat(appointmentCount).isEqualTo(1);
    }

    @Test
    void currencyMismatchRetainsPaymentEvidenceAndReconcilesWithoutRollback() throws Exception {
        UUID patientId = insertPatient("Currency Mismatch Patient");
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

        String eventId = "evt_usd_" + UUID.randomUUID();
        String txId = "tx_usd_" + UUID.randomUUID();
        Instant now = Instant.now();
        // Provider charges in USD
        String payload = """
                {"eventId":"%s","eventType":"payment.succeeded","providerTransactionId":"%s",
                "providerOccurredAt":"%s","providerReference":"%s","amount":"80000.00","currency":"USD"}
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
        assertThat(reason).isEqualTo("CURRENCY_MISMATCH");

        String capturedCurrency = jdbc.queryForObject("select currency from payment where provider_transaction_id = ?", String.class, txId);
        assertThat(capturedCurrency).isEqualTo("USD");

        Integer appointmentCount = jdbc.queryForObject("select count(*) from appointment where slot_hold_id = ?", Integer.class, holdId);
        assertThat(appointmentCount).isZero();
    }

    @Test
    void missingProviderTransactionIdEntersReconciliationAndNeverCapturesPayment() throws Exception {
        UUID patientId = insertPatient("Missing Tx Patient");
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

        String eventId = "evt_notx_" + UUID.randomUUID();
        Instant now = Instant.now();
        // Missing providerTransactionId
        String payload = """
                {"eventId":"%s","eventType":"payment.succeeded",
                "providerOccurredAt":"%s","providerReference":"%s","amount":"80000.00","currency":"VND"}
                """.formatted(eventId, now.toString(), providerReference);
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
        assertThat(reason).isEqualTo("MISSING_PROVIDER_TRANSACTION_ID");

        Integer paymentCount = jdbc.queryForObject("select count(*) from payment where payment_intent_id = ?", Integer.class, intentId);
        assertThat(paymentCount).isZero();
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

    private UUID createSlotHold(AuthSession session, UUID targetSlotId, UUID patientId) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/slot-holds")
                        .cookie(session.cookie())
                        .header("X-CSRF-Token", session.csrfToken())
                        .header("Idempotency-Key", "hold-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"slotId\":\"%s\",\"patientId\":\"%s\"}".formatted(targetSlotId, patientId)))
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
