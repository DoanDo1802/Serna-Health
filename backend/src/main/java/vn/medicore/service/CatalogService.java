package vn.medicore.service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import vn.medicore.dto.CatalogModels.DepartmentView;
import vn.medicore.dto.CatalogModels.Page;
import vn.medicore.dto.CatalogModels.PractitionerRoleView;
import vn.medicore.dto.CatalogModels.PractitionerView;
import vn.medicore.dto.CatalogModels.RoomView;
import vn.medicore.dto.CatalogModels.ServicePriceView;
import vn.medicore.dto.CatalogModels.ServiceView;

public interface CatalogService {

    // ---- Department ----
    Page<DepartmentView> listDepartments(Boolean active, String cursor, int limit);

    DepartmentView getDepartment(UUID id);

    DepartmentView createDepartment(String code, String name, Instant effectiveFrom, Instant effectiveTo, UUID actorId);

    DepartmentView updateDepartment(UUID id, String code, String name, Instant effectiveFrom, Instant effectiveTo, long version, UUID actorId);

    DepartmentView deactivateDepartment(UUID id, long version, UUID actorId);

    // ---- Room ----
    Page<RoomView> listRooms(UUID departmentId, Boolean active, String cursor, int limit);

    RoomView getRoom(UUID id);

    RoomView createRoom(UUID departmentId, String code, String name, UUID actorId);

    RoomView updateRoom(UUID id, String code, String name, long version, UUID actorId);

    RoomView deactivateRoom(UUID id, long version, UUID actorId);

    // ---- Service ----
    Page<ServiceView> listServices(String serviceType, Boolean active, String cursor, int limit);

    ServiceView getService(UUID id);

    ServiceView createService(String code, String name, String serviceType, UUID actorId);

    ServiceView updateService(UUID id, String code, String name, String serviceType, long version, UUID actorId);

    ServiceView deactivateService(UUID id, long version, UUID actorId);

    // ---- ServicePrice ----
    Page<ServicePriceView> listServicePrices(UUID serviceId, String cursor, int limit);

    ServicePriceView getServicePrice(UUID id);

    ServicePriceView createServicePrice(UUID serviceId, BigDecimal amount, Instant effectiveFrom, UUID actorId);

    void endServicePrice(UUID id, Instant effectiveTo, UUID actorId);

    // ---- Practitioner ----
    Page<PractitionerView> listPractitioners(Boolean active, String cursor, int limit);

    PractitionerView getPractitioner(UUID id);

    PractitionerView createPractitioner(UUID userAccountId, String staffCode, String fullName, UUID actorId);

    PractitionerView updatePractitioner(UUID id, String staffCode, String fullName, long version, UUID actorId);

    PractitionerView deactivatePractitioner(UUID id, long version, UUID actorId);

    // ---- PractitionerRole ----
    Page<PractitionerRoleView> listPractitionerRoles(UUID practitionerId, UUID departmentId, String status, String cursor, int limit);

    PractitionerRoleView getPractitionerRole(UUID id);

    PractitionerRoleView assignPractitionerRole(UUID practitionerId, UUID departmentId, String roleCode, Instant effectiveFrom, Instant effectiveTo, UUID actorId);

    PractitionerRoleView revokePractitionerRole(UUID id, long version, UUID actorId);
}
