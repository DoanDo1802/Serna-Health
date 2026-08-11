package vn.medicore.patient;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import vn.medicore.common.utils.UuidV7Generator;
import vn.medicore.dto.PatientAuditContext;
import vn.medicore.dto.PatientModels.PatientDuplicateCandidateView;
import vn.medicore.dto.PatientModels.PatientView;
import vn.medicore.service.PatientService;

@Testcontainers
@SpringBootTest
@ActiveProfiles("test")
class PatientIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17.10");

    @Autowired
    private PatientService patientService;

    @Autowired
    private UuidV7Generator ids;

    @Autowired
    private DataSource dataSource;

    @Test
    void SC_R1_PAT_01_suspected_duplicate_is_detected_and_reviewed() {
        UUID actorId = ids.next();
        new JdbcTemplate(dataSource).update("""
                insert into user_account(id, normalized_email, display_email, status, failed_login_count, version, created_at, updated_at)
                values (?, ?, ?, 'ACTIVE', 0, 0, now(), now())
                """, actorId, "reviewer@example.com", "reviewer@example.com");
        PatientAuditContext context = new PatientAuditContext(actorId, UUID.randomUUID().toString(),
                Map.of("permissions", List.of("patient.create", "patient_duplicate.review")), "patient-it-request", "patient-it-correlation");
        String fullName = "Nguyen Van A";
        LocalDate dob = LocalDate.of(1990, 1, 1);
        String phone = "0901234567";

        PatientView patient1 = patientService.createPatient(fullName, dob, phone, "a@example.com", "MALE", "Hanoi", null, context);
        PatientView patient2 = patientService.createPatient(fullName, dob, phone, "a2@example.com", "MALE", "Hanoi 2", null, context);

        assertThat(patient2.id()).isNotEqualTo(patient1.id());
        List<PatientDuplicateCandidateView> pending = patientService.listDuplicateCandidates("PENDING", null, 10).items();
        PatientDuplicateCandidateView candidate = pending.stream()
                .filter(value -> value.sourcePatientId().equals(patient1.id()) && value.candidatePatientId().equals(patient2.id())
                        || value.sourcePatientId().equals(patient2.id()) && value.candidatePatientId().equals(patient1.id()))
                .findFirst().orElseThrow();

        assertThat(candidate.score()).isGreaterThan(new java.math.BigDecimal("0.90"));
        PatientDuplicateCandidateView reviewed = patientService.reviewDuplicateCandidate(
                candidate.id(), "REJECTED", "Confirmed different person", candidate.version(), context);

        assertThat(reviewed.status()).isEqualTo("REJECTED");
        assertThat(reviewed.reviewerAccountId()).isEqualTo(actorId);
        assertThat(reviewed.reviewReason()).isEqualTo("Confirmed different person");
    }
}
