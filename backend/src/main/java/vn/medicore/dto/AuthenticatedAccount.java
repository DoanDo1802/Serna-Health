package vn.medicore.dto;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

public record AuthenticatedAccount(UUID sessionId, UUID accountId, Set<String> permissions, List<EffectiveGrant> grants) {
    public boolean permits(String action, UUID departmentId, Instant at) {
        return grants.stream().anyMatch(grant -> grant.action().equals(action)
                && (grant.departmentId() == null || grant.departmentId().equals(departmentId))
                && !at.isBefore(grant.effectiveFrom())
                && (grant.effectiveTo() == null || at.isBefore(grant.effectiveTo())));
    }

    public record EffectiveGrant(String action, UUID assignmentId, UUID departmentId, Instant effectiveFrom, Instant effectiveTo) {
    }
}
