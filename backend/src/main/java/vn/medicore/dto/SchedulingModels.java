package vn.medicore.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface SchedulingModels {

    // --- Database Rows ---

    record AppointmentSlotRow(
            UUID id,
            UUID practitionerRoleId,
            UUID departmentId,
            UUID roomId,
            UUID serviceId,
            String session,
            Instant startAt,
            Instant endAt,
            int capacity,
            String status,
            long version,
            Instant createdAt,
            Instant updatedAt
    ) {}

    record SlotHoldRow(
            UUID id,
            UUID slotId,
            UUID patientId,
            Instant expiresAt,
            BigDecimal depositAmount,
            String currency,
            String status,
            long version,
            Instant createdAt,
            Instant updatedAt
    ) {}

    /** Internal-only row carrying DB-persisted idempotency columns; never serialized to API response. */
    record SlotHoldJdbcRow(
            UUID id,
            UUID slotId,
            UUID patientId,
            Instant expiresAt,
            BigDecimal depositAmount,
            String currency,
            String idempotencyScope,
            String idempotencyKey,
            String requestHash,
            String status,
            long version,
            Instant createdAt,
            Instant updatedAt
    ) {
        public SlotHoldRow toRow() {
            return new SlotHoldRow(id, slotId, patientId, expiresAt, depositAmount, currency, status, version, createdAt, updatedAt);
        }
    }

    record AppointmentRow(
            UUID id,
            UUID patientId,
            UUID slotHoldId,
            UUID slotId,
            UUID rescheduledFromId,
            UUID rescheduledToId,
            String status,
            long version,
            Instant createdAt,
            Instant updatedAt
    ) {
        public AppointmentRow(
                UUID id,
                UUID patientId,
                UUID slotHoldId,
                UUID slotId,
                String status,
                long version,
                Instant createdAt,
                Instant updatedAt
        ) {
            this(id, patientId, slotHoldId, slotId, null, null, status, version, createdAt, updatedAt);
        }
    }

    // --- API Requests & Responses ---

    record CreateAppointmentSlotRequest(
            UUID practitionerRoleId,
            UUID departmentId,
            UUID roomId,
            UUID serviceId,
            String session,
            Instant startAt,
            Instant endAt,
            int capacity
    ) {}

    record UpdateAppointmentSlotRequest(
            int capacity
    ) {}

    record CreateSlotHoldRequest(
            UUID slotId,
            UUID patientId
    ) {}

    record BookingCatalog(
            List<BookingDepartment> departments,
            List<BookingRoom> rooms,
            List<BookingService> services,
            List<BookingPractitioner> practitioners,
            List<BookingPractitionerRole> practitionerRoles) {
    }

    record BookingDepartment(UUID id, String name) {
    }

    record BookingRoom(UUID id, UUID departmentId, String name) {
    }

    record BookingService(UUID id, String name, BigDecimal priceAmount, String priceCurrency) {
    }

    record BookingPractitioner(UUID id, String fullName) {
    }

    record BookingPractitionerRole(UUID id, UUID practitionerId, String roleCode) {
    }

    record RescheduleAppointmentRequest(
            UUID targetSlotHoldId,
            String reason,
            UUID topUpPaymentIntentId
    ) {}

    record RescheduleAppointmentResponse(
            UUID oldAppointmentId,
            UUID newAppointmentId,
            long oldAppointmentVersion,
            long newAppointmentVersion,
            UUID depositTransferId,
            UUID sourceAllocationId,
            UUID targetAllocationId,
            BigDecimal transferredAmount,
            BigDecimal differenceAmount,
            String differenceDisposition,
            UUID refundPendingAllocationId,
            String currency,
            Instant rescheduledAt
    ) {}
}
