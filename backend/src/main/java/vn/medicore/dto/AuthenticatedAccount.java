package vn.medicore.dto;

import java.util.Set;
import java.util.UUID;

public record AuthenticatedAccount(UUID sessionId, UUID accountId, Set<String> permissions) {
}
