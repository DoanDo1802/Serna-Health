package vn.medicore.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.medicore.common.web.RequestContext;
import vn.medicore.dto.AuthenticatedAccount;
import vn.medicore.dto.IdentityAuditContext;
import vn.medicore.dto.PersonnelModels.DoctorProfile;
import vn.medicore.dto.PersonnelModels.PersonnelCommand;
import vn.medicore.dto.PersonnelModels.PersonnelPage;
import vn.medicore.dto.PersonnelModels.PersonnelView;
import vn.medicore.service.PersonnelProvisioningService;

@RestController
@RequestMapping("/api/v1/admin/personnel")
@PreAuthorize("hasAuthority('account.provision')")
public class PersonnelProvisioningController {

    private final PersonnelProvisioningService personnel;

    public PersonnelProvisioningController(PersonnelProvisioningService personnel) {
        this.personnel = personnel;
    }

    @GetMapping
    PersonnelPage list(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit) {
        return personnel.list(type, active, cursor, limit);
    }

    @PostMapping
    ResponseEntity<PersonnelView> provision(
            HttpServletRequest request,
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @Valid @RequestBody PersonnelRequest body) {
        PersonnelView view = personnel.provision(command(body, true), audit(request, principal));
        return ResponseEntity.ok().eTag(Long.toString(view.accountVersion())).body(view);
    }

    @GetMapping("/{accountId}")
    ResponseEntity<PersonnelView> get(@PathVariable UUID accountId) {
        PersonnelView view = personnel.get(accountId);
        return ResponseEntity.ok().eTag(Long.toString(view.accountVersion())).body(view);
    }

    @PatchMapping("/{accountId}")
    ResponseEntity<PersonnelView> update(
            HttpServletRequest request,
            @PathVariable UUID accountId,
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @RequestHeader("If-Match") String ifMatch,
            @Valid @RequestBody PersonnelRequest body) {
        PersonnelView view = personnel.update(accountId, command(body, false), version(ifMatch), audit(request, principal));
        return ResponseEntity.ok().eTag(Long.toString(view.accountVersion())).body(view);
    }

    @PostMapping("/{accountId}/actions/deactivate")
    ResponseEntity<PersonnelView> deactivate(
            HttpServletRequest request,
            @PathVariable UUID accountId,
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @RequestHeader("If-Match") String ifMatch,
            @Valid @RequestBody ReasonRequest body) {
        PersonnelView view = personnel.deactivate(accountId, body.reason(), version(ifMatch), audit(request, principal));
        return ResponseEntity.ok().eTag(Long.toString(view.accountVersion())).body(view);
    }

    private static PersonnelCommand command(PersonnelRequest body, boolean creating) {
        if (!creating && (body.email() != null || body.initialPassword() != null)) {
            throw new IllegalArgumentException("Email and initial password cannot be updated through personnel provisioning");
        }
        if ("STAFF".equals(body.type()) && (body.departmentId() != null || body.doctorProfile() != null)) {
            throw new IllegalArgumentException("Staff personnel cannot include doctor fields");
        }
        return new PersonnelCommand(body.type(), body.email(), creating ? body.initialPassword() : null, body.staffCode(),
                body.fullName(), body.departmentId(), body.doctorProfile() == null ? null : new DoctorProfile(
                        body.doctorProfile().phone(), body.doctorProfile().dateOfBirth(), body.doctorProfile().gender(),
                        body.doctorProfile().address(), body.doctorProfile().professionalTitle(), body.doctorProfile().academicDegree(),
                        body.doctorProfile().specialtyDesignation(), body.doctorProfile().licenseNumber(),
                        body.doctorProfile().licensingAuthority(), body.doctorProfile().licenseIssuedOn(),
                        body.doctorProfile().licenseExpiresOn(), body.doctorProfile().yearsExperience(),
                        body.doctorProfile().biography(), body.doctorProfile().avatarUrl(), 0, null, null));
    }

    private static IdentityAuditContext audit(HttpServletRequest request, AuthenticatedAccount principal) {
        return new IdentityAuditContext(principal.accountId(), principal.sessionId().toString(),
                Map.of("permissions", List.copyOf(principal.permissions())), RequestContext.requestId(request),
                RequestContext.correlationId(request));
    }

    private static long version(String value) {
        if (value == null || !value.matches("^\"[0-9]+\"$")) throw new IllegalArgumentException("If-Match is invalid");
        return Long.parseLong(value.substring(1, value.length() - 1));
    }

    record PersonnelRequest(
            @NotBlank @jakarta.validation.constraints.Pattern(regexp = "DOCTOR|STAFF") String type,
            @jakarta.validation.constraints.Email @Size(max = 320) String email,
            @Size(min = 6, max = 128) String initialPassword,
            @NotBlank @Size(max = 64) String staffCode,
            @NotBlank @Size(max = 200) String fullName,
            UUID departmentId,
            @Valid DoctorProfileRequest doctorProfile) {
    }

    record DoctorProfileRequest(
            @NotBlank @jakarta.validation.constraints.Pattern(regexp = "^\\+[1-9]\\d{7,14}$") String phone,
            @NotNull LocalDate dateOfBirth,
            @NotBlank @jakarta.validation.constraints.Pattern(regexp = "MALE|FEMALE|OTHER|UNSPECIFIED") String gender,
            @NotBlank @Size(max = 1000) String address,
            @NotBlank @Size(max = 200) String professionalTitle,
            @NotBlank @Size(max = 200) String academicDegree,
            @NotBlank @Size(max = 200) String specialtyDesignation,
            @NotBlank @Size(max = 128) String licenseNumber,
            @NotBlank @Size(max = 200) String licensingAuthority,
            @NotNull LocalDate licenseIssuedOn,
            LocalDate licenseExpiresOn,
            @Min(0) @Max(80) int yearsExperience,
            @Size(max = 4000) String biography,
            @Size(max = 2048) String avatarUrl) {
    }

    record ReasonRequest(@NotBlank @Size(max = 500) String reason) {
    }
}
