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

    int countRoomsByDepartmentId(UUID departmentId);

    int countPersonnelByDepartmentId(UUID departmentId);

    int deleteDepartment(UUID departmentId, long expectedVersion);

    // ---- Room ----

    void insertRoom(RoomRow row);

    Optional<RoomView> roomById(UUID id);

    Optional<RoomView> roomByIdForUpdate(UUID id);

    List<RoomView> listRooms(UUID departmentId, Boolean active, int limit, int offset);

    int updateRoom(RoomRow row, long expectedVersion);

    List<UUID> roomDepartmentIds(UUID roomId);

    List<UUID> roomServiceIds(UUID roomId);

    void replaceRoomAssignments(UUID roomId, List<UUID> departmentIds, List<UUID> serviceIds, Instant createdAt);

    int countActiveOrFutureSchedulesUsingRoomDepartmentOrService(
            UUID roomId, List<UUID> removedDepartmentIds, List<UUID> removedServiceIds, Instant now);

    int countSchedulesByRoomId(UUID roomId);

    int deleteRoom(UUID roomId, long expectedVersion);

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

    void closeOpenPriceForService(UUID serviceId, Instant effectiveTo);

    void endServicePrice(UUID id, Instant effectiveTo, long expectedVersion);

    // ---- Practitioner ----

    void insertPractitioner(PractitionerRow row);

    Optional<PractitionerView> practitionerById(UUID id);

    Optional<PractitionerView> practitionerByIdForUpdate(UUID id);

    List<PractitionerView> listPractitioners(Boolean active, int limit, int offset);

    int updatePractitioner(PractitionerRow row, long expectedVersion);

    Optional<PractitionerView> practitionerByAccountId(UUID accountId);

    Optional<PractitionerView> practitionerByStaffCode(String staffCode);

    List<UUID> listPersonnelAccountIds(String type, Boolean active, int limit, int offset);

    void insertPersonnelMember(PersonnelMemberRow row);

    Optional<PersonnelMemberRow> personnelMemberByAccountId(UUID accountId);

    Optional<PersonnelMemberRow> personnelMemberByStaffCode(String staffCode);

    int updatePersonnelMember(PersonnelMemberRow row, long expectedVersion);

    void insertPractitionerProfile(PractitionerProfileRow row);

    Optional<PractitionerProfileRow> practitionerProfileByPractitionerId(UUID practitionerId);

    int updatePractitionerProfile(PractitionerProfileRow row, long expectedVersion);

    void revokeActivePractitionerRoles(UUID practitionerId, UUID actorId, Instant now, String reason);

    // ---- PractitionerRole ----

    void insertPractitionerRole(PractitionerRoleRow row);

    Optional<PractitionerRoleView> practitionerRoleById(UUID id);

    Optional<PractitionerRoleView> practitionerRoleByIdForUpdate(UUID id);

    int updatePractitionerRole(PractitionerRoleRow row, long expectedVersion);

    List<PractitionerRoleView> listPractitionerRoles(UUID practitionerId, UUID departmentId, String status, int limit, int offset);

    int revokePractitionerRole(UUID id, long expectedVersion, Instant now, UUID revokedByAccountId, String revokeReason);

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

    record PersonnelMemberRow(
            UUID accountId,
            String staffCode,
            String fullName,
            boolean active,
            long version,
            Instant createdAt,
            Instant updatedAt) {
    }

    record PractitionerProfileRow(
            UUID practitionerId,
            String phone,
            java.time.LocalDate dateOfBirth,
            String gender,
            String address,
            String professionalTitle,
            String academicDegree,
            String specialtyDesignation,
            String licenseNumber,
            String licensingAuthority,
            java.time.LocalDate licenseIssuedOn,
            java.time.LocalDate licenseExpiresOn,
            int yearsExperience,
            String biography,
            String avatarUrl,
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
