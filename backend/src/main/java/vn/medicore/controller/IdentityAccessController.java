package vn.medicore.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.medicore.config.AuthProperties;
import vn.medicore.dto.AuthenticatedAccount;
import vn.medicore.dto.IdentityModels.AccountView;
import vn.medicore.dto.IdentityModels.AssignmentView;
import vn.medicore.dto.IdentityModels.CommandAccepted;
import vn.medicore.dto.IdentityModels.Page;
import vn.medicore.dto.IdentityModels.PermissionView;
import vn.medicore.dto.IdentityModels.RoleView;
import vn.medicore.dto.IdentityModels.SessionIssue;
import vn.medicore.dto.IdentityModels.SessionView;
import vn.medicore.service.IdentityAccessService;

@RestController
@RequestMapping("/api/v1")
public class IdentityAccessController {

    private final IdentityAccessService identityAccess;
    private final AuthProperties properties;

    public IdentityAccessController(IdentityAccessService identityAccess, AuthProperties properties) {
        this.identityAccess = identityAccess;
        this.properties = properties;
    }

    @PostMapping("/auth/registrations")
    ResponseEntity<CommandAccepted> register(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            HttpServletRequest request,
            @Valid @RequestBody RegistrationRequest body) {
        CommandAccepted result = identityAccess.register(
                body.email(), body.password(), requestId(requestId), request.getRemoteAddr());
        return ResponseEntity.accepted().body(result);
    }

    @PostMapping("/auth/email-verification-challenges")
    ResponseEntity<CommandAccepted> requestEmailVerification(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            HttpServletRequest request,
            @Valid @RequestBody TargetEmailRequest body) {
        CommandAccepted result = identityAccess.requestEmailVerification(
                body.email(), requestId(requestId), request.getRemoteAddr());
        return ResponseEntity.accepted().body(result);
    }

    @PostMapping("/auth/email-verifications")
    AccountView verifyEmail(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @Valid @RequestBody EmailVerificationRequest body) {
        return identityAccess.verifyEmail(body.email(), body.code(), body.token(), requestId(requestId));
    }

    @PostMapping("/auth/password-sessions")
    ResponseEntity<SessionView> loginWithPassword(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            HttpServletRequest request,
            @Valid @RequestBody PasswordLoginRequest body) {
        SessionIssue issue = identityAccess.loginWithPassword(
                body.email(), body.password(), requestId(requestId), request.getRemoteAddr(), request.getHeader("User-Agent"));
        return sessionResponse(issue);
    }

    @PostMapping("/auth/otp-challenges")
    ResponseEntity<CommandAccepted> requestLoginOtp(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            HttpServletRequest request,
            @Valid @RequestBody TargetEmailRequest body) {
        CommandAccepted result = identityAccess.requestLoginOtp(
                body.email(), requestId(requestId), request.getRemoteAddr());
        return ResponseEntity.accepted().body(result);
    }

    @PostMapping("/auth/otp-sessions")
    ResponseEntity<SessionView> loginWithOtp(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            HttpServletRequest request,
            @Valid @RequestBody OtpLoginRequest body) {
        SessionIssue issue = identityAccess.loginWithOtp(
                body.email(), body.code(), requestId(requestId), request.getRemoteAddr(), request.getHeader("User-Agent"));
        return sessionResponse(issue);
    }

    @GetMapping("/auth/session")
    ResponseEntity<SessionView> currentSession(@CookieValue(name = "${medicore.auth.session.cookie-name:MEDICORE_SESSION}", required = false) String sessionToken) {
        return identityAccess.currentSession(sessionToken).map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(401).build());
    }

    @DeleteMapping("/auth/session")
    ResponseEntity<Void> logoutCurrent(@CookieValue(name = "${medicore.auth.session.cookie-name:MEDICORE_SESSION}", required = false) String sessionToken) {
        identityAccess.logoutCurrent(sessionToken, "USER_LOGOUT");
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, expiredCookie().toString()).build();
    }

    @DeleteMapping("/auth/sessions")
    ResponseEntity<Void> logoutAll(@AuthenticationPrincipal AuthenticatedAccount principal) {
        identityAccess.logoutAll(principal.accountId(), "USER_REVOKED_ALL");
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, expiredCookie().toString()).build();
    }

    @PostMapping("/auth/password-recovery-challenges")
    ResponseEntity<CommandAccepted> requestPasswordRecovery(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            HttpServletRequest request,
            @Valid @RequestBody TargetEmailRequest body) {
        CommandAccepted result = identityAccess.requestPasswordRecovery(
                body.email(), requestId(requestId), request.getRemoteAddr());
        return ResponseEntity.accepted().body(result);
    }

    @PostMapping("/auth/password-resets")
    AccountView resetPassword(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @Valid @RequestBody PasswordResetRequest body) {
        return identityAccess.resetPassword(body.token(), body.newPassword(), requestId(requestId));
    }

    @PutMapping("/auth/password")
    AccountView changePassword(
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @RequestHeader("If-Match") String ifMatch,
            @Valid @RequestBody PasswordChangeRequest body) {
        return identityAccess.changePassword(principal.accountId(), body.currentPassword(), body.newPassword(), version(ifMatch));
    }

    @GetMapping("/admin/accounts")
    @PreAuthorize("hasAuthority('account.read')")
    Page<AccountView> listAccounts(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit) {
        return identityAccess.listAccounts(status, cursor, limit);
    }

    @GetMapping("/admin/accounts/{id}")
    @PreAuthorize("hasAuthority('account.read')")
    ResponseEntity<AccountView> getAccount(@PathVariable UUID id) {
        AccountView view = identityAccess.getAccount(id);
        return versioned(view, view.version());
    }

    @PostMapping("/admin/accounts/{id}/actions/change-status")
    @PreAuthorize("hasAuthority('account.status.change')")
    ResponseEntity<AccountView> changeAccountStatus(
            @PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @RequestHeader("If-Match") String ifMatch,
            @Valid @RequestBody ChangeAccountStatusRequest body) {
        AccountView view = identityAccess.changeAccountStatus(id, body.targetStatus(), body.reason(), version(ifMatch), principal.accountId());
        return versioned(view, view.version());
    }

    @GetMapping("/admin/roles")
    @PreAuthorize("hasAuthority('role.read')")
    Page<RoleView> listRoles(
            @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit) {
        return identityAccess.listRoles(active, cursor, limit);
    }

    @PostMapping("/admin/roles")
    @PreAuthorize("hasAuthority('role.permission.manage')")
    RoleView createRole(@AuthenticationPrincipal AuthenticatedAccount principal, @Valid @RequestBody RoleCreateRequest body) {
        return identityAccess.createRole(body.code(), body.name(), principal.accountId());
    }

    @GetMapping("/admin/permissions")
    @PreAuthorize("hasAuthority('permission.read')")
    Page<PermissionView> listPermissions(
            @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit) {
        return identityAccess.listPermissions(active, cursor, limit);
    }

    @PutMapping("/admin/roles/{id}/permissions")
    @PreAuthorize("hasAuthority('role.permission.manage')")
    ResponseEntity<RoleView> replaceRolePermissions(
            @PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @RequestHeader("If-Match") String ifMatch,
            @Valid @RequestBody RolePermissionsRequest body) {
        RoleView view = identityAccess.replaceRolePermissions(id, body.permissionIds(), version(ifMatch), principal.accountId());
        return versioned(view, view.version());
    }

    @GetMapping("/admin/accounts/{id}/role-assignments")
    @PreAuthorize("hasAuthority('account.role.read')")
    Page<AssignmentView> listAssignments(
            @PathVariable UUID id,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Instant effectiveAt,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit) {
        return identityAccess.listAssignments(id, status, effectiveAt, cursor, limit);
    }

    @PostMapping("/admin/accounts/{id}/role-assignments")
    @PreAuthorize("hasAuthority('account.manage_role')")
    AssignmentView assignRole(
            @PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @Valid @RequestBody RoleAssignmentRequest body) {
        return identityAccess.assignRole(id, body.roleId(), body.departmentId(), body.effectiveFrom(),
                body.effectiveTo(), body.reason(), principal.accountId());
    }

    @PostMapping("/admin/role-assignments/{id}/actions/revoke")
    @PreAuthorize("hasAuthority('account.manage_role')")
    ResponseEntity<AssignmentView> revokeAssignment(
            @PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @RequestHeader("If-Match") String ifMatch,
            @Valid @RequestBody RevokeAssignmentRequest body) {
        AssignmentView view = identityAccess.revokeAssignment(id, body.reason(), version(ifMatch), principal.accountId());
        return versioned(view, view.version());
    }

    private ResponseEntity<SessionView> sessionResponse(SessionIssue issue) {
        ResponseCookie cookie = ResponseCookie.from(properties.session().cookieName(), issue.sessionToken())
                .httpOnly(true)
                .secure(properties.session().secureCookie())
                .path("/")
                .maxAge(properties.session().absoluteTimeout())
                .sameSite(properties.session().sameSite())
                .build();
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .header("X-CSRF-Token", issue.csrfToken())
                .body(issue.session());
    }

    private ResponseCookie expiredCookie() {
        return ResponseCookie.from(properties.session().cookieName(), "")
                .httpOnly(true)
                .secure(properties.session().secureCookie())
                .path("/")
                .maxAge(0)
                .sameSite(properties.session().sameSite())
                .build();
    }

    private static <T> ResponseEntity<T> versioned(T body, long version) {
        return ResponseEntity.ok().eTag(Long.toString(version)).body(body);
    }

    private static long version(String value) {
        if (value == null || !value.matches("^\"[0-9]+\"$")) throw new IllegalArgumentException("If-Match is invalid");
        return Long.parseLong(value.substring(1, value.length() - 1));
    }

    private static String requestId(String value) {
        return value == null || value.isBlank() ? UUID.randomUUID().toString() : value;
    }

    record RegistrationRequest(@NotBlank String email, @NotBlank String password) {}
    record TargetEmailRequest(@NotBlank String email) {}
    record EmailVerificationRequest(@NotBlank String email, String code, String token) {}
    record PasswordLoginRequest(@NotBlank String email, @NotBlank String password) {}
    record OtpLoginRequest(@NotBlank String email, @NotBlank String code) {}
    record PasswordResetRequest(@NotBlank String token, @NotBlank String newPassword) {}
    record PasswordChangeRequest(@NotBlank String currentPassword, @NotBlank String newPassword) {}
    record ChangeAccountStatusRequest(@NotBlank String targetStatus, @NotBlank @Size(max = 500) String reason) {}
    record RoleCreateRequest(@NotBlank @Size(max = 64) String code, @NotBlank @Size(max = 255) String name) {}
    record RolePermissionsRequest(@NotNull Set<UUID> permissionIds) {}
    record RoleAssignmentRequest(@NotNull UUID roleId, UUID departmentId, @NotNull Instant effectiveFrom, Instant effectiveTo, @NotBlank @Size(max = 500) String reason) {}
    record RevokeAssignmentRequest(@NotBlank @Size(max = 500) String reason) {}
}
