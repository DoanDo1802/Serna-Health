package vn.medicore.controller;

import jakarta.servlet.http.HttpServletRequest;
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
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
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
import vn.medicore.dto.CatalogAuditContext;
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

    @GetMapping("/departments")
    @PreAuthorize("hasAuthority('department.read')")
    Page<DepartmentView> listDepartments(@RequestParam(required = false) Boolean active,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit) {
        return catalog.listDepartments(active, cursor, limit);
    }

    @GetMapping("/departments/{id}")
    @PreAuthorize("hasAuthority('department.read')")
    ResponseEntity<DepartmentView> getDepartment(@PathVariable UUID id) {
        DepartmentView view = catalog.getDepartment(id);
        return versioned(view, view.version());
    }

    @PostMapping("/departments")
    @PreAuthorize("hasAuthority('department.create')")
    ResponseEntity<DepartmentView> createDepartment(HttpServletRequest request,
            @AuthenticationPrincipal AuthenticatedAccount principal, @Valid @RequestBody DepartmentCreateRequest body) {
        DepartmentView view = catalog.createDepartment(body.code(), body.name(), body.effectiveFrom(), body.effectiveTo(), auditContext(request, principal));
        return versioned(view, view.version());
    }

    @PatchMapping("/departments/{id}")
    @PreAuthorize("hasAuthority('department.update')")
    ResponseEntity<DepartmentView> updateDepartment(HttpServletRequest request, @PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedAccount principal, @RequestHeader("If-Match") String ifMatch,
            @Valid @RequestBody DepartmentUpdateRequest body) {
        DepartmentView view = catalog.updateDepartment(id, body.code(), body.name(), body.effectiveFrom(), body.effectiveTo(), version(ifMatch), auditContext(request, principal));
        return versioned(view, view.version());
    }

    @PostMapping("/departments/{id}/actions/deactivate")
    @PreAuthorize("hasAuthority('department.update')")
    ResponseEntity<DepartmentView> deactivateDepartment(HttpServletRequest request, @PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedAccount principal, @RequestHeader("If-Match") String ifMatch) {
        DepartmentView view = catalog.deactivateDepartment(id, version(ifMatch), auditContext(request, principal));
        return versioned(view, view.version());
    }

    @PostMapping("/departments/{id}/actions/activate")
    @PreAuthorize("hasAuthority('department.update')")
    ResponseEntity<DepartmentView> activateDepartment(HttpServletRequest request, @PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedAccount principal, @RequestHeader("If-Match") String ifMatch) {
        DepartmentView view = catalog.activateDepartment(id, version(ifMatch), auditContext(request, principal));
        return versioned(view, view.version());
    }

    @DeleteMapping("/departments/{id}")
    @PreAuthorize("hasAuthority('department.update')")
    ResponseEntity<Void> deleteDepartment(HttpServletRequest request, @PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedAccount principal, @RequestHeader("If-Match") String ifMatch) {
        catalog.deleteDepartment(id, version(ifMatch), auditContext(request, principal));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/rooms")
    @PreAuthorize("hasAuthority('room.read')")
    Page<RoomView> listRooms(@RequestParam(required = false) UUID departmentId, @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) String cursor, @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit) {
        return catalog.listRooms(departmentId, active, cursor, limit);
    }

    @GetMapping("/rooms/{id}")
    @PreAuthorize("hasAuthority('room.read')")
    ResponseEntity<RoomView> getRoom(@PathVariable UUID id) {
        RoomView view = catalog.getRoom(id);
        return versioned(view, view.version());
    }

    @PostMapping("/rooms")
    @PreAuthorize("hasAuthority('room.create')")
    ResponseEntity<RoomView> createRoom(HttpServletRequest request, @AuthenticationPrincipal AuthenticatedAccount principal,
            @Valid @RequestBody RoomCreateRequest body) {
        RoomView view = catalog.createRoom(body.departmentId(), body.code(), body.name(), auditContext(request, principal));
        return versioned(view, view.version());
    }

    @PatchMapping("/rooms/{id}")
    @PreAuthorize("hasAuthority('room.update')")
    ResponseEntity<RoomView> updateRoom(HttpServletRequest request, @PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedAccount principal, @RequestHeader("If-Match") String ifMatch,
            @Valid @RequestBody RoomUpdateRequest body) {
        RoomView view = catalog.updateRoom(id, body.code(), body.name(), version(ifMatch), auditContext(request, principal));
        return versioned(view, view.version());
    }

    @PostMapping("/rooms/{id}/actions/deactivate")
    @PreAuthorize("hasAuthority('room.update')")
    ResponseEntity<RoomView> deactivateRoom(HttpServletRequest request, @PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedAccount principal, @RequestHeader("If-Match") String ifMatch) {
        RoomView view = catalog.deactivateRoom(id, version(ifMatch), auditContext(request, principal));
        return versioned(view, view.version());
    }

    @GetMapping("/services")
    @PreAuthorize("hasAuthority('service.read')")
    Page<ServiceView> listServices(@RequestParam(required = false) String serviceType, @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) String cursor, @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit) {
        return catalog.listServices(serviceType, active, cursor, limit);
    }

    @GetMapping("/services/{id}")
    @PreAuthorize("hasAuthority('service.read')")
    ResponseEntity<ServiceView> getService(@PathVariable UUID id) {
        ServiceView view = catalog.getService(id);
        return versioned(view, view.version());
    }

    @PostMapping("/services")
    @PreAuthorize("hasAuthority('service.create')")
    ResponseEntity<ServiceView> createService(HttpServletRequest request, @AuthenticationPrincipal AuthenticatedAccount principal,
            @Valid @RequestBody ServiceCreateRequest body) {
        ServiceView view = catalog.createService(body.code(), body.name(), body.serviceType(), auditContext(request, principal));
        return versioned(view, view.version());
    }

    @PatchMapping("/services/{id}")
    @PreAuthorize("hasAuthority('service.update')")
    ResponseEntity<ServiceView> updateService(HttpServletRequest request, @PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedAccount principal, @RequestHeader("If-Match") String ifMatch,
            @Valid @RequestBody ServiceUpdateRequest body) {
        ServiceView view = catalog.updateService(id, body.code(), body.name(), body.serviceType(), version(ifMatch), auditContext(request, principal));
        return versioned(view, view.version());
    }

    @PostMapping("/services/{id}/actions/deactivate")
    @PreAuthorize("hasAuthority('service.update')")
    ResponseEntity<ServiceView> deactivateService(HttpServletRequest request, @PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedAccount principal, @RequestHeader("If-Match") String ifMatch) {
        ServiceView view = catalog.deactivateService(id, version(ifMatch), auditContext(request, principal));
        return versioned(view, view.version());
    }

    @GetMapping("/services/{serviceId}/prices")
    @PreAuthorize("hasAuthority('service_price.read')")
    Page<ServicePriceView> listServicePrices(@PathVariable UUID serviceId, @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit) {
        return catalog.listServicePrices(serviceId, cursor, limit);
    }

    @GetMapping("/service-prices/{id}")
    @PreAuthorize("hasAuthority('service_price.read')")
    ResponseEntity<ServicePriceView> getServicePrice(@PathVariable UUID id) {
        ServicePriceView view = catalog.getServicePrice(id);
        return versioned(view, view.version());
    }

    @PostMapping("/services/{serviceId}/prices")
    @PreAuthorize("hasAuthority('service_price.create')")
    ResponseEntity<ServicePriceView> createServicePrice(HttpServletRequest request, @PathVariable UUID serviceId,
            @AuthenticationPrincipal AuthenticatedAccount principal, @Valid @RequestBody ServicePriceCreateRequest body) {
        ServicePriceView view = catalog.createServicePrice(serviceId, body.amount(), body.effectiveFrom(), auditContext(request, principal));
        return versioned(view, view.version());
    }

    @PostMapping("/service-prices/{id}/actions/end")
    @PreAuthorize("hasAuthority('service_price.update')")
    ResponseEntity<ServicePriceView> endServicePrice(HttpServletRequest request, @PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedAccount principal, @RequestHeader("If-Match") String ifMatch,
            @Valid @RequestBody ServicePriceEndRequest body) {
        ServicePriceView view = catalog.endServicePrice(id, body.effectiveTo(), version(ifMatch), auditContext(request, principal));
        return versioned(view, view.version());
    }

    @GetMapping("/practitioners")
    @PreAuthorize("hasAuthority('practitioner.read')")
    Page<PractitionerView> listPractitioners(@RequestParam(required = false) Boolean active,
            @RequestParam(required = false) String cursor, @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit) {
        return catalog.listPractitioners(active, cursor, limit);
    }

    @GetMapping("/practitioners/{id}")
    @PreAuthorize("hasAuthority('practitioner.read')")
    ResponseEntity<PractitionerView> getPractitioner(@PathVariable UUID id) {
        PractitionerView view = catalog.getPractitioner(id);
        return versioned(view, view.version());
    }

    @PostMapping("/practitioners")
    @PreAuthorize("hasAuthority('practitioner.create')")
    ResponseEntity<PractitionerView> createPractitioner(HttpServletRequest request,
            @AuthenticationPrincipal AuthenticatedAccount principal, @Valid @RequestBody PractitionerCreateRequest body) {
        PractitionerView view = catalog.createPractitioner(body.userAccountId(), body.staffCode(), body.fullName(), auditContext(request, principal));
        return versioned(view, view.version());
    }

    @PatchMapping("/practitioners/{id}")
    @PreAuthorize("hasAuthority('practitioner.update')")
    ResponseEntity<PractitionerView> updatePractitioner(HttpServletRequest request, @PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedAccount principal, @RequestHeader("If-Match") String ifMatch,
            @Valid @RequestBody PractitionerUpdateRequest body) {
        PractitionerView view = catalog.updatePractitioner(id, body.staffCode(), body.fullName(), version(ifMatch), auditContext(request, principal));
        return versioned(view, view.version());
    }

    @PostMapping("/practitioners/{id}/actions/deactivate")
    @PreAuthorize("hasAuthority('practitioner.update')")
    ResponseEntity<PractitionerView> deactivatePractitioner(HttpServletRequest request, @PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedAccount principal, @RequestHeader("If-Match") String ifMatch) {
        PractitionerView view = catalog.deactivatePractitioner(id, version(ifMatch), auditContext(request, principal));
        return versioned(view, view.version());
    }

    @GetMapping("/practitioners/{practitionerId}/roles")
    @PreAuthorize("hasAuthority('practitioner_role.read')")
    Page<PractitionerRoleView> listPractitionerRoles(@PathVariable UUID practitionerId,
            @RequestParam(required = false) UUID departmentId, @RequestParam(required = false) String status,
            @RequestParam(required = false) String cursor, @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit) {
        return catalog.listPractitionerRoles(practitionerId, departmentId, status, cursor, limit);
    }

    @GetMapping("/practitioner-roles/{id}")
    @PreAuthorize("hasAuthority('practitioner_role.read')")
    ResponseEntity<PractitionerRoleView> getPractitionerRole(@PathVariable UUID id) {
        PractitionerRoleView view = catalog.getPractitionerRole(id);
        return versioned(view, view.version());
    }

    @PostMapping("/practitioners/{practitionerId}/roles")
    @PreAuthorize("hasAuthority('practitioner_role.create')")
    ResponseEntity<PractitionerRoleView> assignPractitionerRole(HttpServletRequest request, @PathVariable UUID practitionerId,
            @AuthenticationPrincipal AuthenticatedAccount principal, @Valid @RequestBody PractitionerRoleAssignRequest body) {
        PractitionerRoleView view = catalog.assignPractitionerRole(practitionerId, body.departmentId(), body.roleCode(),
                body.effectiveFrom(), body.effectiveTo(), auditContext(request, principal));
        return versioned(view, view.version());
    }

    @PostMapping("/practitioner-roles/{id}/actions/revoke")
    @PreAuthorize("hasAuthority('practitioner_role.update')")
    ResponseEntity<PractitionerRoleView> revokePractitionerRole(HttpServletRequest request, @PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedAccount principal, @RequestHeader("If-Match") String ifMatch,
            @Valid @RequestBody PractitionerRoleRevokeRequest body) {
        PractitionerRoleView view = catalog.revokePractitionerRole(id, version(ifMatch), body.reason(), auditContext(request, principal));
        return versioned(view, view.version());
    }

    private static CatalogAuditContext auditContext(HttpServletRequest request, AuthenticatedAccount principal) {
        return new CatalogAuditContext(principal.accountId(), principal.sessionId().toString(),
                Map.of("permissions", List.copyOf(principal.permissions())),
                RequestContext.requestId(request), RequestContext.correlationId(request));
    }

    private static <T> ResponseEntity<T> versioned(T body, long version) {
        return ResponseEntity.ok().eTag(Long.toString(version)).body(body);
    }

    private static long version(String value) {
        if (value == null || !value.matches("^\"[0-9]+\"$")) throw new IllegalArgumentException("If-Match is invalid");
        return Long.parseLong(value.substring(1, value.length() - 1));
    }

    record DepartmentCreateRequest(@NotBlank @Size(max = 64) String code, @NotBlank @Size(max = 200) String name,
                                   @NotNull Instant effectiveFrom, Instant effectiveTo) {}
    record DepartmentUpdateRequest(@NotBlank @Size(max = 64) String code, @NotBlank @Size(max = 200) String name,
                                   @NotNull Instant effectiveFrom, Instant effectiveTo) {}
    record RoomCreateRequest(@NotNull UUID departmentId, @NotBlank @Size(max = 64) String code,
                             @NotBlank @Size(max = 200) String name) {}
    record RoomUpdateRequest(@NotBlank @Size(max = 64) String code, @NotBlank @Size(max = 200) String name) {}
    record ServiceCreateRequest(@NotBlank @Size(max = 64) String code, @NotBlank @Size(max = 200) String name,
                                @NotBlank @Pattern(regexp = "CONSULTATION|PROCEDURE|DIAGNOSTIC|LAB|IMAGING|THERAPY|OTHER") String serviceType) {}
    record ServiceUpdateRequest(@NotBlank @Size(max = 64) String code, @NotBlank @Size(max = 200) String name,
                                @NotBlank @Pattern(regexp = "CONSULTATION|PROCEDURE|DIAGNOSTIC|LAB|IMAGING|THERAPY|OTHER") String serviceType) {}
    record ServicePriceCreateRequest(@NotNull @DecimalMin("0.00") BigDecimal amount, @NotNull Instant effectiveFrom) {}
    record ServicePriceEndRequest(@NotNull Instant effectiveTo) {}
    record PractitionerCreateRequest(UUID userAccountId, @NotBlank @Size(max = 64) String staffCode,
                                    @NotBlank @Size(max = 200) String fullName) {}
    record PractitionerUpdateRequest(@NotBlank @Size(max = 64) String staffCode, @NotBlank @Size(max = 200) String fullName) {}
    record PractitionerRoleAssignRequest(@NotNull UUID departmentId,
                                         @NotBlank @Pattern(regexp = "DOCTOR|TECHNICIAN|LAB_APPROVER|RADIOLOGIST|CARE_COORDINATOR") String roleCode,
                                         @NotNull Instant effectiveFrom, Instant effectiveTo) {}
    record PractitionerRoleRevokeRequest(@NotBlank @Size(max = 500) String reason) {}
}
