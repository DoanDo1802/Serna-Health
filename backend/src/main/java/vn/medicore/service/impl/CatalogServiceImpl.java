package vn.medicore.service.impl;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.medicore.common.exception.ResourceNotFoundException;
import vn.medicore.common.utils.UuidV7Generator;
import vn.medicore.dto.CatalogAuditContext;
import vn.medicore.dto.CatalogModels.DepartmentView;
import vn.medicore.dto.CatalogModels.Page;
import vn.medicore.dto.CatalogModels.PractitionerRoleView;
import vn.medicore.dto.CatalogModels.PractitionerView;
import vn.medicore.dto.CatalogModels.RoomAssignmentsView;
import vn.medicore.dto.CatalogModels.RoomView;
import vn.medicore.dto.CatalogModels.ServicePriceView;
import vn.medicore.dto.CatalogModels.ServiceView;
import vn.medicore.dto.SecurityAuditRecorder;
import vn.medicore.repository.CatalogRepository;
import vn.medicore.repository.CatalogRepository.DepartmentRow;
import vn.medicore.repository.CatalogRepository.PractitionerRoleRow;
import vn.medicore.repository.CatalogRepository.PractitionerRow;
import vn.medicore.repository.CatalogRepository.RoomRow;
import com.fasterxml.jackson.databind.ObjectMapper;
import vn.medicore.repository.CatalogRepository.ServicePriceRow;
import vn.medicore.repository.CatalogRepository.ServiceRow;
import vn.medicore.service.CatalogService;

@Service
@Transactional
public class CatalogServiceImpl implements CatalogService {

    private final CatalogRepository store;
    private final SecurityAuditRecorder audit;
    private final Clock clock;
    private final UuidV7Generator ids;
    private final ObjectMapper objectMapper;

    public CatalogServiceImpl(CatalogRepository store, SecurityAuditRecorder audit, Clock clock, UuidV7Generator ids, ObjectMapper objectMapper) {
        this.store = store;
        this.audit = audit;
        this.clock = clock;
        this.ids = ids;
        this.objectMapper = objectMapper;
    }

    @Override
    @Transactional(readOnly = true)
    public Page<DepartmentView> listDepartments(Boolean active, String cursor, int limit) {
        int offset = offset(cursor);
        return page(store.listDepartments(active, limit + 1, offset), limit, offset);
    }

    @Override
    @Transactional(readOnly = true)
    public DepartmentView getDepartment(UUID id) {
        return store.departmentById(id).orElseThrow(ResourceNotFoundException::new);
    }

    @Override
    public DepartmentView createDepartment(
            String code, String name, Instant effectiveFrom, Instant effectiveTo, Object examTemplate, CatalogAuditContext context) {
        validateRange(effectiveFrom, effectiveTo);
        Instant now = clock.instant();
        UUID id = ids.next();
        String examTemplateJson = toJson(examTemplate);
        store.insertDepartment(new DepartmentRow(id, code.strip(), name.strip(), true,
                effectiveFrom, effectiveTo, examTemplateJson, 0, now, now));
        DepartmentView view = store.departmentById(id).orElseThrow();
        record(context, "department.create", "Department", view.id(), view.version(), "created");
        return view;
    }

    @Override
    public DepartmentView updateDepartment(
            UUID id, String code, String name, Instant effectiveFrom, Instant effectiveTo, Object examTemplate, long version, CatalogAuditContext context) {
        DepartmentView existing = store.departmentByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        validateRange(effectiveFrom, effectiveTo);
        Instant now = clock.instant();
        String examTemplateJson = examTemplate != null ? toJson(examTemplate) : (existing.examTemplate() != null ? toJson(existing.examTemplate()) : null);
        store.updateDepartment(new DepartmentRow(id, code.strip(), name.strip(), existing.active(),
                effectiveFrom, effectiveTo, examTemplateJson, version + 1, existing.createdAt(), now), version);
        DepartmentView view = store.departmentById(id).orElseThrow();
        record(context, "department.update", "Department", view.id(), view.version(), "updated");
        return view;
    }

    @Override
    public DepartmentView deactivateDepartment(UUID id, long version, CatalogAuditContext context) {
        DepartmentView existing = store.departmentByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        Instant now = clock.instant();
        String examTemplateJson = existing.examTemplate() != null ? toJson(existing.examTemplate()) : null;
        store.updateDepartment(new DepartmentRow(id, existing.code(), existing.name(), false,
                existing.effectiveFrom(), existing.effectiveTo(), examTemplateJson, version + 1, existing.createdAt(), now), version);
        DepartmentView view = store.departmentById(id).orElseThrow();
        record(context, "department.update", "Department", view.id(), view.version(), "deactivated");
        return view;
    }

    @Override
    public DepartmentView activateDepartment(UUID id, long version, CatalogAuditContext context) {
        DepartmentView existing = store.departmentByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        Instant now = clock.instant();
        String examTemplateJson = existing.examTemplate() != null ? toJson(existing.examTemplate()) : null;
        store.updateDepartment(new DepartmentRow(id, existing.code(), existing.name(), true,
                existing.effectiveFrom(), null, examTemplateJson, version + 1, existing.createdAt(), now), version);
        DepartmentView view = store.departmentById(id).orElseThrow();
        record(context, "department.update", "Department", view.id(), view.version(), "activated");
        return view;
    }

    private String toJson(Object value) {
        if (value == null) return null;
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            return null;
        }
    }

    @Override
    public void deleteDepartment(UUID id, long version, CatalogAuditContext context) {
        store.departmentByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        if (store.countRoomsByDepartmentId(id) > 0 || store.countPersonnelByDepartmentId(id) > 0) {
            throw new IllegalStateException("Không thể xóa chuyên khoa đang có phòng hoặc nhân sự liên kết. Vui lòng tạm ngừng chuyên khoa.");
        }
        store.deleteDepartment(id, version);
        record(context, "department.update", "Department", id, version, "deleted");
    }

    @Override
    @Transactional(readOnly = true)
    public Page<RoomView> listRooms(UUID departmentId, Boolean active, String cursor, int limit) {
        int offset = offset(cursor);
        return page(store.listRooms(departmentId, active, limit + 1, offset), limit, offset);
    }

    @Override
    @Transactional(readOnly = true)
    public RoomView getRoom(UUID id) {
        return store.roomById(id).orElseThrow(ResourceNotFoundException::new);
    }

    @Override
    public RoomView createRoom(String code, String name, CatalogAuditContext context) {
        Instant now = clock.instant();
        UUID id = ids.next();
        store.insertRoom(new RoomRow(id, code.strip(), name.strip(), true, 0, now, now));
        RoomView view = store.roomById(id).orElseThrow();
        record(context, "room.create", "Room", view.id(), view.version(), "created");
        return view;
    }

    @Override
    public RoomView updateRoom(UUID id, String code, String name, long version, CatalogAuditContext context) {
        RoomView existing = store.roomByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        Instant now = clock.instant();
        store.updateRoom(new RoomRow(id, code.strip(), name.strip(), existing.active(),
                version + 1, existing.createdAt(), now), version);
        RoomView view = store.roomById(id).orElseThrow();
        record(context, "room.update", "Room", view.id(), view.version(), "updated");
        return view;
    }

    @Override
    public RoomView deactivateRoom(UUID id, long version, CatalogAuditContext context) {
        RoomView existing = store.roomByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        Instant now = clock.instant();
        store.updateRoom(new RoomRow(id, existing.code(), existing.name(), false,
                version + 1, existing.createdAt(), now), version);
        RoomView view = store.roomById(id).orElseThrow();
        record(context, "room.update", "Room", view.id(), view.version(), "deactivated");
        return view;
    }

    @Override
    public void deleteRoom(UUID id, long version, CatalogAuditContext context) {
        store.roomByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        if (store.countSchedulesByRoomId(id) > 0) {
            throw new IllegalStateException("Không thể xóa phòng đang có lịch trực hoặc ca khám liên kết. Vui lòng tạm ngừng phòng.");
        }
        store.deleteRoom(id, version);
        record(context, "room.delete", "Room", id, version, "deleted");
    }

    @Override
    @Transactional(readOnly = true)
    public RoomAssignmentsView getRoomAssignments(UUID id) {
        RoomView room = store.roomById(id).orElseThrow(ResourceNotFoundException::new);
        return assignments(room);
    }

    @Override
    public RoomAssignmentsView replaceRoomAssignments(
            UUID id, List<UUID> departmentIds, List<UUID> serviceIds, long version, CatalogAuditContext context) {
        RoomView room = store.roomByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        List<UUID> departments = distinctIds(departmentIds, "departmentIds");
        List<UUID> services = distinctIds(serviceIds, "serviceIds");
        for (UUID departmentId : departments) {
            var department = store.departmentById(departmentId).orElseThrow(ResourceNotFoundException::new);
            if (!department.active()) throw new IllegalStateException("Không thể gán chuyên khoa đã tạm ngừng.");
        }
        for (UUID serviceId : services) {
            var service = store.serviceById(serviceId).orElseThrow(ResourceNotFoundException::new);
            if (!service.active()) throw new IllegalStateException("Không thể gán dịch vụ đã tạm ngừng.");
        }
        List<UUID> oldDepartments = store.roomDepartmentIds(id);
        List<UUID> oldServices = store.roomServiceIds(id);
        List<UUID> removedDepartments = oldDepartments.stream().filter(value -> !departments.contains(value)).toList();
        List<UUID> removedServices = oldServices.stream().filter(value -> !services.contains(value)).toList();
        Instant now = clock.instant();
        if (store.countActiveOrFutureSchedulesUsingRoomDepartmentOrService(id, removedDepartments, removedServices, now) > 0) {
            throw new IllegalStateException("Không thể gỡ khả năng phòng đang được lịch làm việc hiện tại hoặc tương lai sử dụng.");
        }
        store.replaceRoomAssignments(id, departments, services, now);
        store.updateRoom(new RoomRow(id, room.code(), room.name(), room.active(), version + 1,
                room.createdAt(), now), version);
        RoomView updated = store.roomById(id).orElseThrow();
        RoomAssignmentsView view = assignments(updated);
        record(context, "room.assignments.update", "Room", id, updated.version(), "assignments replaced");
        return view;
    }

    @Override
    @Transactional(readOnly = true)
    public Page<ServiceView> listServices(String serviceType, Boolean active, UUID departmentId, String cursor, int limit) {
        int offset = offset(cursor);
        return page(store.listServices(serviceType, active, departmentId, limit + 1, offset), limit, offset);
    }

    @Override
    @Transactional(readOnly = true)
    public ServiceView getService(UUID id) {
        return store.serviceById(id).orElseThrow(ResourceNotFoundException::new);
    }

    @Override
    public ServiceView createService(String code, String name, String serviceType, UUID departmentId, CatalogAuditContext context) {
        Instant now = clock.instant();
        UUID id = ids.next();
        store.insertService(new ServiceRow(id, code.strip(), name.strip(), serviceType, departmentId, true, false, 0, now, now));
        UUID priceId = ids.next();
        store.insertServicePrice(new ServicePriceRow(priceId, id, java.math.BigDecimal.valueOf(150000), "VND", now, null, now));
        ServiceView view = store.serviceById(id).orElseThrow();
        record(context, "service.create", "Service", view.id(), view.version(), "created");
        return view;
    }

    @Override
    public ServiceView updateService(
            UUID id, String code, String name, String serviceType, UUID departmentId, long version, CatalogAuditContext context) {
        ServiceView existing = store.serviceByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        Instant now = clock.instant();
        store.updateService(new ServiceRow(id, code.strip(), name.strip(), serviceType, departmentId,
                existing.active(), existing.allowsCritical(), version + 1, existing.createdAt(), now), version);
        ServiceView view = store.serviceById(id).orElseThrow();
        record(context, "service.update", "Service", view.id(), view.version(), "updated");
        return view;
    }

    @Override
    public ServiceView deactivateService(UUID id, long version, CatalogAuditContext context) {
        ServiceView existing = store.serviceByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        Instant now = clock.instant();
        store.updateService(new ServiceRow(id, existing.code(), existing.name(), existing.serviceType(), existing.departmentId(),
                false, existing.allowsCritical(), version + 1, existing.createdAt(), now), version);
        ServiceView view = store.serviceById(id).orElseThrow();
        record(context, "service.update", "Service", view.id(), view.version(), "deactivated");
        return view;
    }

    @Override
    @Transactional(readOnly = true)
    public Page<ServicePriceView> listServicePrices(UUID serviceId, String cursor, int limit) {
        int offset = offset(cursor);
        return page(store.listPrices(serviceId, limit + 1, offset), limit, offset);
    }

    @Override
    @Transactional(readOnly = true)
    public ServicePriceView getServicePrice(UUID id) {
        return store.priceById(id).orElseThrow(ResourceNotFoundException::new);
    }

    @Override
    public ServicePriceView createServicePrice(
            UUID serviceId, BigDecimal amount, Instant effectiveFrom, CatalogAuditContext context) {
        store.serviceById(serviceId).orElseThrow(ResourceNotFoundException::new);
        if (amount.compareTo(BigDecimal.ZERO) < 0) throw new IllegalArgumentException("Price amount must be >= 0");
        Instant now = clock.instant();
        UUID id = ids.next();
        store.closeOpenPriceForService(serviceId, effectiveFrom);
        store.insertServicePrice(new ServicePriceRow(id, serviceId, amount, "VND", effectiveFrom, null, now));
        ServicePriceView view = store.priceById(id).orElseThrow();
        record(context, "service_price.create", "ServicePrice", view.id(), view.version(), "created");
        return view;
    }

    @Override
    public ServicePriceView endServicePrice(
            UUID id, Instant effectiveTo, long version, CatalogAuditContext context) {
        ServicePriceView existing = store.priceById(id).orElseThrow(ResourceNotFoundException::new);
        if (!effectiveTo.isAfter(existing.effectiveFrom())) {
            throw new IllegalArgumentException("effective_to must be after effective_from");
        }
        store.endServicePrice(id, effectiveTo, version);
        ServicePriceView view = store.priceById(id).orElseThrow();
        record(context, "service_price.update", "ServicePrice", view.id(), view.version(), "ended");
        return view;
    }

    @Override
    @Transactional(readOnly = true)
    public Page<PractitionerView> listPractitioners(Boolean active, String cursor, int limit) {
        int offset = offset(cursor);
        return page(store.listPractitioners(active, limit + 1, offset), limit, offset);
    }

    @Override
    @Transactional(readOnly = true)
    public PractitionerView getPractitioner(UUID id) {
        return store.practitionerById(id).orElseThrow(ResourceNotFoundException::new);
    }

    @Override
    public PractitionerView createPractitioner(
            UUID userAccountId, String staffCode, String fullName, CatalogAuditContext context) {
        Instant now = clock.instant();
        UUID id = ids.next();
        store.insertPractitioner(new PractitionerRow(id, userAccountId, staffCode.strip(), fullName.strip(), true, 0, now, now));
        PractitionerView view = store.practitionerById(id).orElseThrow();
        record(context, "practitioner.create", "Practitioner", view.id(), view.version(), "created");
        return view;
    }

    @Override
    public PractitionerView updatePractitioner(
            UUID id, String staffCode, String fullName, long version, CatalogAuditContext context) {
        PractitionerView existing = store.practitionerByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        Instant now = clock.instant();
        store.updatePractitioner(new PractitionerRow(id, existing.userAccountId(), staffCode.strip(), fullName.strip(),
                existing.active(), version + 1, existing.createdAt(), now), version);
        PractitionerView view = store.practitionerById(id).orElseThrow();
        record(context, "practitioner.update", "Practitioner", view.id(), view.version(), "updated");
        return view;
    }

    @Override
    public PractitionerView deactivatePractitioner(UUID id, long version, CatalogAuditContext context) {
        PractitionerView existing = store.practitionerByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        Instant now = clock.instant();
        store.updatePractitioner(new PractitionerRow(id, existing.userAccountId(), existing.staffCode(), existing.fullName(),
                false, version + 1, existing.createdAt(), now), version);
        PractitionerView view = store.practitionerById(id).orElseThrow();
        record(context, "practitioner.update", "Practitioner", view.id(), view.version(), "deactivated");
        return view;
    }

    @Override
    @Transactional(readOnly = true)
    public Page<PractitionerRoleView> listPractitionerRoles(
            UUID practitionerId, UUID departmentId, String status, String cursor, int limit) {
        int offset = offset(cursor);
        return page(store.listPractitionerRoles(practitionerId, departmentId, status, limit + 1, offset), limit, offset);
    }

    @Override
    @Transactional(readOnly = true)
    public PractitionerRoleView getPractitionerRole(UUID id) {
        return store.practitionerRoleById(id).orElseThrow(ResourceNotFoundException::new);
    }

    @Override
    public PractitionerRoleView assignPractitionerRole(
            UUID practitionerId,
            UUID departmentId,
            String roleCode,
            Instant effectiveFrom,
            Instant effectiveTo,
            CatalogAuditContext context) {
        store.practitionerById(practitionerId).orElseThrow(ResourceNotFoundException::new);
        store.departmentById(departmentId).orElseThrow(ResourceNotFoundException::new);
        validateRange(effectiveFrom, effectiveTo);
        Instant now = clock.instant();
        UUID id = ids.next();
        store.insertPractitionerRole(new PractitionerRoleRow(id, practitionerId, departmentId, roleCode,
                effectiveFrom, effectiveTo, "ACTIVE", 0, now, now));
        PractitionerRoleView view = store.practitionerRoleById(id).orElseThrow();
        record(context, "practitioner_role.create", "PractitionerRole", view.id(), view.version(), "assigned");
        return view;
    }

    @Override
    public PractitionerRoleView revokePractitionerRole(
            UUID id, long version, String reason, CatalogAuditContext context) {
        store.practitionerRoleByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        Instant now = clock.instant();
        store.revokePractitionerRole(id, version, now, context.actorAccountId(), reason.strip());
        PractitionerRoleView view = store.practitionerRoleById(id).orElseThrow();
        record(context, "practitioner_role.update", "PractitionerRole", view.id(), view.version(), "revoked");
        return view;
    }

    private RoomAssignmentsView assignments(RoomView room) {
        return new RoomAssignmentsView(room.id(), room.version(),
                store.roomDepartmentIds(room.id()), store.roomServiceIds(room.id()));
    }

    private static List<UUID> distinctIds(List<UUID> values, String field) {
        if (values == null) return List.of();
        if (values.stream().anyMatch(java.util.Objects::isNull) || Set.copyOf(values).size() != values.size()) {
            throw new IllegalArgumentException(field + " must contain unique UUID values");
        }
        return List.copyOf(values);
    }

    private void record(
            CatalogAuditContext context,
            String action,
            String resourceType,
            UUID resourceId,
            long resourceVersion,
            String reason) {
        audit.record(
                context.actorAccountId(),
                context.permissionSnapshot(),
                action,
                "SUCCEEDED",
                reason,
                resourceType,
                resourceId,
                resourceVersion,
                context.sessionId(),
                context.requestId(),
                context.correlationId());
    }

    private static void validateRange(Instant effectiveFrom, Instant effectiveTo) {
        if (effectiveTo != null && !effectiveTo.isAfter(effectiveFrom)) {
            throw new IllegalArgumentException("effective_to must be after effective_from");
        }
    }

    private static int offset(String cursor) {
        if (cursor == null || cursor.isBlank()) return 0;
        try {
            int offset = Integer.parseInt(new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8));
            if (offset < 0) throw new IllegalArgumentException("Cursor is invalid");
            return offset;
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("Cursor is invalid");
        }
    }

    private static <T> Page<T> page(List<T> values, int limit, int offset) {
        boolean hasMore = values.size() > limit;
        List<T> items = hasMore ? values.subList(0, limit) : values;
        String next = hasMore ? Base64.getUrlEncoder().withoutPadding()
                .encodeToString(Integer.toString(offset + items.size()).getBytes(StandardCharsets.UTF_8)) : null;
        return new Page<>(List.copyOf(items), next, hasMore);
    }
}
