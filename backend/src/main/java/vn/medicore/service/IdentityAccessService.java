package vn.medicore.service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import vn.medicore.dto.AuthenticatedAccount;
import vn.medicore.dto.IdentityAuditContext;
import vn.medicore.dto.IdentityModels.AccountView;
import vn.medicore.dto.IdentityModels.AssignmentView;
import vn.medicore.dto.IdentityModels.CommandAccepted;
import vn.medicore.dto.IdentityModels.Page;
import vn.medicore.dto.IdentityModels.PermissionView;
import vn.medicore.dto.IdentityModels.RoleView;
import vn.medicore.dto.IdentityModels.SessionIssue;
import vn.medicore.dto.IdentityModels.SessionView;

public interface IdentityAccessService {

    CommandAccepted register(String email, String password, String requestId, String sourceIp);

    CommandAccepted requestEmailVerification(String email, String requestId, String sourceIp);

    AccountView verifyEmail(String email, String code, String token, String requestId);

    SessionIssue loginWithPassword(
            String email, String password, String tabContext, String requestId, String sourceIp, String userAgent);

    CommandAccepted requestLoginOtp(String email, String requestId, String sourceIp);

    SessionIssue loginWithOtp(
            String email, String code, String tabContext, String requestId, String sourceIp, String userAgent);

    Optional<SessionView> currentSession(String rawSessionToken, String tabContext);

    Optional<AuthenticatedAccount> authenticateSession(
            String rawSessionToken, String tabContext, String csrfToken, boolean csrfRequired);

    void logoutCurrent(String rawSessionToken, String tabContext, String reason, String requestId, String correlationId);

    void logoutAll(UUID accountId, String reason, IdentityAuditContext audit);

    CommandAccepted requestPasswordRecovery(String email, String requestId, String sourceIp);

    AccountView resetPassword(String token, String newPassword, String requestId);

    AccountView changePassword(UUID accountId, String currentPassword, String newPassword, long version);

    Page<AccountView> listAccounts(String status, String cursor, int limit);

    AccountView getAccount(UUID accountId);

    AccountView changeAccountStatus(UUID accountId, String status, String reason, long version, IdentityAuditContext audit);

    Page<RoleView> listRoles(Boolean active, String cursor, int limit);

    RoleView createRole(String code, String name, IdentityAuditContext audit);

    Page<PermissionView> listPermissions(Boolean active, String cursor, int limit);

    RoleView replaceRolePermissions(UUID roleId, Set<UUID> permissionIds, long version, IdentityAuditContext audit);

    Page<AssignmentView> listAssignments(UUID accountId, String status, Instant effectiveAt, String cursor, int limit);

    AssignmentView assignRole(
            UUID accountId,
            UUID roleId,
            UUID departmentId,
            Instant effectiveFrom,
            Instant effectiveTo,
            String reason,
            IdentityAuditContext audit);

    AssignmentView revokeAssignment(UUID assignmentId, String reason, long version, IdentityAuditContext audit);

    Set<String> effectivePermissions(UUID accountId, Instant at);

    List<UUID> activeRoleIds(UUID accountId, Instant at);
}
