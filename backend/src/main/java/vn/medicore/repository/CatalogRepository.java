package vn.medicore.repository;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import vn.medicore.dto.CatalogModels.DepartmentView;
import vn.medicore.dto.CatalogModels.PractitionerRoleView;
import vn.medicore.dto.CatalogModels.PractitionerView;
import vn.medicore.dto.CatalogModels.RoomView;
import vn.medicore.dto.CatalogModels.ServicePriceView;
import vn.medicore.dto.CatalogModels.ServiceView;

public interface CatalogRepository {

    // ---- Department ----

    void insertDepartment(DepartmentRow row);

    Optional<DepartmentView> departmentById(UUID id);

    Optional<DepartmentView> departmentByIdForUpdate(UUID id);

    List<DepartmentView> listDepartments(Boolean active, int limit, int offset);

    int updateDepartment(DepartmentRow row, long expectedVersion);

    // ---- Room ----

    void insertRoom(RoomRow row);

    Optional<RoomView> roomById(UUID id);

    Optional<RoomView> roomByIdForUpdate(UUID id);

    List<RoomView> listRooms(UUID departmentId, Boolean active, int limit, int offset);

    int updateRoom(RoomRow row, long expectedVersion);

    // ---- Service ----

    void insertService(ServiceRow row);

    Optional<ServiceView> serviceById(UUID id);

    Optional<ServiceView> serviceByIdForUpdate(UUID id);

    List<ServiceView> listServices(String serviceType, Boolean active, int limit, int offset);

    int updateService(ServiceRow row, long expectedVersion);

    // ---- ServicePrice ----

    void insertServicePrice(ServicePriceRow row);

    List<ServicePriceView> listPrices(UUID serviceId, int limit, int offset);

    Optional<ServicePriceView> priceById(UUID id);

    Optional<ServicePriceView> currentPrice(UUID serviceId, Instant at);

    void endServicePrice(UUID id, Instant effectiveTo);

    // ---- Practitioner ----

    void insertPractitioner(PractitionerRow row);

    Optional<PractitionerView> practitionerById(UUID id);

    Optional<PractitionerView> practitionerByIdForUpdate(UUID id);

    List<PractitionerView> listPractitioners(Boolean active, String cursor, int limit, int offset);

    int updatePractitioner(PractitionerRow row, long expectedVersion);

    // ---- PractitionerRole ----

    void insertPractitionerRole(PractitionerRoleRow row);

    Optional<PractitionerRoleView> practitionerRoleById(UUID id);

    Optional<PractitionerRoleView> practitionerRoleByIdForUpdate(UUID id);

    List<PractitionerRoleView> listPractitionerRoles(UUID practitionerId, UUID departmentId, String status, int limit, int offset);

    int revokePractitionerRole(UUID id, long expectedVersion, Instant now);

    // ---- Projection records ----

    record DepartmentRow(
            UUID id,
            String code,
            String name,
            boolean active,
            Instant effectiveFrom,
            Instant effectiveTo,
            long version,
            Instant createdAt,
            Instant updatedAt) {
    }

    record RoomRow(
            UUID id,
            UUID departmentId,
            String code,
            String name,
            boolean active,
            long version,
            Instant createdAt,
            Instant updatedAt) {
    }

    record ServiceRow(
            UUID id,
            String code,
            String name,
            String serviceType,
            boolean active,
            boolean allowsCritical,
            long version,
            Instant createdAt,
            Instant updatedAt) {
    }

    record ServicePriceRow(
            UUID id,
            UUID serviceId,
            BigDecimal amount,
            String currency,
            Instant effectiveFrom,
            Instant effectiveTo,
            Instant createdAt) {
    }

    record PractitionerRow(
            UUID id,
            UUID userAccountId,
            String staffCode,
            String fullName,
            boolean active,
            long version,
            Instant createdAt,
            Instant updatedAt) {
    }

    record PractitionerRoleRow(
            UUID id,
            UUID practitionerId,
            UUID departmentId,
            String roleCode,
            Instant effectiveFrom,
            Instant effectiveTo,
            String status,
            long version,
            Instant createdAt,
            Instant updatedAt) {
    }
}
