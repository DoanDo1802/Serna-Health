package vn.medicore.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class ReceptionModels {

    private ReceptionModels() {
    }

    public record VisitRow(
            UUID id,
            UUID patientId,
            UUID appointmentId,
            String status,
            long version,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record VisitView(
            UUID id,
            long version,
            UUID patientId,
            UUID appointmentId,
            String status,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record CheckInRow(
            UUID id,
            UUID appointmentId,
            UUID visitId,
            Instant checkedInAt,
            UUID checkedInByAccountId,
            String notes,
            long version,
            Instant createdAt) {
    }

    public record CheckInView(
            UUID id,
            long version,
            UUID appointmentId,
            UUID visitId,
            Instant checkedInAt,
            UUID checkedInByAccountId,
            String notes,
            Instant createdAt) {
    }

    public record CheckInAppointmentRequest(String notes) {
    }

    public record EncounterRow(
            UUID id,
            UUID visitId,
            UUID patientId,
            UUID departmentId,
            String status,
            Instant startAt,
            Instant endAt,
            long version,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record EncounterParticipantRow(
            UUID id,
            UUID encounterId,
            UUID practitionerRoleId,
            String roleType,
            String status,
            Instant createdAt) {
    }

    public record EncounterParticipantView(
            UUID id,
            UUID encounterId,
            UUID practitionerRoleId,
            String practitionerName,
            String practitionerRoleCode,
            String roleType,
            String status,
            Instant createdAt) {
    }

    public record EncounterView(
            UUID id,
            long version,
            UUID visitId,
            UUID patientId,
            UUID departmentId,
            String status,
            Instant startAt,
            Instant endAt,
            List<EncounterParticipantView> participants,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record VisitPage(List<VisitView> items, String nextCursor, boolean hasMore) {
    }

    public record EncounterPage(List<EncounterView> items, String nextCursor, boolean hasMore) {
    }
}
