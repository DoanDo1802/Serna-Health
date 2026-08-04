package vn.medicore.patient;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import vn.medicore.common.utils.UuidV7Generator;
import vn.medicore.dto.PatientModels.PatientDuplicateCandidateView;
import vn.medicore.dto.PatientModels.PatientView;
import vn.medicore.service.PatientService;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
@SpringBootTest
@ActiveProfiles("test")
public class PatientIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17.10");

    @Autowired
    private PatientService patientService;

    @Autowired
    private UuidV7Generator ids;

    @Test
    void SC_R1_PAT_01_suspected_duplicate_is_detected_and_reviewed() {
        UUID actorId = ids.next();
        String fullName = "Nguyen Van A";
        LocalDate dob = LocalDate.of(1990, 1, 1);
        String phone = "0901234567";

        // 1. Create first patient
        PatientView patient1 = patientService.createPatient(
                fullName, dob, phone, "a@example.com", "MALE", "Hanoi", null, actorId);
        
        assertThat(patient1.id()).isNotNull();

        // 2. Create second patient with same name and dob (simulating a duplicate)
        PatientView patient2 = patientService.createPatient(
                fullName, dob, phone, "a2@example.com", "MALE", "Hanoi 2", null, actorId);
        
        assertThat(patient2.id()).isNotNull();
        assertThat(patient1.id()).isNotEqualTo(patient2.id());

        // 3. Verify a pending duplicate candidate was created
        List<PatientDuplicateCandidateView> pendingCandidates = patientService.listDuplicateCandidates("PENDING", 10, 0);
        
        PatientDuplicateCandidateView candidate = pendingCandidates.stream()
                .filter(c -> (c.sourcePatientId().equals(patient1.id()) && c.candidatePatientId().equals(patient2.id())) ||
                             (c.sourcePatientId().equals(patient2.id()) && c.candidatePatientId().equals(patient1.id())))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Duplicate candidate not found"));

        assertThat(candidate.status()).isEqualTo("PENDING");
        assertThat(candidate.score()).isGreaterThan(new java.math.BigDecimal("0.90"));

        // 4. Authorized reviewer REJECTS the candidate (meaning they are different people)
        PatientDuplicateCandidateView reviewed = patientService.reviewDuplicateCandidate(
                candidate.id(), "REJECTED", "Confirmed different person via ID card", candidate.version(), actorId);

        assertThat(reviewed.status()).isEqualTo("REJECTED");
        assertThat(reviewed.reviewerAccountId()).isEqualTo(actorId);
        assertThat(reviewed.reviewReason()).isEqualTo("Confirmed different person via ID card");
    }
}
