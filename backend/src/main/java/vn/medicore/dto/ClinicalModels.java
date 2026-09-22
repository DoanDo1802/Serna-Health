package vn.medicore.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class ClinicalModels {

    private ClinicalModels() {
    }

    public record ClinicalNoteRow(
            UUID id,
            UUID encounterId,
            UUID patientId,
            String noteType,
            String status,
            UUID currentVersionId,
            long version,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record ClinicalNoteVersionRow(
            UUID id,
            UUID clinicalNoteId,
            int versionNumber,
            String status,
            String contentSchemaVersion,
            String contentJson,
            String digest,
            UUID authorPractitionerRoleId,
            UUID finalizedByPractitionerRoleId,
            Instant finalizedAt,
            UUID amendedFromVersionId,
            String amendmentReason,
            String errorReason,
            long version,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record ClinicalNoteVersionView(
            UUID id,
            long version,
            UUID clinicalNoteId,
            int versionNumber,
            String status,
            String contentSchemaVersion,
            Object content,
            String digest,
            UUID authorPractitionerRoleId,
            String authorPractitionerName,
            UUID finalizedByPractitionerRoleId,
            String finalizedByPractitionerName,
            Instant finalizedAt,
            UUID amendedFromVersionId,
            String amendmentReason,
            String errorReason,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record ClinicalNoteView(
            UUID id,
            long version,
            UUID encounterId,
            UUID patientId,
            String noteType,
            String status,
            UUID currentVersionId,
            ClinicalNoteVersionView currentVersion,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record CreateClinicalNoteRequest(
            String noteType,
            String contentSchemaVersion,
            Map<String, Object> content) {
    }

    public record UpdateClinicalNoteDraftRequest(
            String contentSchemaVersion,
            Map<String, Object> content) {
    }

    public record ReasonCommand(String reason) {
    }

    public record ClinicalNotePage(List<ClinicalNoteView> items, String nextCursor, boolean hasMore) {
    }

    public record ClinicalNoteVersionPage(List<ClinicalNoteVersionView> items, String nextCursor, boolean hasMore) {
    }
}
