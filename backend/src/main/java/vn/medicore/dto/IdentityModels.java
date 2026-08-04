package vn.medicore.dto;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

public final class IdentityModels {

    private IdentityModels() {
    }

    public record CommandAccepted(boolean accepted, String requestId) {
    }

    public record AccountView(
            UUID id,
            long version,
            String displayEmail,
            Instant emailVerifiedAt,
            String status,
            int failedLoginCount,
            Instant lockedUntil,
            Instant lastAuthenticatedAt,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record SessionView(
            UUID accountId,
            String status,
            Instant authenticatedAt,
            Instant lastSeenAt,
            Instant idleExpiresAt,
            Instant absoluteExpiresAt,
            Set<String> permissions) {
    }

    public record SessionIssue(SessionView session, String sessionToken, String csrfToken) {
    }

    public record RoleView(
            UUID id,
            long version,
            String code,
            String name,
            boolean active,
            Set<UUID> permissionIds,
            Instant createdAt) {
    }

    public record PermissionView(UUID id, String action, String description, boolean active, Instant createdAt) {
    }

    public record AssignmentView(
            UUID id,
            UUID accountId,
            UUID roleId,
            UUID departmentId,
            Instant effectiveFrom,
            Instant effectiveTo,
            String status,
            UUID assignedByAccountId,
            String reason,
            long version) {
    }

    public record Page<T>(List<T> items, String nextCursor, boolean hasMore) {
    }
}
