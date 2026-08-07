package vn.medicore.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.medicore.dto.AuthenticatedAccount;
import vn.medicore.dto.PatientModels.PatientAccountLinkView;
import vn.medicore.dto.PatientModels.PatientDuplicateCandidateView;
import vn.medicore.dto.PatientModels.PatientIdentifierView;
import vn.medicore.dto.PatientModels.PatientView;
import vn.medicore.service.PatientService;

@RestController
@RequestMapping("/api/v1")
public class PatientController {

    private final PatientService patientService;

    public PatientController(PatientService patientService) {
        this.patientService = patientService;
    }

    // ===========================================================
    // Patient
    // ===========================================================

    @GetMapping("/patients")
    @PreAuthorize("hasAuthority('patient.read')")
    List<PatientView> searchPatients(
            @RequestParam(required = false) String query,
            @RequestParam(defaultValue = "0") @Min(0) int offset,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit) {
        return patientService.searchPatients(query, limit, offset);
    }

    @GetMapping("/patients/{id}")
    @PreAuthorize("hasAuthority('patient.read')")
    ResponseEntity<PatientView> getPatient(@PathVariable UUID id) {
        PatientView view = patientService.getPatient(id);
        return versioned(view, view.version());
    }

    @PostMapping("/patients")
    @PreAuthorize("hasAuthority('patient.manage')")
    ResponseEntity<PatientView> createPatient(
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @Valid @RequestBody PatientCreateRequest body) {
        PatientView view = patientService.createPatient(
                body.fullName(), body.dateOfBirth(), body.phone(), body.email(),
                body.declaredGender(), body.address(), body.emergencyContact(), principal.accountId());
        return versioned(view, view.version());
    }

    @PutMapping("/patients/{id}")
    @PreAuthorize("hasAuthority('patient.manage')")
    ResponseEntity<PatientView> updatePatient(
            @PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @RequestHeader("If-Match") String ifMatch,
            @Valid @RequestBody PatientUpdateRequest body) {
        PatientView view = patientService.updatePatient(
                id, body.fullName(), body.dateOfBirth(), body.phone(), body.email(),
                body.declaredGender(), body.address(), body.emergencyContact(), version(ifMatch), principal.accountId());
        return versioned(view, view.version());
    }

    // ===========================================================
    // PatientIdentifier
    // ===========================================================

    @GetMapping("/patients/{patientId}/identifiers")
    @PreAuthorize("hasAuthority('patient.read')")
    List<PatientIdentifierView> listPatientIdentifiers(@PathVariable UUID patientId) {
        return patientService.listPatientIdentifiers(patientId);
    }

    @PostMapping("/patients/{patientId}/identifiers")
    @PreAuthorize("hasAuthority('patient.manage')")
    PatientIdentifierView addPatientIdentifier(
            @PathVariable UUID patientId,
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @Valid @RequestBody PatientIdentifierAddRequest body) {
        String suffix = body.value().length() > 4 ? body.value().substring(body.value().length() - 4) : body.value();
        return patientService.addPatientIdentifier(
                patientId, body.identifierType(), body.issuer(), body.jurisdiction(),
                body.value(), suffix, body.verificationSource(), principal.accountId());
    }

    @PostMapping("/patient-identifiers/{id}/actions/verify-manually")
    @PreAuthorize("hasAuthority('patient.identity.verify')")
    ResponseEntity<PatientIdentifierView> verifyPatientIdentifierManually(
            @PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @RequestHeader("If-Match") String ifMatch,
            @Valid @RequestBody PatientIdentifierVerifyRequest body) {
        PatientIdentifierView view = patientService.verifyPatientIdentifierManually(id, body.evidenceReference(), version(ifMatch), principal.accountId());
        return versioned(view, view.version());
    }

    @PostMapping("/patient-identifiers/{id}/actions/revoke")
    @PreAuthorize("hasAuthority('patient.manage')")
    ResponseEntity<PatientIdentifierView> revokePatientIdentifier(
            @PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @RequestHeader("If-Match") String ifMatch) {
        PatientIdentifierView view = patientService.revokePatientIdentifier(id, version(ifMatch), principal.accountId());
        return versioned(view, view.version());
    }

    // ===========================================================
    // PatientAccountLink
    // ===========================================================

    @GetMapping("/patients/{patientId}/account-links")
    @PreAuthorize("hasAuthority('patient.read')")
    List<PatientAccountLinkView> listPatientAccountLinks(@PathVariable UUID patientId) {
        return patientService.listPatientAccountLinks(patientId);
    }

    @PostMapping("/patients/{patientId}/account-links")
    @PreAuthorize("hasAuthority('patient.manage')")
    PatientAccountLinkView linkPatientAccount(
            @PathVariable UUID patientId,
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @Valid @RequestBody PatientAccountLinkRequest body) {
        return patientService.linkPatientAccount(
                body.accountId(), patientId, body.relationship(), body.verificationTier(),
                body.permissionScope(), body.validFrom(), body.validTo(), principal.accountId());
    }

    // ===========================================================
    // PatientDuplicateCandidate
    // ===========================================================

    @GetMapping("/patient-duplicate-candidates")
    @PreAuthorize("hasAuthority('patient.duplicate.review')")
    List<PatientDuplicateCandidateView> listDuplicateCandidates(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") @Min(0) int offset,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit) {
        return patientService.listDuplicateCandidates(status, limit, offset);
    }

    @GetMapping("/patient-duplicate-candidates/{id}")
    @PreAuthorize("hasAuthority('patient.duplicate.review')")
    ResponseEntity<PatientDuplicateCandidateView> getDuplicateCandidate(@PathVariable UUID id) {
        PatientDuplicateCandidateView view = patientService.getDuplicateCandidate(id);
        return versioned(view, view.version());
    }

    @PostMapping("/patient-duplicate-candidates/{id}/actions/review")
    @PreAuthorize("hasAuthority('patient.duplicate.review')")
    ResponseEntity<PatientDuplicateCandidateView> reviewDuplicateCandidate(
            @PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @RequestHeader("If-Match") String ifMatch,
            @Valid @RequestBody DuplicateReviewRequest body) {
        PatientDuplicateCandidateView view = patientService.reviewDuplicateCandidate(id, body.status(), body.reviewReason(), version(ifMatch), principal.accountId());
        return versioned(view, view.version());
    }

    // ===========================================================
    // Helpers
    // ===========================================================

    private static <T> ResponseEntity<T> versioned(T body, long version) {
        return ResponseEntity.ok().eTag(Long.toString(version)).body(body);
    }

    private static long version(String value) {
        if (value == null || !value.matches("^\"[0-9]+\"$")) throw new IllegalArgumentException("If-Match is invalid");
        return Long.parseLong(value.substring(1, value.length() - 1));
    }

    // ===========================================================
    // Request records
    // ===========================================================

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
            @NotBlank @Size(max = 64) String identifierType,
            @NotBlank @Size(max = 128) String issuer,
            @NotBlank @Size(max = 64) String jurisdiction,
            @NotBlank @Size(max = 512) String value,
            @NotBlank @Pattern(regexp = "SELF_DECLARED|STAFF_RECORDED") String verificationSource) {
    }

    record PatientIdentifierVerifyRequest(
            @NotBlank @Size(max = 256) String evidenceReference) {
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
            @NotBlank @Pattern(regexp = "CONFIRMED|REJECTED|ENTERED_IN_ERROR") String status,
            @NotBlank @Size(max = 500) String reviewReason) {
    }
}
