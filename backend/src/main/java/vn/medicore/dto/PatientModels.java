package vn.medicore.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class PatientModels {

    private PatientModels() {
    }

    public record PatientView(
            UUID id,
            long version,
            String fullName,
            LocalDate dateOfBirth,
            String phone,
            String email,
            String declaredGender,
            String address,
            Map<String, Object> emergencyContact,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record PatientIdentifierView(
            UUID id,
            long version,
            UUID patientId,
            String identifierType,
            String issuer,
            String jurisdiction,
            String displaySuffix,
            String status,
            String verificationSource,
            UUID collectedByAccountId,
            Instant collectedAt,
            Instant verifiedAt,
            Instant effectiveFrom,
            Instant revokedAt,
            String evidenceReference) {
    }

    public record PatientAccountLinkView(
            UUID id,
            long version,
            UUID accountId,
            UUID patientId,
            String relationship,
            String verificationTier,
            Map<String, Object> permissionScope,
            Instant validFrom,
            Instant validTo,
            String status,
            Instant revokedAt,
            String revokeReason,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record PatientDuplicateCandidateView(
            UUID id,
            long version,
            UUID sourcePatientId,
            UUID candidatePatientId,
            Map<String, Object> matchReasons,
            BigDecimal score,
            String status,
            UUID reviewerAccountId,
            Instant reviewedAt,
            String reviewReason,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record Page<T>(List<T> items, String nextCursor, boolean hasMore) {
    }

    public record CommandAccepted(boolean accepted, String requestId) {
    }
}
