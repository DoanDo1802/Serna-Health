package vn.medicore.repository;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import vn.medicore.dto.PatientModels.PatientAccountLinkView;
import vn.medicore.dto.PatientModels.PatientDuplicateCandidateView;
import vn.medicore.dto.PatientModels.PatientIdentifierView;
import vn.medicore.dto.PatientModels.PatientView;

public interface PatientRepository {

    // ---- Patient ----
    List<PatientView> listPatients(String query, int limit, int offset);
    Optional<PatientView> patientById(UUID id);
    Optional<PatientView> patientByIdForUpdate(UUID id);
    void insertPatient(PatientRow row);
    void updatePatient(PatientRow row, long expectedVersion);

    // ---- PatientIdentifier ----
    List<PatientIdentifierView> listPatientIdentifiers(UUID patientId);
    Optional<PatientIdentifierView> patientIdentifierById(UUID id);
    Optional<PatientIdentifierView> patientIdentifierByIdForUpdate(UUID id);
    void insertPatientIdentifier(PatientIdentifierRow row);
    void updatePatientIdentifier(PatientIdentifierRow row, long expectedVersion);
    
    // ---- PatientAccountLink ----
    List<PatientAccountLinkView> listPatientAccountLinks(UUID patientId);
    List<PatientAccountLinkView> listAccountPatientLinks(UUID accountId);
    Optional<PatientAccountLinkView> patientAccountLinkById(UUID id);
    Optional<PatientAccountLinkView> patientAccountLinkByIdForUpdate(UUID id);
    void insertPatientAccountLink(PatientAccountLinkRow row);
    void updatePatientAccountLink(PatientAccountLinkRow row, long expectedVersion);

    // ---- PatientDuplicateCandidate ----
    List<PatientDuplicateCandidateView> listDuplicateCandidates(String status, int limit, int offset);
    Optional<PatientDuplicateCandidateView> duplicateCandidateById(UUID id);
    Optional<PatientDuplicateCandidateView> duplicateCandidateByIdForUpdate(UUID id);
    void insertDuplicateCandidate(PatientDuplicateCandidateRow row);
    void updateDuplicateCandidate(PatientDuplicateCandidateRow row, long expectedVersion);
    List<PatientDuplicateCandidateView> findPendingCandidatesBySourceOrCandidate(UUID patientId);

    // ===========================================================
    // Row projections for mutations
    // ===========================================================

    record PatientRow(
            UUID id,
            String fullName,
            LocalDate dateOfBirth,
            String phone,
            String email,
            String declaredGender,
            String address,
            String emergencyContactJson,
            long version,
            Instant createdAt,
            Instant updatedAt) {
    }

    record PatientIdentifierRow(
            UUID id,
            UUID patientId,
            String identifierType,
            String issuer,
            String jurisdiction,
            String protectedValue,
            String comparisonToken,
            String displaySuffix,
            String status,
            String verificationSource,
            UUID collectedByAccountId,
            Instant collectedAt,
            Instant verifiedAt,
            Instant effectiveFrom,
            Instant revokedAt,
            String evidenceReference,
            long version) {
    }

    record PatientAccountLinkRow(
            UUID id,
            UUID accountId,
            UUID patientId,
            String relationship,
            String verificationTier,
            String permissionScopeJson,
            Instant validFrom,
            Instant validTo,
            String status,
            Instant revokedAt,
            String revokeReason,
            long version,
            Instant createdAt,
            Instant updatedAt) {
    }

    record PatientDuplicateCandidateRow(
            UUID id,
            UUID sourcePatientId,
            UUID candidatePatientId,
            UUID orderedPatientLowId,
            UUID orderedPatientHighId,
            String matchReasonsJson,
            BigDecimal score,
            String status,
            UUID reviewerAccountId,
            Instant reviewedAt,
            String reviewReason,
            long version,
            Instant createdAt,
            Instant updatedAt) {
    }
}
