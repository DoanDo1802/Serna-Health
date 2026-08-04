package vn.medicore.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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
import vn.medicore.dto.AuthenticatedAccount;
import vn.medicore.dto.CatalogModels.DepartmentView;
import vn.medicore.dto.CatalogModels.Page;
import vn.medicore.dto.CatalogModels.PractitionerRoleView;
import vn.medicore.dto.CatalogModels.PractitionerView;
import vn.medicore.dto.CatalogModels.RoomView;
import vn.medicore.dto.CatalogModels.ServicePriceView;
import vn.medicore.dto.CatalogModels.ServiceView;
import vn.medicore.service.CatalogService;

@RestController
@RequestMapping("/api/v1")
public class CatalogController {

    private final CatalogService catalog;

    public CatalogController(CatalogService catalog) {
        this.catalog = catalog;
    }

    // ===========================================================
    // Department
    // ===========================================================

    @GetMapping("/departments")
    Page<DepartmentView> listDepartments(
            @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit) {
        return catalog.listDepartments(active, cursor, limit);
    }

    @GetMapping("/departments/{id}")
    ResponseEntity<DepartmentView> getDepartment(@PathVariable UUID id) {
        DepartmentView view = catalog.getDepartment(id);
        return versioned(view, view.version());
    }

    @PostMapping("/departments")
    @PreAuthorize("hasAuthority('catalog.department.manage')")
    ResponseEntity<DepartmentView> createDepartment(
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @Valid @RequestBody DepartmentCreateRequest body) {
        DepartmentView view = catalog.createDepartment(
                body.code(), body.name(), body.effectiveFrom(), body.effectiveTo(), principal.accountId());
        return versioned(view, view.version());
    }

    @PutMapping("/departments/{id}")
    @PreAuthorize("hasAuthority('catalog.department.manage')")
    ResponseEntity<DepartmentView> updateDepartment(
            @PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @RequestHeader("If-Match") String ifMatch,
            @Valid @RequestBody DepartmentUpdateRequest body) {
        DepartmentView view = catalog.updateDepartment(
                id, body.code(), body.name(), body.effectiveFrom(), body.effectiveTo(), version(ifMatch), principal.accountId());
        return versioned(view, view.version());
    }

    @PostMapping("/departments/{id}/actions/deactivate")
    @PreAuthorize("hasAuthority('catalog.department.manage')")
    ResponseEntity<DepartmentView> deactivateDepartment(
            @PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @RequestHeader("If-Match") String ifMatch) {
        DepartmentView view = catalog.deactivateDepartment(id, version(ifMatch), principal.accountId());
        return versioned(view, view.version());
    }

    // ===========================================================
    // Room
    // ===========================================================

    @GetMapping("/rooms")
    Page<RoomView> listRooms(
            @RequestParam(required = false) UUID departmentId,
            @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit) {
        return catalog.listRooms(departmentId, active, cursor, limit);
    }

    @GetMapping("/rooms/{id}")
    ResponseEntity<RoomView> getRoom(@PathVariable UUID id) {
        RoomView view = catalog.getRoom(id);
        return versioned(view, view.version());
    }

    @PostMapping("/departments/{departmentId}/rooms")
    @PreAuthorize("hasAuthority('catalog.room.manage')")
    ResponseEntity<RoomView> createRoom(
            @PathVariable UUID departmentId,
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @Valid @RequestBody RoomCreateRequest body) {
        RoomView view = catalog.createRoom(departmentId, body.code(), body.name(), principal.accountId());
        return versioned(view, view.version());
    }

    @PutMapping("/rooms/{id}")
    @PreAuthorize("hasAuthority('catalog.room.manage')")
    ResponseEntity<RoomView> updateRoom(
            @PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @RequestHeader("If-Match") String ifMatch,
            @Valid @RequestBody RoomUpdateRequest body) {
        RoomView view = catalog.updateRoom(id, body.code(), body.name(), version(ifMatch), principal.accountId());
        return versioned(view, view.version());
    }

    @PostMapping("/rooms/{id}/actions/deactivate")
    @PreAuthorize("hasAuthority('catalog.room.manage')")
    ResponseEntity<RoomView> deactivateRoom(
            @PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @RequestHeader("If-Match") String ifMatch) {
        RoomView view = catalog.deactivateRoom(id, version(ifMatch), principal.accountId());
        return versioned(view, view.version());
    }

    // ===========================================================
    // Service
    // ===========================================================

    @GetMapping("/services")
    Page<ServiceView> listServices(
            @RequestParam(required = false) String serviceType,
            @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit) {
        return catalog.listServices(serviceType, active, cursor, limit);
    }

    @GetMapping("/services/{id}")
    ResponseEntity<ServiceView> getService(@PathVariable UUID id) {
        ServiceView view = catalog.getService(id);
        return versioned(view, view.version());
    }

    @PostMapping("/services")
    @PreAuthorize("hasAuthority('catalog.service.manage')")
    ResponseEntity<ServiceView> createService(
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @Valid @RequestBody ServiceCreateRequest body) {
        ServiceView view = catalog.createService(body.code(), body.name(), body.serviceType(), principal.accountId());
        return versioned(view, view.version());
    }

    @PutMapping("/services/{id}")
    @PreAuthorize("hasAuthority('catalog.service.manage')")
    ResponseEntity<ServiceView> updateService(
            @PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @RequestHeader("If-Match") String ifMatch,
            @Valid @RequestBody ServiceUpdateRequest body) {
        ServiceView view = catalog.updateService(id, body.code(), body.name(), body.serviceType(), version(ifMatch), principal.accountId());
        return versioned(view, view.version());
    }

    @PostMapping("/services/{id}/actions/deactivate")
    @PreAuthorize("hasAuthority('catalog.service.manage')")
    ResponseEntity<ServiceView> deactivateService(
            @PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @RequestHeader("If-Match") String ifMatch) {
        ServiceView view = catalog.deactivateService(id, version(ifMatch), principal.accountId());
        return versioned(view, view.version());
    }

    // ===========================================================
    // ServicePrice
    // ===========================================================

    @GetMapping("/services/{serviceId}/prices")
    Page<ServicePriceView> listServicePrices(
            @PathVariable UUID serviceId,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit) {
        return catalog.listServicePrices(serviceId, cursor, limit);
    }

    @GetMapping("/service-prices/{id}")
    ServicePriceView getServicePrice(@PathVariable UUID id) {
        return catalog.getServicePrice(id);
    }

    @PostMapping("/services/{serviceId}/prices")
    @PreAuthorize("hasAuthority('catalog.service.manage')")
    ServicePriceView createServicePrice(
            @PathVariable UUID serviceId,
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @Valid @RequestBody ServicePriceCreateRequest body) {
        return catalog.createServicePrice(serviceId, body.amount(), body.effectiveFrom(), principal.accountId());
    }

    @PostMapping("/service-prices/{id}/actions/end")
    @PreAuthorize("hasAuthority('catalog.service.manage')")
    ResponseEntity<Void> endServicePrice(
            @PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @Valid @RequestBody ServicePriceEndRequest body) {
        catalog.endServicePrice(id, body.effectiveTo(), principal.accountId());
        return ResponseEntity.noContent().build();
    }

    // ===========================================================
    // Practitioner
    // ===========================================================

    @GetMapping("/practitioners")
    Page<PractitionerView> listPractitioners(
            @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit) {
        return catalog.listPractitioners(active, cursor, limit);
    }

    @GetMapping("/practitioners/{id}")
    ResponseEntity<PractitionerView> getPractitioner(@PathVariable UUID id) {
        PractitionerView view = catalog.getPractitioner(id);
        return versioned(view, view.version());
    }

    @PostMapping("/practitioners")
    @PreAuthorize("hasAuthority('catalog.practitioner.manage')")
    ResponseEntity<PractitionerView> createPractitioner(
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @Valid @RequestBody PractitionerCreateRequest body) {
        PractitionerView view = catalog.createPractitioner(body.userAccountId(), body.staffCode(), body.fullName(), principal.accountId());
        return versioned(view, view.version());
    }

    @PutMapping("/practitioners/{id}")
    @PreAuthorize("hasAuthority('catalog.practitioner.manage')")
    ResponseEntity<PractitionerView> updatePractitioner(
            @PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @RequestHeader("If-Match") String ifMatch,
            @Valid @RequestBody PractitionerUpdateRequest body) {
        PractitionerView view = catalog.updatePractitioner(id, body.staffCode(), body.fullName(), version(ifMatch), principal.accountId());
        return versioned(view, view.version());
    }

    @PostMapping("/practitioners/{id}/actions/deactivate")
    @PreAuthorize("hasAuthority('catalog.practitioner.manage')")
    ResponseEntity<PractitionerView> deactivatePractitioner(
            @PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @RequestHeader("If-Match") String ifMatch) {
        PractitionerView view = catalog.deactivatePractitioner(id, version(ifMatch), principal.accountId());
        return versioned(view, view.version());
    }

    // ===========================================================
    // PractitionerRole
    // ===========================================================

    @GetMapping("/practitioner-roles")
    Page<PractitionerRoleView> listPractitionerRoles(
            @RequestParam(required = false) UUID practitionerId,
            @RequestParam(required = false) UUID departmentId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit) {
        return catalog.listPractitionerRoles(practitionerId, departmentId, status, cursor, limit);
    }

    @GetMapping("/practitioner-roles/{id}")
    ResponseEntity<PractitionerRoleView> getPractitionerRole(@PathVariable UUID id) {
        PractitionerRoleView view = catalog.getPractitionerRole(id);
        return versioned(view, view.version());
    }

    @PostMapping("/practitioners/{practitionerId}/roles")
    @PreAuthorize("hasAuthority('catalog.practitioner.manage')")
    ResponseEntity<PractitionerRoleView> assignPractitionerRole(
            @PathVariable UUID practitionerId,
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @Valid @RequestBody PractitionerRoleAssignRequest body) {
        PractitionerRoleView view = catalog.assignPractitionerRole(
                practitionerId, body.departmentId(), body.roleCode(),
                body.effectiveFrom(), body.effectiveTo(), principal.accountId());
        return versioned(view, view.version());
    }

    @PostMapping("/practitioner-roles/{id}/actions/revoke")
    @PreAuthorize("hasAuthority('catalog.practitioner.manage')")
    ResponseEntity<PractitionerRoleView> revokePractitionerRole(
            @PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedAccount principal,
            @RequestHeader("If-Match") String ifMatch) {
        PractitionerRoleView view = catalog.revokePractitionerRole(id, version(ifMatch), principal.accountId());
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

    record DepartmentCreateRequest(
            @NotBlank @Size(max = 64) String code,
            @NotBlank @Size(max = 200) String name,
            @NotNull Instant effectiveFrom,
            Instant effectiveTo) {
    }

    record DepartmentUpdateRequest(
            @NotBlank @Size(max = 64) String code,
            @NotBlank @Size(max = 200) String name,
            @NotNull Instant effectiveFrom,
            Instant effectiveTo) {
    }

    record RoomCreateRequest(
            @NotBlank @Size(max = 64) String code,
            @NotBlank @Size(max = 200) String name) {
    }

    record RoomUpdateRequest(
            @NotBlank @Size(max = 64) String code,
            @NotBlank @Size(max = 200) String name) {
    }

    record ServiceCreateRequest(
            @NotBlank @Size(max = 64) String code,
            @NotBlank @Size(max = 200) String name,
            @NotBlank @Pattern(regexp = "CONSULTATION|PROCEDURE|DIAGNOSTIC|LAB|IMAGING|THERAPY|OTHER") String serviceType) {
    }

    record ServiceUpdateRequest(
            @NotBlank @Size(max = 64) String code,
            @NotBlank @Size(max = 200) String name,
            @NotBlank @Pattern(regexp = "CONSULTATION|PROCEDURE|DIAGNOSTIC|LAB|IMAGING|THERAPY|OTHER") String serviceType) {
    }

    record ServicePriceCreateRequest(
            @NotNull @DecimalMin("0.00") BigDecimal amount,
            @NotNull Instant effectiveFrom) {
    }

    record ServicePriceEndRequest(@NotNull Instant effectiveTo) {
    }

    record PractitionerCreateRequest(
            UUID userAccountId,
            @NotBlank @Size(max = 64) String staffCode,
            @NotBlank @Size(max = 200) String fullName) {
    }

    record PractitionerUpdateRequest(
            @NotBlank @Size(max = 64) String staffCode,
            @NotBlank @Size(max = 200) String fullName) {
    }

    record PractitionerRoleAssignRequest(
            @NotNull UUID departmentId,
            @NotBlank @Pattern(regexp = "DOCTOR|TECHNICIAN|LAB_APPROVER|RADIOLOGIST|CARE_COORDINATOR") String roleCode,
            @NotNull Instant effectiveFrom,
            Instant effectiveTo) {
    }
}
