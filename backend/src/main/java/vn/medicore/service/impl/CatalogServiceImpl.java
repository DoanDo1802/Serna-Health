package vn.medicore.service.impl;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
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
import vn.medicore.dto.CatalogModels.RoomView;
import vn.medicore.dto.CatalogModels.ServicePriceView;
import vn.medicore.dto.CatalogModels.ServiceView;
import vn.medicore.dto.SecurityAuditRecorder;
import vn.medicore.repository.CatalogRepository;
import vn.medicore.repository.CatalogRepository.DepartmentRow;
import vn.medicore.repository.CatalogRepository.PractitionerRoleRow;
import vn.medicore.repository.CatalogRepository.PractitionerRow;
import vn.medicore.repository.CatalogRepository.RoomRow;
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

    public CatalogServiceImpl(CatalogRepository store, SecurityAuditRecorder audit, Clock clock, UuidV7Generator ids) {
        this.store = store;
        this.audit = audit;
        this.clock = clock;
        this.ids = ids;
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
            String code, String name, Instant effectiveFrom, Instant effectiveTo, CatalogAuditContext context) {
        validateRange(effectiveFrom, effectiveTo);
        Instant now = clock.instant();
        UUID id = ids.next();
        store.insertDepartment(new DepartmentRow(id, code.strip(), name.strip(), true,
                effectiveFrom, effectiveTo, 0, now, now));
        DepartmentView view = store.departmentById(id).orElseThrow();
        record(context, "department.create", "Department", view.id(), view.version(), "created");
        return view;
    }

    @Override
    public DepartmentView updateDepartment(
            UUID id, String code, String name, Instant effectiveFrom, Instant effectiveTo, long version, CatalogAuditContext context) {
        DepartmentView existing = store.departmentByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        validateRange(effectiveFrom, effectiveTo);
        Instant now = clock.instant();
        store.updateDepartment(new DepartmentRow(id, code.strip(), name.strip(), existing.active(),
                effectiveFrom, effectiveTo, version + 1, existing.createdAt(), now), version);
        DepartmentView view = store.departmentById(id).orElseThrow();
        record(context, "department.update", "Department", view.id(), view.version(), "updated");
        return view;
    }

    @Override
    public DepartmentView deactivateDepartment(UUID id, long version, CatalogAuditContext context) {
        DepartmentView existing = store.departmentByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        Instant now = clock.instant();
        store.updateDepartment(new DepartmentRow(id, existing.code(), existing.name(), false,
                existing.effectiveFrom(), existing.effectiveTo(), version + 1, existing.createdAt(), now), version);
        DepartmentView view = store.departmentById(id).orElseThrow();
        record(context, "department.update", "Department", view.id(), view.version(), "deactivated");
        return view;
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
    public RoomView createRoom(UUID departmentId, String code, String name, CatalogAuditContext context) {
        store.departmentById(departmentId).orElseThrow(ResourceNotFoundException::new);
        Instant now = clock.instant();
        UUID id = ids.next();
        store.insertRoom(new RoomRow(id, departmentId, code.strip(), name.strip(), true, 0, now, now));
        RoomView view = store.roomById(id).orElseThrow();
        record(context, "room.create", "Room", view.id(), view.version(), "created");
        return view;
    }

    @Override
    public RoomView updateRoom(UUID id, String code, String name, long version, CatalogAuditContext context) {
        RoomView existing = store.roomByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        Instant now = clock.instant();
        store.updateRoom(new RoomRow(id, existing.departmentId(), code.strip(), name.strip(),
                existing.active(), version + 1, existing.createdAt(), now), version);
        RoomView view = store.roomById(id).orElseThrow();
        record(context, "room.update", "Room", view.id(), view.version(), "updated");
        return view;
    }

    @Override
    public RoomView deactivateRoom(UUID id, long version, CatalogAuditContext context) {
        RoomView existing = store.roomByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        Instant now = clock.instant();
        store.updateRoom(new RoomRow(id, existing.departmentId(), existing.code(), existing.name(),
                false, version + 1, existing.createdAt(), now), version);
        RoomView view = store.roomById(id).orElseThrow();
        record(context, "room.update", "Room", view.id(), view.version(), "deactivated");
        return view;
    }

    @Override
    @Transactional(readOnly = true)
    public Page<ServiceView> listServices(String serviceType, Boolean active, String cursor, int limit) {
        int offset = offset(cursor);
        return page(store.listServices(serviceType, active, limit + 1, offset), limit, offset);
    }

    @Override
    @Transactional(readOnly = true)
    public ServiceView getService(UUID id) {
        return store.serviceById(id).orElseThrow(ResourceNotFoundException::new);
    }

    @Override
    public ServiceView createService(String code, String name, String serviceType, CatalogAuditContext context) {
        Instant now = clock.instant();
        UUID id = ids.next();
        store.insertService(new ServiceRow(id, code.strip(), name.strip(), serviceType, true, false, 0, now, now));
        ServiceView view = store.serviceById(id).orElseThrow();
        record(context, "service.create", "Service", view.id(), view.version(), "created");
        return view;
    }

    @Override
    public ServiceView updateService(
            UUID id, String code, String name, String serviceType, long version, CatalogAuditContext context) {
        ServiceView existing = store.serviceByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        Instant now = clock.instant();
        store.updateService(new ServiceRow(id, code.strip(), name.strip(), serviceType,
                existing.active(), existing.allowsCritical(), version + 1, existing.createdAt(), now), version);
        ServiceView view = store.serviceById(id).orElseThrow();
        record(context, "service.update", "Service", view.id(), view.version(), "updated");
        return view;
    }

    @Override
    public ServiceView deactivateService(UUID id, long version, CatalogAuditContext context) {
        ServiceView existing = store.serviceByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        Instant now = clock.instant();
        store.updateService(new ServiceRow(id, existing.code(), existing.name(), existing.serviceType(),
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
