package vn.medicore.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.medicore.common.web.RequestContext;
import vn.medicore.dto.AuditModels.AuditEventView;
import vn.medicore.dto.AuditModels.BreakGlassView;
import vn.medicore.dto.AuditModels.Page;
import vn.medicore.dto.AuthenticatedAccount;
import vn.medicore.service.PlatformAuditService;

@RestController
@RequestMapping("/api/v1")
public class PlatformAuditController {

    private final PlatformAuditService audit;

    public PlatformAuditController(PlatformAuditService audit) {
        this.audit = audit;
    }

    @PostMapping("/patients/{patientId}/break-glass-grants")
    @PreAuthorize("hasAuthority('clinical.break_glass')")
    ResponseEntity<BreakGlassView> requestBreakGlass(
            @PathVariable UUID patientId,
            @AuthenticationPrincipal AuthenticatedAccount principal,
            jakarta.servlet.http.HttpServletRequest request,
            @Valid @RequestBody BreakGlassRequest body) {
        BreakGlassView result = audit.requestBreakGlass(patientId, principal.accountId(), principal.sessionId(),
                snapshot(principal), body.purpose(), body.reason(), Duration.ofMinutes(body.ttlMinutes()),
                body.alertReference(), body.ticketReference(), RequestContext.requestId(request),
                RequestContext.correlationId(request));
        return versioned(result, result.version());
    }

    @GetMapping("/break-glass-grants")
    ResponseEntity<Page<BreakGlassView>> listBreakGlass(
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) UUID patientId,
            @RequestParam(required = false) UUID requesterAccountId,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit) {
        boolean auditReader = principal.permissions().contains("audit.read");
        return ResponseEntity.ok(audit.listBreakGlass(
                principal.accountId(), auditReader, status, patientId, requesterAccountId, cursor, limit));
    }

    @PostMapping("/break-glass-grants/{grantId}/actions/revoke")
    @PreAuthorize("hasAuthority('clinical.break_glass')")
    ResponseEntity<BreakGlassView> revokeBreakGlass(
            @PathVariable UUID grantId,
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @RequestHeader("If-Match") String ifMatch,
            jakarta.servlet.http.HttpServletRequest request,
            @Valid @RequestBody ReasonRequest body) {
        BreakGlassView result = audit.revokeBreakGlass(grantId, principal.accountId(), body.reason(), version(ifMatch),
                principal.sessionId(), snapshot(principal), RequestContext.requestId(request), RequestContext.correlationId(request));
        return versioned(result, result.version());
    }

    @PostMapping("/break-glass-grants/{grantId}/actions/review")
    @PreAuthorize("hasAuthority('audit.break_glass.review')")
    ResponseEntity<BreakGlassView> reviewBreakGlass(
            @PathVariable UUID grantId,
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @RequestHeader("If-Match") String ifMatch,
            jakarta.servlet.http.HttpServletRequest request,
            @Valid @RequestBody ReviewRequest body) {
        BreakGlassView result = audit.reviewBreakGlass(grantId, principal.accountId(), body.outcome(), body.reason(), version(ifMatch),
                principal.sessionId(), snapshot(principal), RequestContext.requestId(request), RequestContext.correlationId(request));
        return versioned(result, result.version());
    }

    @GetMapping("/audit-events")
    @PreAuthorize("hasAuthority('audit.read')")
    Page<AuditEventView> listAuditEvents(
            @RequestParam(required = false) Instant occurredFrom,
            @RequestParam(required = false) Instant occurredTo,
            @RequestParam(required = false) UUID patientId,
            @RequestParam(required = false) UUID actorAccountId,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String outcome,
            @RequestParam(required = false) String correlationId,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit) {
        return audit.listAuditEvents(occurredFrom, occurredTo, patientId, actorAccountId, action, outcome,
                correlationId, cursor, limit);
    }

    @GetMapping("/audit-events/{auditEventId}")
    @PreAuthorize("hasAuthority('audit.read')")
    AuditEventView getAuditEvent(@PathVariable UUID auditEventId) {
        return audit.getAuditEvent(auditEventId);
    }

    private static Map<String, Object> snapshot(AuthenticatedAccount principal) {
        return Map.of("permissions", List.copyOf(principal.permissions()));
    }

    private static <T> ResponseEntity<T> versioned(T body, long version) {
        return ResponseEntity.ok().eTag(Long.toString(version)).body(body);
    }

    private static long version(String value) {
        if (value == null || !value.matches("^\"[0-9]+\"$")) throw new IllegalArgumentException("If-Match is invalid");
        return Long.parseLong(value.substring(1, value.length() - 1));
    }


    record BreakGlassRequest(
            @NotBlank @Size(max = 500) String purpose,
            @NotBlank @Size(max = 500) String reason,
            @Min(1) @Max(240) int ttlMinutes,
            @NotBlank @Size(max = 128) String alertReference,
            @NotBlank @Size(max = 128) String ticketReference) {
    }

    record ReasonRequest(@NotBlank @Size(max = 500) String reason) {
    }

    record ReviewRequest(
            @NotBlank @Size(max = 64)
            @jakarta.validation.constraints.Pattern(regexp = "^[A-Z][A-Z0-9_]*$") String outcome,
            @NotBlank @Size(max = 500) String reason) {
    }
}
