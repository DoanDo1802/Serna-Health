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
            Instant createdAt,
            Instant updatedAt) {
    }

    public record RoomView(
            UUID id,
            long version,
            UUID departmentId,
            String code,
            String name,
            boolean active,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record ServiceView(
            UUID id,
            long version,
            String code,
            String name,
            String serviceType,
            boolean active,
            boolean allowsCritical,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record ServicePriceView(
            UUID id,
            UUID serviceId,
            BigDecimal amount,
            String currency,
            Instant effectiveFrom,
            Instant effectiveTo,
            Instant createdAt) {
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
            Instant createdAt,
            Instant updatedAt) {
    }

    public record Page<T>(List<T> items, String nextCursor, boolean hasMore) {
    }

    public record CommandAccepted(boolean accepted, String requestId) {
    }
}
