package vn.medicore.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.dataformat.yaml.YAMLMapper;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
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
class OpenApiIT {

    private static final int EXPECTED_OPERATION_COUNT = 154; // R1-04 types existing Patient operations; no route count change.

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17.10");

    @Autowired
    private MockMvc mockMvc;

    private final YAMLMapper yamlMapper = new YAMLMapper();

    @Test
    void exposesOnlyFoundationPublicEndpoints() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
        mockMvc.perform(get("/api/v1/medicore.openapi.yaml"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/foundation-probe"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/swagger-ui/index.html"))
                .andExpect(status().isNotFound());
    }

    @Test
    void servesCanonicalReleaseOneOpenApiContract() throws Exception {
        byte[] responseBytes = mockMvc.perform(get("/api/v1/medicore.openapi.yaml"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();
        String response = new String(responseBytes, StandardCharsets.UTF_8);
        String canonicalContract = Files.readString(
                Path.of("..", "contracts", "openapi", "medicore.openapi.yaml"), StandardCharsets.UTF_8);
        assertThat(response).isEqualTo(canonicalContract);

        JsonNode document = yamlMapper.readTree(response);
        assertThat(document.path("openapi").asText()).isEqualTo("3.1.0");
        assertThat(document.at("/info/title").asText()).isEqualTo("MediCore API");
        assertThat(document.at("/info/version").asText()).isEqualTo("v1");
        assertThat(document.at("/servers/0/url").asText()).isEqualTo("/api/v1");

        JsonNode paths = document.path("paths");
        Set<String> operationIds = operationIds(paths);
        assertThat(operationIds).hasSize(EXPECTED_OPERATION_COUNT)
                .contains(
                        "registerAccount",
                        "createPatient",
                        "createSlotHold",
                        "receivePaymentWebhook",
                        "checkInAppointment",
                        "finalizeClinicalNoteVersion",
                        "closeBillingAccount",
                        "listMyNotifications",
                        "createRoom",
                        "listPractitionerRoles",
                        "endServicePrice",
                        "revokePractitionerRole",
                        "listPatientIdentifiers",
                        "reviewPatientDuplicateCandidate");
        assertThat(paths.path("/patients/{patientId}/identifiers").path("get")
                .at("/responses/200/content/application~1json/schema/$ref").asText())
                .endsWith("/PatientIdentifierPage");
        assertThat(paths.path("/appointment-slots").path("get")
                .at("/responses/200/content/application~1json/schema/$ref").asText())
                .endsWith("/AppointmentSlotPage");
        assertThat(paths.path("/appointment-slots/{slotId}").path("get").path("security").isArray()).isTrue();
        assertThat(paths.path("/appointment-slots/{slotId}").path("get").path("security")).isEmpty();
        assertThat(paths.path("/slot-holds").path("post")
                .at("/requestBody/content/application~1json/schema/$ref").asText())
                .endsWith("/SlotHoldRequest");
        assertThat(paths.path("/slot-holds/{holdId}").path("delete")
                .at("/responses/200/content/application~1json/schema/$ref").asText())
                .endsWith("/SlotHold");
        assertThat(document.at("/components/schemas/SlotHoldStatus/enum")).extracting(JsonNode::asText)
                .containsExactly("ACTIVE", "CONSUMED", "EXPIRED", "RELEASED");
        assertThat(document.at("/components/schemas/SlotHold/properties/idempotencyKey").isMissingNode()).isTrue();
        assertThat(document.at("/components/schemas/SlotHold/properties/requestHash").isMissingNode()).isTrue();
        assertThat(document.at("/components/schemas/SlotHold/properties/idempotencyScope").isMissingNode()).isTrue();
        assertThat(document.at("/components/schemas/SlotHold/properties/patientId/type").asText()).isEqualTo("string");
        assertThat(document.at("/components/schemas/SlotHold/properties/currency/const").asText()).isEqualTo("VND");
        assertThat(document.at("/components/schemas/SlotHold/properties/depositAmount/multipleOf").decimalValue())
                .isEqualByComparingTo("0.01");
        assertThat(document.at("/components/schemas/AppointmentSlotPage/properties/nextCursor/type").isArray()).isTrue();
        assertThat(document.at("/components/schemas/AppointmentSlotPage/properties/hasMore/type").asText()).isEqualTo("boolean");
        assertThat(document.at("/components/schemas/AppointmentSlot/properties/version/type").asText()).isEqualTo("integer");
        assertThat(document.at("/components/schemas/AppointmentSlot/properties/status/$ref").asText())
                .endsWith("/AppointmentSlotStatus");
        assertThat(document.at("/components/schemas/CreateAppointmentSlotRequest/additionalProperties").asBoolean()).isFalse();
        assertThat(document.at("/components/schemas/SlotHoldRequest/additionalProperties").asBoolean()).isFalse();
        assertThat(document.at("/components/schemas/SlotHold/properties/patientId/writeOnly").isMissingNode()).isTrue();
        assertThat(document.at("/components/schemas/SlotHold/properties/patientId").isMissingNode()).isFalse();
        assertThat(document.at("/components/schemas/SlotHold/properties/expiresAt/format").asText()).isEqualTo("date-time");
        assertThat(document.at("/components/schemas/SlotHold/properties/status/$ref").asText()).endsWith("/SlotHoldStatus");
        assertThat(document.at("/components/schemas/AppointmentSlotPage/properties/items/items/$ref").asText())
                .endsWith("/AppointmentSlot");
        assertThat(document.at("/components/schemas/SlotHoldRequest/required")).extracting(JsonNode::asText)
                .containsExactly("slotId", "patientId");
        assertThat(document.at("/components/schemas/AppointmentSlotSession/enum")).extracting(JsonNode::asText)
                .containsExactly("MORNING", "AFTERNOON");
        assertThat(document.at("/components/schemas/AppointmentSlotStatus/enum")).extracting(JsonNode::asText)
                .containsExactly("ACTIVE", "CANCELLED", "REPLACED");
        assertThat(document.at("/components/schemas/AppointmentSlotPage/additionalProperties").asBoolean()).isFalse();
        assertThat(document.at("/components/schemas/SlotHold/additionalProperties").asBoolean()).isFalse();
        assertThat(document.at("/components/schemas/SlotHold/properties/currency/type").asText()).isEqualTo("string");
        assertThat(document.at("/components/schemas/SlotHold/properties/depositAmount/type").asText()).isEqualTo("number");
        assertThat(document.at("/components/schemas/SlotHold/properties/expiresAt/type").asText()).isEqualTo("string");
        assertThat(document.at("/components/schemas/SlotHold/properties/version/minimum").asInt()).isZero();
        assertThat(document.at("/components/schemas/AppointmentSlot/properties/capacity/minimum").asInt()).isEqualTo(1);
        assertThat(paths.path("/patient-duplicate-candidates/{candidateId}/actions/review").path("post")
                .at("/requestBody/content/application~1json/schema/$ref").asText())
                .endsWith("/ReviewPatientDuplicateCandidateRequest");
        assertThat(document.at("/components/schemas/AddPatientIdentifierRequest/properties/value/writeOnly").asBoolean()).isTrue();
        assertThat(document.at("/components/schemas/PatientIdentifier/properties/protectedValue").isMissingNode()).isTrue();
        assertThat(document.at("/components/schemas/PatientIdentifier/properties/comparisonToken").isMissingNode()).isTrue();
        assertThat(document.at("/components/schemas/PatientDuplicateCandidate/properties/matchReasons/$ref").asText())
                .endsWith("/PatientDuplicateMatchReasons");
        assertThat(paths.path("/practitioners/{practitionerId}/roles").has("get")).isTrue();
        assertThat(paths.path("/departments/{departmentId}/rooms").isMissingNode()).isTrue();

        assertThat(paths.path("/appointments").has("post")).isFalse();
        assertThat(paths.path("/charge-items").has("post")).isFalse();
        assertThat(operationIds).noneMatch(id -> id.toLowerCase().startsWith("sign")
                || id.toLowerCase().startsWith("publish")
                || id.toLowerCase().startsWith("refund")
                || id.toLowerCase().contains("attestation")
                || id.toLowerCase().contains("prescription")
                || id.toLowerCase().contains("diagnostic"));
    }

    private Set<String> operationIds(JsonNode paths) {
        Set<String> result = new HashSet<>();
        Iterator<Map.Entry<String, JsonNode>> pathIterator = paths.fields();
        while (pathIterator.hasNext()) {
            JsonNode pathItem = pathIterator.next().getValue();
            Iterator<Map.Entry<String, JsonNode>> operationIterator = pathItem.fields();
            while (operationIterator.hasNext()) {
                JsonNode operation = operationIterator.next().getValue();
                if (operation.hasNonNull("operationId")) {
                    result.add(operation.path("operationId").asText());
                }
            }
        }
        return result;
    }
}
