package vn.medicore.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
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
import vn.medicore.dto.AuthenticatedAccount;
import vn.medicore.dto.PatientAuditContext;
import vn.medicore.dto.PatientModels.Page;
import vn.medicore.dto.PatientModels.PatientAccountLinkView;
import vn.medicore.dto.PatientModels.PatientDuplicateCandidateView;
import vn.medicore.dto.PatientModels.PatientIdentifierView;
import vn.medicore.dto.PatientModels.PatientView;
import vn.medicore.service.PatientService;

@RestController
@RequestMapping("/api/v1")
public class PatientController {

    private final PatientService patientService;
    private final Clock clock;

    public PatientController(PatientService patientService, Clock clock) {
        this.patientService = patientService;
        this.clock = clock;
    }

    @GetMapping("/patients")
    @PreAuthorize("hasAuthority('patient.search')")
    Page<PatientView> searchPatients(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit) {
        return patientService.searchPatients(query, cursor, limit);
    }

    @GetMapping("/patients/{patientId}")
    @PreAuthorize("hasAuthority('patient.read')")
    ResponseEntity<PatientView> getPatient(
            @PathVariable UUID patientId,
            @AuthenticationPrincipal AuthenticatedAccount principal) {
        requirePatientAccess(principal, patientId);
        PatientView view = patientService.getPatient(patientId);
        return versioned(view, view.version());
    }

    @PostMapping("/patients/self")
    ResponseEntity<PatientView> createOwnPatient(
            HttpServletRequest request,
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @Valid @RequestBody PatientCreateRequest body) {
        PatientView view = patientService.createOwnPatient(
                body.fullName(), body.dateOfBirth(), body.phone(), body.email(), body.declaredGender(), body.address(),
                body.emergencyContact(), auditContext(request, principal));
        return versioned(view, view.version());
    }

    @PostMapping("/patients")
    @PreAuthorize("hasAuthority('patient.create')")
    ResponseEntity<PatientView> createPatient(
            HttpServletRequest request,
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @Valid @RequestBody PatientCreateRequest body) {
        PatientView view = patientService.createPatient(
                body.fullName(), body.dateOfBirth(), body.phone(), body.email(), body.declaredGender(), body.address(),
                body.emergencyContact(), auditContext(request, principal));
        return versioned(view, view.version());
    }

    @org.springframework.web.bind.annotation.PatchMapping("/patients/{patientId}")
    @PreAuthorize("hasAuthority('patient.update')")
    ResponseEntity<PatientView> updatePatient(
            @PathVariable UUID patientId,
            HttpServletRequest request,
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @RequestHeader("If-Match") String ifMatch,
            @Valid @RequestBody PatientUpdateRequest body) {
        requirePatientAccess(principal, patientId);
        PatientView view = patientService.updatePatient(
                patientId, body.fullName(), body.dateOfBirth(), body.phone(), body.email(), body.declaredGender(),
                body.address(), body.emergencyContact(), version(ifMatch), auditContext(request, principal));
        return versioned(view, view.version());
    }

    @GetMapping("/patients/{patientId}/identifiers")
    @PreAuthorize("hasAuthority('patient_identifier.read')")
    Page<PatientIdentifierView> listPatientIdentifiers(
            @PathVariable UUID patientId,
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit) {
        requirePatientAccess(principal, patientId);
        return patientService.listPatientIdentifiers(patientId, cursor, limit);
    }

    @PostMapping("/patients/{patientId}/identifiers")
    @PreAuthorize("hasAuthority('patient_identifier.create')")
    ResponseEntity<PatientIdentifierView> addPatientIdentifier(
            @PathVariable UUID patientId,
            HttpServletRequest request,
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @Valid @RequestBody PatientIdentifierAddRequest body) {
        requirePatientAccess(principal, patientId);
        PatientIdentifierView view = patientService.addPatientIdentifier(patientId, body.identifierType(), body.issuer(),
                body.jurisdiction(), body.value(), body.verificationSource(), auditContext(request, principal));
        return versioned(view, view.version());
    }

    @PostMapping("/patient-identifiers/{identifierId}/actions/verify-manually")
    @PreAuthorize("hasAuthority('identity.link.verify')")
    ResponseEntity<PatientIdentifierView> verifyPatientIdentifierManually(
            @PathVariable UUID identifierId,
            HttpServletRequest request,
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @RequestHeader("If-Match") String ifMatch,
            @Valid @RequestBody PatientIdentifierVerifyRequest body) {
        PatientIdentifierView view = patientService.verifyPatientIdentifierManually(identifierId, body.evidenceReference(),
                version(ifMatch), auditContext(request, principal));
        return versioned(view, view.version());
    }

    @PostMapping("/patient-identifiers/{identifierId}/actions/revoke")
    @PreAuthorize("hasAuthority('identity.link.verify')")
    ResponseEntity<PatientIdentifierView> revokePatientIdentifier(
            @PathVariable UUID identifierId,
            HttpServletRequest request,
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @RequestHeader("If-Match") String ifMatch,
            @Valid @RequestBody ReasonRequest body) {
        PatientIdentifierView view = patientService.revokePatientIdentifier(identifierId, body.reason(), version(ifMatch),
                auditContext(request, principal));
        return versioned(view, view.version());
    }

    @PostMapping("/patient-identifiers/{identifierId}/actions/enter-in-error")
    @PreAuthorize("hasAuthority('identity.link.verify')")
    ResponseEntity<PatientIdentifierView> enterPatientIdentifierInError(
            @PathVariable UUID identifierId,
            HttpServletRequest request,
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @RequestHeader("If-Match") String ifMatch,
            @Valid @RequestBody ReasonRequest body) {
        PatientIdentifierView view = patientService.enterPatientIdentifierInError(identifierId, body.reason(), version(ifMatch),
                auditContext(request, principal));
        return versioned(view, view.version());
    }

    @GetMapping("/patients/{patientId}/account-links")
    @PreAuthorize("hasAuthority('patient_account_link.read')")
    Page<PatientAccountLinkView> listPatientAccountLinks(
            @PathVariable UUID patientId,
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit) {
        requirePatientAccess(principal, patientId);
        return patientService.listPatientAccountLinks(patientId, cursor, limit);
    }

    @PostMapping("/patients/{patientId}/account-links")
    @PreAuthorize("hasAuthority('patient_account_link.create')")
    ResponseEntity<PatientAccountLinkView> linkPatientAccount(
            @PathVariable UUID patientId,
            HttpServletRequest request,
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @Valid @RequestBody PatientAccountLinkRequest body) {
        requirePatientAccess(principal, patientId);
        PatientAccountLinkView view = patientService.linkPatientAccount(body.accountId(), patientId, body.relationship(),
                body.verificationTier(), body.permissionScope(), body.validFrom(), body.validTo(), auditContext(request, principal));
        return versioned(view, view.version());
    }

    @GetMapping("/patient-duplicate-candidates")
    @PreAuthorize("hasAuthority('patient_duplicate.review')")
    Page<PatientDuplicateCandidateView> listDuplicateCandidates(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit) {
        return patientService.listDuplicateCandidates(status, cursor, limit);
    }

    @GetMapping("/patient-duplicate-candidates/{candidateId}")
    @PreAuthorize("hasAuthority('patient_duplicate.review')")
    ResponseEntity<PatientDuplicateCandidateView> getDuplicateCandidate(@PathVariable UUID candidateId) {
        PatientDuplicateCandidateView view = patientService.getDuplicateCandidate(candidateId);
        return versioned(view, view.version());
    }

    @PostMapping("/patient-duplicate-candidates/{candidateId}/actions/review")
    @PreAuthorize("hasAuthority('patient_duplicate.review')")
    ResponseEntity<PatientDuplicateCandidateView> reviewDuplicateCandidate(
            @PathVariable UUID candidateId,
            HttpServletRequest request,
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @RequestHeader("If-Match") String ifMatch,
            @Valid @RequestBody DuplicateReviewRequest body) {
        PatientDuplicateCandidateView view = patientService.reviewDuplicateCandidate(candidateId, body.status(), body.reviewReason(),
                version(ifMatch), auditContext(request, principal));
        return versioned(view, view.version());
    }

    @PostMapping("/patient-duplicate-candidates/{candidateId}/actions/enter-in-error")
    @PreAuthorize("hasAuthority('patient_duplicate.review')")
    ResponseEntity<PatientDuplicateCandidateView> enterDuplicateCandidateInError(
            @PathVariable UUID candidateId,
            HttpServletRequest request,
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @RequestHeader("If-Match") String ifMatch,
            @Valid @RequestBody ReasonRequest body) {
        PatientDuplicateCandidateView view = patientService.enterDuplicateCandidateInError(candidateId, body.reason(),
                version(ifMatch), auditContext(request, principal));
        return versioned(view, view.version());
    }

    private void requirePatientAccess(AuthenticatedAccount principal, UUID patientId) {
        Instant now = clock.instant();
        boolean allowed = principal.permissions().contains("patient.read") || patientService.listAccountPatientLinks(principal.accountId()).stream()
                .anyMatch(link -> link.patientId().equals(patientId) && "ACTIVE".equals(link.status())
                        && !now.isBefore(link.validFrom()) && (link.validTo() == null || now.isBefore(link.validTo()))
                        && ("OWN".equals(link.relationship())
                        || ("REPRESENTATION_VERIFIED".equals(link.verificationTier())
                        && Boolean.TRUE.equals(link.permissionScope().get("patient.read")))));
        if (!allowed) throw new AccessDeniedException("Patient access is not granted");
    }

    private static PatientAuditContext auditContext(HttpServletRequest request, AuthenticatedAccount principal) {
        return new PatientAuditContext(principal.accountId(), principal.sessionId().toString(),
                Map.of("permissions", List.copyOf(principal.permissions())), RequestContext.requestId(request),
                RequestContext.correlationId(request));
    }

    private static <T> ResponseEntity<T> versioned(T body, long version) {
        return ResponseEntity.ok().eTag(Long.toString(version)).body(body);
    }

    private static long version(String value) {
        if (value == null || !value.matches("^\"[0-9]+\"$")) throw new IllegalArgumentException("If-Match is invalid");
        return Long.parseLong(value.substring(1, value.length() - 1));
    }

    record PatientCreateRequest(
            @NotBlank @Size(max = 200) String fullName,
            @NotNull LocalDate dateOfBirth,
            @Size(max = 32) String phone,
            @Size(max = 320) String email,
            @Pattern(regexp = "MALE|FEMALE|OTHER|UNKNOWN") String declaredGender,
            @Size(max = 1000) String address,
            Map<String, Object> emergencyContact) {
    }

    record PatientUpdateRequest(
            @NotBlank @Size(max = 200) String fullName,
            @NotNull LocalDate dateOfBirth,
            @Size(max = 32) String phone,
            @Size(max = 320) String email,
            @Pattern(regexp = "MALE|FEMALE|OTHER|UNKNOWN") String declaredGender,
            @Size(max = 1000) String address,
            Map<String, Object> emergencyContact) {
    }

    record PatientIdentifierAddRequest(
            @NotBlank @Pattern(regexp = "CCCD|NATIONAL_ID|PASSPORT") String identifierType,
            @NotBlank @Size(max = 128) String issuer,
            @NotBlank @Size(max = 64) String jurisdiction,
            @NotBlank @Size(max = 512) String value,
            @NotBlank @Pattern(regexp = "SELF_DECLARED|STAFF_RECORDED") String verificationSource) {
    }

    record PatientIdentifierVerifyRequest(@NotBlank @Size(max = 256) String evidenceReference) {
    }

    record PatientAccountLinkRequest(
            @NotNull UUID accountId,
            @NotBlank @Size(max = 64) String relationship,
            @NotBlank @Pattern(regexp = "PENDING|IDENTITY_VERIFIED|REPRESENTATION_VERIFIED") String verificationTier,
            @NotNull Map<String, Object> permissionScope,
            @NotNull Instant validFrom,
            Instant validTo) {
    }

    record DuplicateReviewRequest(
            @NotBlank @Pattern(regexp = "CONFIRMED|REJECTED") String status,
            @NotBlank @Size(max = 500) String reviewReason) {
    }

    record ReasonRequest(@NotBlank @Size(max = 500) String reason) {
    }
}
