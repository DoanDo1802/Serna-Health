package vn.medicore.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
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

    record CreateBookingSessionHoldRequest(
            UUID bookingSessionId,
            UUID patientId
    ) {}

    record BookingSessionRow(
            UUID id,
            UUID departmentId,
            UUID serviceId,
            LocalDate localDate,
            String session,
            Instant startAt,
            Instant endAt,
            String status,
            long version,
            Instant createdAt,
            Instant updatedAt
    ) {}

    record WorkScheduleRow(
            UUID id,
            UUID bookingSessionId,
            UUID practitionerRoleId,
            UUID roomId,
            int capacity,
            String status,
            long version,
            Instant createdAt,
            Instant updatedAt,
            UUID slotId,
            int reservedCapacity,
            int remainingCapacity,
            UUID departmentId,
            UUID serviceId,
            LocalDate localDate,
            String session
    ) {}

    record CreateWorkScheduleRequest(
            UUID practitionerRoleId,
            UUID departmentId,
            UUID roomId,
            UUID serviceId,
            LocalDate localDate,
            String session,
            int capacity
    ) {}

    record UpdateWorkScheduleRequest(
            UUID practitionerRoleId,
            UUID departmentId,
            UUID roomId,
            UUID serviceId,
            LocalDate localDate,
            String session,
            Integer capacity
    ) {
        public UpdateWorkScheduleRequest(int capacity) {
            this(null, null, null, null, null, null, capacity);
        }
    }

    record WorkScheduleCatalog(
            List<BookingDepartment> departments,
            List<BookingRoom> rooms,
            List<BookingService> services
    ) {}

    record BookingSessionAvailability(
            UUID id,
            long version,
            UUID departmentId,
            UUID serviceId,
            LocalDate localDate,
            String session,
            Instant startAt,
            Instant endAt,
            int totalCapacity,
            int reservedCapacity,
            int remainingCapacity,
            boolean canCreateHold,
            String disabledReason
    ) {}

    record BookingHoldAssignment(
            String practitionerName,
            String roomName,
            Instant startAt,
            Instant endAt,
            String session
    ) {}

    record CreateSlotHoldResponse(
            UUID id,
            UUID patientId,
            Instant expiresAt,
            BigDecimal depositAmount,
            String currency,
            String status,
            long version,
            Instant createdAt,
            Instant updatedAt,
            BookingHoldAssignment assignment
    ) {}

    record WorkScheduleCandidate(
            WorkScheduleRow schedule,
            AppointmentSlotRow slot,
            int reservedCapacity,
            String practitionerName,
            String roomName
    ) {}

    record BookingSessionAvailabilityProjection(
            UUID id,
            long version,
            UUID departmentId,
            UUID serviceId,
            LocalDate localDate,
            String session,
            Instant startAt,
            Instant endAt,
            int totalCapacity,
            int reservedCapacity,
            String disabledReason
    ) {
        public BookingSessionAvailability toAvailability() {
            int remaining = Math.max(0, totalCapacity - reservedCapacity);
            return new BookingSessionAvailability(
                    id, version, departmentId, serviceId, localDate, session, startAt, endAt,
                    totalCapacity, reservedCapacity, remaining, disabledReason == null && remaining > 0, disabledReason);
        }
    }

    record CreateRescheduleSlotHoldRequest(
            UUID slotId,
            UUID patientId,
            UUID sourceAppointmentId
    ) {}

    record BookingCatalog(
            List<BookingDepartment> departments,
            List<BookingService> services) {
    }

    record RescheduleCatalog(
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

    record RescheduleTopUpRequest(
            UUID targetSlotHoldId,
            String reason
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

    // --- Portal-Specific Projections & Commands ---

    record PatientAppointment(
            UUID id,
            long version,
            UUID patientId,
            UUID slotId,
            String status,
            String departmentName,
            String roomName,
            String serviceName,
            String practitionerName,
            String practitionerRoleCode,
            Instant startAt,
            Instant endAt,
            String session,
            String requiredDepositAmount,
            String paidDepositAmount,
            String currency,
            String depositState,
            boolean canCancel,
            String cancelDisabledReason,
            boolean canReschedule,
            String rescheduleDisabledReason,
            String cancellationOutcome,
            Instant cancellationCutoffAt,
            UUID rescheduledFromId,
            UUID rescheduledToId,
            Instant createdAt,
            Instant updatedAt
    ) {}

    record BookingAvailabilitySlot(
            UUID id,
            long version,
            UUID practitionerRoleId,
            UUID departmentId,
            UUID roomId,
            UUID serviceId,
            String session,
            Instant startAt,
            Instant endAt,
            boolean canCreateHold,
            String disabledReason
    ) {}

    record BookingAvailabilityProjection(
            UUID id,
            long version,
            UUID practitionerRoleId,
            UUID departmentId,
            UUID roomId,
            UUID serviceId,
            String session,
            Instant startAt,
            Instant endAt,
            String disabledReason
    ) {
        public BookingAvailabilitySlot toSlot() {
            return new BookingAvailabilitySlot(
                    id, version, practitionerRoleId, departmentId, roomId, serviceId,
                    session, startAt, endAt, disabledReason == null, disabledReason);
        }
    }

    record CancelAppointmentRequest(
            @jakarta.validation.constraints.Size(max = 500) String reason
    ) {}
}
