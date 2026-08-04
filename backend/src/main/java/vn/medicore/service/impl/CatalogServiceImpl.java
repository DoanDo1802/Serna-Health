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
import vn.medicore.dto.CatalogModels.DepartmentView;
import vn.medicore.dto.CatalogModels.Page;
import vn.medicore.dto.CatalogModels.PractitionerRoleView;
import vn.medicore.dto.CatalogModels.PractitionerView;
import vn.medicore.dto.CatalogModels.RoomView;
import vn.medicore.dto.CatalogModels.ServicePriceView;
import vn.medicore.dto.CatalogModels.ServiceView;
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
    private final Clock clock;
    private final UuidV7Generator ids;

    public CatalogServiceImpl(CatalogRepository store, Clock clock, UuidV7Generator ids) {
        this.store = store;
        this.clock = clock;
        this.ids = ids;
    }

    // ===========================================================
    // Department
    // ===========================================================

    @Override
    @Transactional(readOnly = true)
    public Page<DepartmentView> listDepartments(Boolean active, String cursor, int limit) {
        return page(store.listDepartments(active, limit + 1, offset(cursor)), limit);
    }

    @Override
    @Transactional(readOnly = true)
    public DepartmentView getDepartment(UUID id) {
        return store.departmentById(id).orElseThrow(ResourceNotFoundException::new);
    }

    @Override
    public DepartmentView createDepartment(String code, String name, Instant effectiveFrom, Instant effectiveTo, UUID actorId) {
        Instant now = clock.instant();
        UUID id = ids.next();
        if (effectiveTo != null && !effectiveTo.isAfter(effectiveFrom)) {
            throw new IllegalArgumentException("effective_to must be after effective_from");
        }
        store.insertDepartment(new DepartmentRow(id, code.strip(), name.strip(), true,
                effectiveFrom, effectiveTo, 0, now, now));
        return store.departmentById(id).orElseThrow();
    }

    @Override
    public DepartmentView updateDepartment(UUID id, String code, String name, Instant effectiveFrom, Instant effectiveTo, long version, UUID actorId) {
        DepartmentView existing = store.departmentByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        if (effectiveTo != null && !effectiveTo.isAfter(effectiveFrom)) {
            throw new IllegalArgumentException("effective_to must be after effective_from");
        }
        Instant now = clock.instant();
        store.updateDepartment(new DepartmentRow(id, code.strip(), name.strip(), existing.active(),
                effectiveFrom, effectiveTo, version + 1, existing.createdAt(), now), version);
        return store.departmentById(id).orElseThrow();
    }

    @Override
    public DepartmentView deactivateDepartment(UUID id, long version, UUID actorId) {
        DepartmentView existing = store.departmentByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        Instant now = clock.instant();
        store.updateDepartment(new DepartmentRow(id, existing.code(), existing.name(), false,
                existing.effectiveFrom(), existing.effectiveTo(), version + 1, existing.createdAt(), now), version);
        return store.departmentById(id).orElseThrow();
    }

    // ===========================================================
    // Room
    // ===========================================================

    @Override
    @Transactional(readOnly = true)
    public Page<RoomView> listRooms(UUID departmentId, Boolean active, String cursor, int limit) {
        return page(store.listRooms(departmentId, active, limit + 1, offset(cursor)), limit);
    }

    @Override
    @Transactional(readOnly = true)
    public RoomView getRoom(UUID id) {
        return store.roomById(id).orElseThrow(ResourceNotFoundException::new);
    }

    @Override
    public RoomView createRoom(UUID departmentId, String code, String name, UUID actorId) {
        // Validate department exists
        store.departmentById(departmentId).orElseThrow(ResourceNotFoundException::new);
        Instant now = clock.instant();
        UUID id = ids.next();
        store.insertRoom(new RoomRow(id, departmentId, code.strip(), name.strip(), true, 0, now, now));
        return store.roomById(id).orElseThrow();
    }

    @Override
    public RoomView updateRoom(UUID id, String code, String name, long version, UUID actorId) {
        RoomView existing = store.roomByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        Instant now = clock.instant();
        store.updateRoom(new RoomRow(id, existing.departmentId(), code.strip(), name.strip(),
                existing.active(), version + 1, existing.createdAt(), now), version);
        return store.roomById(id).orElseThrow();
    }

    @Override
    public RoomView deactivateRoom(UUID id, long version, UUID actorId) {
        RoomView existing = store.roomByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        Instant now = clock.instant();
        store.updateRoom(new RoomRow(id, existing.departmentId(), existing.code(), existing.name(),
                false, version + 1, existing.createdAt(), now), version);
        return store.roomById(id).orElseThrow();
    }

    // ===========================================================
    // Service
    // ===========================================================

    @Override
    @Transactional(readOnly = true)
    public Page<ServiceView> listServices(String serviceType, Boolean active, String cursor, int limit) {
        return page(store.listServices(serviceType, active, limit + 1, offset(cursor)), limit);
    }

    @Override
    @Transactional(readOnly = true)
    public ServiceView getService(UUID id) {
        return store.serviceById(id).orElseThrow(ResourceNotFoundException::new);
    }

    @Override
    public ServiceView createService(String code, String name, String serviceType, UUID actorId) {
        Instant now = clock.instant();
        UUID id = ids.next();
        store.insertService(new ServiceRow(id, code.strip(), name.strip(), serviceType, true, false, 0, now, now));
        return store.serviceById(id).orElseThrow();
    }

    @Override
    public ServiceView updateService(UUID id, String code, String name, String serviceType, long version, UUID actorId) {
        ServiceView existing = store.serviceByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        Instant now = clock.instant();
        store.updateService(new ServiceRow(id, code.strip(), name.strip(), serviceType,
                existing.active(), existing.allowsCritical(), version + 1, existing.createdAt(), now), version);
        return store.serviceById(id).orElseThrow();
    }

    @Override
    public ServiceView deactivateService(UUID id, long version, UUID actorId) {
        ServiceView existing = store.serviceByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        Instant now = clock.instant();
        store.updateService(new ServiceRow(id, existing.code(), existing.name(), existing.serviceType(),
                false, existing.allowsCritical(), version + 1, existing.createdAt(), now), version);
        return store.serviceById(id).orElseThrow();
    }

    // ===========================================================
    // ServicePrice
    // ===========================================================

    @Override
    @Transactional(readOnly = true)
    public Page<ServicePriceView> listServicePrices(UUID serviceId, String cursor, int limit) {
        return page(store.listPrices(serviceId, limit + 1, offset(cursor)), limit);
    }

    @Override
    @Transactional(readOnly = true)
    public ServicePriceView getServicePrice(UUID id) {
        return store.priceById(id).orElseThrow(ResourceNotFoundException::new);
    }

    @Override
    public ServicePriceView createServicePrice(UUID serviceId, BigDecimal amount, Instant effectiveFrom, UUID actorId) {
        // Validate service exists
        store.serviceById(serviceId).orElseThrow(ResourceNotFoundException::new);
        if (amount.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Price amount must be >= 0");
        }
        Instant now = clock.instant();
        UUID id = ids.next();
        // End any currently open price range
        store.endServicePrice(serviceId, effectiveFrom);
        store.insertServicePrice(new ServicePriceRow(id, serviceId, amount, "VND", effectiveFrom, null, now));
        return store.priceById(id).orElseThrow();
    }

    @Override
    public void endServicePrice(UUID id, Instant effectiveTo, UUID actorId) {
        ServicePriceView existing = store.priceById(id).orElseThrow(ResourceNotFoundException::new);
        if (!effectiveTo.isAfter(existing.effectiveFrom())) {
            throw new IllegalArgumentException("effective_to must be after effective_from");
        }
        store.endServicePrice(id, effectiveTo);
    }

    // ===========================================================
    // Practitioner
    // ===========================================================

    @Override
    @Transactional(readOnly = true)
    public Page<PractitionerView> listPractitioners(Boolean active, String cursor, int limit) {
        return page(store.listPractitioners(active, cursor, limit + 1, offset(cursor)), limit);
    }

    @Override
    @Transactional(readOnly = true)
    public PractitionerView getPractitioner(UUID id) {
        return store.practitionerById(id).orElseThrow(ResourceNotFoundException::new);
    }

    @Override
    public PractitionerView createPractitioner(UUID userAccountId, String staffCode, String fullName, UUID actorId) {
        Instant now = clock.instant();
        UUID id = ids.next();
        store.insertPractitioner(new PractitionerRow(id, userAccountId, staffCode.strip(), fullName.strip(), true, 0, now, now));
        return store.practitionerById(id).orElseThrow();
    }

    @Override
    public PractitionerView updatePractitioner(UUID id, String staffCode, String fullName, long version, UUID actorId) {
        PractitionerView existing = store.practitionerByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        Instant now = clock.instant();
        store.updatePractitioner(new PractitionerRow(id, existing.userAccountId(), staffCode.strip(), fullName.strip(),
                existing.active(), version + 1, existing.createdAt(), now), version);
        return store.practitionerById(id).orElseThrow();
    }

    @Override
    public PractitionerView deactivatePractitioner(UUID id, long version, UUID actorId) {
        PractitionerView existing = store.practitionerByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        Instant now = clock.instant();
        store.updatePractitioner(new PractitionerRow(id, existing.userAccountId(), existing.staffCode(), existing.fullName(),
                false, version + 1, existing.createdAt(), now), version);
        return store.practitionerById(id).orElseThrow();
    }

    // ===========================================================
    // PractitionerRole
    // ===========================================================

    @Override
    @Transactional(readOnly = true)
    public Page<PractitionerRoleView> listPractitionerRoles(UUID practitionerId, UUID departmentId, String status, String cursor, int limit) {
        return page(store.listPractitionerRoles(practitionerId, departmentId, status, limit + 1, offset(cursor)), limit);
    }

    @Override
    @Transactional(readOnly = true)
    public PractitionerRoleView getPractitionerRole(UUID id) {
        return store.practitionerRoleById(id).orElseThrow(ResourceNotFoundException::new);
    }

    @Override
    public PractitionerRoleView assignPractitionerRole(UUID practitionerId, UUID departmentId, String roleCode, Instant effectiveFrom, Instant effectiveTo, UUID actorId) {
        store.practitionerById(practitionerId).orElseThrow(ResourceNotFoundException::new);
        store.departmentById(departmentId).orElseThrow(ResourceNotFoundException::new);
        if (effectiveTo != null && !effectiveTo.isAfter(effectiveFrom)) {
            throw new IllegalArgumentException("effective_to must be after effective_from");
        }
        Instant now = clock.instant();
        UUID id = ids.next();
        store.insertPractitionerRole(new PractitionerRoleRow(id, practitionerId, departmentId, roleCode,
                effectiveFrom, effectiveTo, "ACTIVE", 0, now, now));
        return store.practitionerRoleById(id).orElseThrow();
    }

    @Override
    public PractitionerRoleView revokePractitionerRole(UUID id, long version, UUID actorId) {
        store.practitionerRoleByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        store.revokePractitionerRole(id, version, clock.instant());
        return store.practitionerRoleById(id).orElseThrow();
    }

    // ===========================================================
    // Pagination helpers
    // ===========================================================

    private static int offset(String cursor) {
        if (cursor == null || cursor.isBlank()) return 0;
        try {
            return Integer.parseInt(new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Cursor is invalid");
        }
    }

    private static <T> Page<T> page(List<T> values, int limit) {
        boolean hasMore = values.size() > limit;
        List<T> items = hasMore ? values.subList(0, limit) : values;
        String next = hasMore ? Base64.getUrlEncoder().withoutPadding()
                .encodeToString(Integer.toString(limit).getBytes(StandardCharsets.UTF_8)) : null;
        return new Page<>(List.copyOf(items), next, hasMore);
    }
}
