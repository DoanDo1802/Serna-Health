package vn.medicore.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class CatalogModels {

    private CatalogModels() {
    }

    public record DepartmentView(
            UUID id,
            long version,
            String code,
            String name,
            boolean active,
            Instant effectiveFrom,
            Instant effectiveTo,
            Object examTemplate,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record RoomView(
            UUID id,
            long version,
            String code,
            String name,
            boolean active,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record RoomAssignmentsView(
            UUID roomId,
            long version,
            List<UUID> departmentIds,
            List<UUID> serviceIds) {
    }

    public record ServiceView(
            UUID id,
            long version,
            String code,
            String name,
            String serviceType,
            UUID departmentId,
            boolean active,
            boolean allowsCritical,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record ServicePriceView(
            UUID id,
            long version,
            UUID serviceId,
            BigDecimal amount,
            String currency,
            Instant effectiveFrom,
            Instant effectiveTo,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record PractitionerView(
            UUID id,
            long version,
            UUID userAccountId,
            String staffCode,
            String fullName,
            boolean active,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record PractitionerRoleView(
            UUID id,
            long version,
            UUID practitionerId,
            UUID departmentId,
            String roleCode,
            Instant effectiveFrom,
            Instant effectiveTo,
            String status,
            Instant revokedAt,
            UUID revokedByAccountId,
            String revokeReason,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record Page<T>(List<T> items, String nextCursor, boolean hasMore) {
    }

    public record CommandAccepted(boolean accepted, String requestId) {
    }
}
