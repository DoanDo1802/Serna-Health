package vn.medicore.service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import vn.medicore.dto.CatalogAuditContext;
import vn.medicore.dto.CatalogModels.DepartmentView;
import vn.medicore.dto.CatalogModels.Page;
import vn.medicore.dto.CatalogModels.PractitionerRoleView;
import vn.medicore.dto.CatalogModels.PractitionerView;
import vn.medicore.dto.CatalogModels.RoomAssignmentsView;
import vn.medicore.dto.CatalogModels.RoomView;
import vn.medicore.dto.CatalogModels.ServicePriceView;
import vn.medicore.dto.CatalogModels.ServiceView;

public interface CatalogService {

    // ---- Department ----
    Page<DepartmentView> listDepartments(Boolean active, String cursor, int limit);

    DepartmentView getDepartment(UUID id);

    DepartmentView createDepartment(String code, String name, Instant effectiveFrom, Instant effectiveTo, CatalogAuditContext audit);

    DepartmentView updateDepartment(UUID id, String code, String name, Instant effectiveFrom, Instant effectiveTo, long version, CatalogAuditContext audit);

    DepartmentView deactivateDepartment(UUID id, long version, CatalogAuditContext audit);

    DepartmentView activateDepartment(UUID id, long version, CatalogAuditContext audit);

    void deleteDepartment(UUID id, long version, CatalogAuditContext audit);

    // ---- Room ----
    Page<RoomView> listRooms(UUID departmentId, Boolean active, String cursor, int limit);

    RoomView getRoom(UUID id);

    RoomView createRoom(String code, String name, CatalogAuditContext audit);

    RoomView updateRoom(UUID id, String code, String name, long version, CatalogAuditContext audit);

    RoomView deactivateRoom(UUID id, long version, CatalogAuditContext audit);

    void deleteRoom(UUID id, long version, CatalogAuditContext audit);

    RoomAssignmentsView getRoomAssignments(UUID id);

    RoomAssignmentsView replaceRoomAssignments(
            UUID id, List<UUID> departmentIds, List<UUID> serviceIds, long version, CatalogAuditContext audit);

    // ---- Service ----
    Page<ServiceView> listServices(String serviceType, Boolean active, UUID departmentId, String cursor, int limit);

    ServiceView getService(UUID id);

    ServiceView createService(String code, String name, String serviceType, UUID departmentId, CatalogAuditContext audit);

    ServiceView updateService(UUID id, String code, String name, String serviceType, UUID departmentId, long version, CatalogAuditContext audit);

    ServiceView deactivateService(UUID id, long version, CatalogAuditContext audit);

    // ---- ServicePrice ----
    Page<ServicePriceView> listServicePrices(UUID serviceId, String cursor, int limit);

    ServicePriceView getServicePrice(UUID id);

    ServicePriceView createServicePrice(UUID serviceId, BigDecimal amount, Instant effectiveFrom, CatalogAuditContext audit);

    ServicePriceView endServicePrice(UUID id, Instant effectiveTo, long version, CatalogAuditContext audit);

    // ---- Practitioner ----
    Page<PractitionerView> listPractitioners(Boolean active, String cursor, int limit);

    PractitionerView getPractitioner(UUID id);

    PractitionerView createPractitioner(UUID userAccountId, String staffCode, String fullName, CatalogAuditContext audit);

    PractitionerView updatePractitioner(UUID id, String staffCode, String fullName, long version, CatalogAuditContext audit);

    PractitionerView deactivatePractitioner(UUID id, long version, CatalogAuditContext audit);

    // ---- PractitionerRole ----
    Page<PractitionerRoleView> listPractitionerRoles(UUID practitionerId, UUID departmentId, String status, String cursor, int limit);

    PractitionerRoleView getPractitionerRole(UUID id);

    PractitionerRoleView assignPractitionerRole(UUID practitionerId, UUID departmentId, String roleCode, Instant effectiveFrom, Instant effectiveTo, CatalogAuditContext audit);

    PractitionerRoleView revokePractitionerRole(UUID id, long version, String reason, CatalogAuditContext audit);
}
