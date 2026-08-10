package vn.medicore.dto;

import java.math.BigDecimal;
import java.time.Instant;
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
            String idempotencyScope,
            String idempotencyKey,
            String requestHash,
            String status,
            long version,
            Instant createdAt,
            Instant updatedAt
    ) {}

    // --- API Requests ---

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
}
