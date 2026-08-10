package vn.medicore.repository.impl;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import vn.medicore.common.exception.StaleVersionException;
import vn.medicore.dto.CatalogModels.DepartmentView;
import vn.medicore.dto.CatalogModels.PractitionerRoleView;
import vn.medicore.dto.CatalogModels.PractitionerView;
import vn.medicore.dto.CatalogModels.RoomView;
import vn.medicore.dto.CatalogModels.ServicePriceView;
import vn.medicore.dto.CatalogModels.ServiceView;
import vn.medicore.repository.CatalogRepository;

@Repository
public class CatalogJdbcRepositoryImpl implements CatalogRepository {

    private final JdbcTemplate jdbc;

    public CatalogJdbcRepositoryImpl(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ===========================================================
    // Department
    // ===========================================================

    @Override
    public void insertDepartment(DepartmentRow row) {
        update("""
                insert into department(id, code, name, active, effective_from, effective_to, version, created_at, updated_at)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                row.id(), row.code(), row.name(), row.active(),
                ts(row.effectiveFrom()), ts(row.effectiveTo()),
                row.version(), ts(row.createdAt()), ts(row.updatedAt()));
    }

    @Override
    public Optional<DepartmentView> departmentById(UUID id) {
        return queryOne("""
                select id, code, name, active, effective_from, effective_to, version, created_at, updated_at
                from department where id = ?
                """, this::departmentView, id);
    }

    @Override
    public Optional<DepartmentView> departmentByIdForUpdate(UUID id) {
        return queryOne("""
                select id, code, name, active, effective_from, effective_to, version, created_at, updated_at
                from department where id = ? for update
                """, this::departmentView, id);
    }

    @Override
    public List<DepartmentView> listDepartments(Boolean active, int limit, int offset) {
        if (active != null) {
            return jdbc.query("""
                    select id, code, name, active, effective_from, effective_to, version, created_at, updated_at
                    from department where active = ? order by name limit ? offset ?
                    """, this::departmentView, active, limit, offset);
        }
        return jdbc.query("""
                select id, code, name, active, effective_from, effective_to, version, created_at, updated_at
                from department order by name limit ? offset ?
                """, this::departmentView, limit, offset);
    }

    @Override
    public int updateDepartment(DepartmentRow row, long expectedVersion) {
        int updated = update("""
                update department
                set code = ?, name = ?, active = ?, effective_from = ?, effective_to = ?,
                    version = version + 1, updated_at = ?
                where id = ? and version = ?
                """,
                row.code(), row.name(), row.active(),
                ts(row.effectiveFrom()), ts(row.effectiveTo()),
                ts(row.updatedAt()), row.id(), expectedVersion);
        if (updated != 1) throw new StaleVersionException();
        return updated;
    }

    // ===========================================================
    // Room
    // ===========================================================

    @Override
    public void insertRoom(RoomRow row) {
        update("""
                insert into room(id, department_id, code, name, active, version, created_at, updated_at)
                values (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                row.id(), row.departmentId(), row.code(), row.name(),
                row.active(), row.version(), ts(row.createdAt()), ts(row.updatedAt()));
    }

    @Override
    public Optional<RoomView> roomById(UUID id) {
        return queryOne("""
                select id, department_id, code, name, active, version, created_at, updated_at
                from room where id = ?
                """, this::roomView, id);
    }

    @Override
    public Optional<RoomView> roomByIdForUpdate(UUID id) {
        return queryOne("""
                select id, department_id, code, name, active, version, created_at, updated_at
                from room where id = ? for update
                """, this::roomView, id);
    }

    @Override
    public List<RoomView> listRooms(UUID departmentId, Boolean active, int limit, int offset) {
        if (departmentId != null && active != null) {
            return jdbc.query("""
                    select id, department_id, code, name, active, version, created_at, updated_at
                    from room where department_id = ? and active = ? order by name limit ? offset ?
                    """, this::roomView, departmentId, active, limit, offset);
        }
        if (departmentId != null) {
            return jdbc.query("""
                    select id, department_id, code, name, active, version, created_at, updated_at
                    from room where department_id = ? order by name limit ? offset ?
                    """, this::roomView, departmentId, limit, offset);
        }
        if (active != null) {
            return jdbc.query("""
                    select id, department_id, code, name, active, version, created_at, updated_at
                    from room where active = ? order by name limit ? offset ?
                    """, this::roomView, active, limit, offset);
        }
        return jdbc.query("""
                select id, department_id, code, name, active, version, created_at, updated_at
                from room order by name limit ? offset ?
                """, this::roomView, limit, offset);
    }

    @Override
    public int updateRoom(RoomRow row, long expectedVersion) {
        int updated = update("""
                update room
                set code = ?, name = ?, active = ?, version = version + 1, updated_at = ?
                where id = ? and version = ?
                """,
                row.code(), row.name(), row.active(),
                ts(row.updatedAt()), row.id(), expectedVersion);
        if (updated != 1) throw new StaleVersionException();
        return updated;
    }

    // ===========================================================
    // Service
    // ===========================================================

    @Override
    public void insertService(ServiceRow row) {
        update("""
                insert into service(id, code, name, service_type, active, allows_critical, version, created_at, updated_at)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                row.id(), row.code(), row.name(), row.serviceType(),
                row.active(), row.allowsCritical(), row.version(),
                ts(row.createdAt()), ts(row.updatedAt()));
    }

    @Override
    public Optional<ServiceView> serviceById(UUID id) {
        return queryOne("""
                select id, code, name, service_type, active, allows_critical, version, created_at, updated_at
                from service where id = ?
                """, this::serviceView, id);
    }

    @Override
    public Optional<ServiceView> serviceByIdForUpdate(UUID id) {
        return queryOne("""
                select id, code, name, service_type, active, allows_critical, version, created_at, updated_at
                from service where id = ? for update
                """, this::serviceView, id);
    }

    @Override
    public List<ServiceView> listServices(String serviceType, Boolean active, int limit, int offset) {
        if (serviceType != null && active != null) {
            return jdbc.query("""
                    select id, code, name, service_type, active, allows_critical, version, created_at, updated_at
                    from service where service_type = ? and active = ? order by name limit ? offset ?
                    """, this::serviceView, serviceType, active, limit, offset);
        }
        if (serviceType != null) {
            return jdbc.query("""
                    select id, code, name, service_type, active, allows_critical, version, created_at, updated_at
                    from service where service_type = ? order by name limit ? offset ?
                    """, this::serviceView, serviceType, limit, offset);
        }
        if (active != null) {
            return jdbc.query("""
                    select id, code, name, service_type, active, allows_critical, version, created_at, updated_at
                    from service where active = ? order by name limit ? offset ?
                    """, this::serviceView, active, limit, offset);
        }
        return jdbc.query("""
                select id, code, name, service_type, active, allows_critical, version, created_at, updated_at
                from service order by name limit ? offset ?
                """, this::serviceView, limit, offset);
    }

    @Override
    public int updateService(ServiceRow row, long expectedVersion) {
        int updated = update("""
                update service
                set code = ?, name = ?, service_type = ?, active = ?, version = version + 1, updated_at = ?
                where id = ? and version = ?
                """,
                row.code(), row.name(), row.serviceType(), row.active(),
                ts(row.updatedAt()), row.id(), expectedVersion);
        if (updated != 1) throw new StaleVersionException();
        return updated;
    }

    // ===========================================================
    // ServicePrice
    // ===========================================================

    @Override
    public void insertServicePrice(ServicePriceRow row) {
        update("""
                insert into service_price(id, service_id, amount, currency, effective_from, effective_to, created_at)
                values (?, ?, ?, ?, ?, ?, ?)
                """,
                row.id(), row.serviceId(), row.amount(), row.currency(),
                ts(row.effectiveFrom()), ts(row.effectiveTo()), ts(row.createdAt()));
    }

    @Override
    public List<ServicePriceView> listPrices(UUID serviceId, int limit, int offset) {
        return jdbc.query("""
                select id, service_id, amount, currency, effective_from, effective_to, created_at
                from service_price where service_id = ?
                order by effective_from desc limit ? offset ?
                """, this::servicePriceView, serviceId, limit, offset);
    }

    @Override
    public Optional<ServicePriceView> priceById(UUID id) {
        return queryOne("""
                select id, service_id, amount, currency, effective_from, effective_to, created_at
                from service_price where id = ?
                """, this::servicePriceView, id);
    }

    @Override
    public Optional<ServicePriceView> currentPrice(UUID serviceId, Instant at) {
        return queryOne("""
                select id, service_id, amount, currency, effective_from, effective_to, created_at
                from service_price
                where service_id = ? and effective_from <= ?
                  and (effective_to is null or effective_to > ?)
                order by effective_from desc limit 1
                """, this::servicePriceView, serviceId, ts(at), ts(at));
    }

    @Override
    public void closeOpenPriceForService(UUID serviceId, Instant effectiveTo) {
        update("update service_price set effective_to = ?, updated_at = now(), version = version + 1 "
                        + "where service_id = ? and effective_to is null and effective_from < ?",
                ts(effectiveTo), serviceId, ts(effectiveTo));
    }

    @Override
    public void endServicePrice(UUID id, Instant effectiveTo, long expectedVersion) {
        int updated = update("update service_price set effective_to = ?, updated_at = now(), version = version + 1 "
                        + "where id = ? and effective_to is null and version = ?",
                ts(effectiveTo), id, expectedVersion);
        if (updated != 1) throw new StaleVersionException();
    }

    // ===========================================================
    // Practitioner
    // ===========================================================

    @Override
    public void insertPractitioner(PractitionerRow row) {
        update("""
                insert into practitioner(id, user_account_id, staff_code, full_name, active, version, created_at, updated_at)
                values (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                row.id(), row.userAccountId(), row.staffCode(), row.fullName(),
                row.active(), row.version(), ts(row.createdAt()), ts(row.updatedAt()));
    }

    @Override
    public Optional<PractitionerView> practitionerById(UUID id) {
        return queryOne("""
                select id, user_account_id, staff_code, full_name, active, version, created_at, updated_at
                from practitioner where id = ?
                """, this::practitionerView, id);
    }

    @Override
    public Optional<PractitionerView> practitionerByIdForUpdate(UUID id) {
        return queryOne("""
                select id, user_account_id, staff_code, full_name, active, version, created_at, updated_at
                from practitioner where id = ? for update
                """, this::practitionerView, id);
    }

    @Override
    public List<PractitionerView> listPractitioners(Boolean active, String cursor, int limit, int offset) {
        if (active != null) {
            return jdbc.query("""
                    select id, user_account_id, staff_code, full_name, active, version, created_at, updated_at
                    from practitioner where active = ? order by full_name limit ? offset ?
                    """, this::practitionerView, active, limit, offset);
        }
        return jdbc.query("""
                select id, user_account_id, staff_code, full_name, active, version, created_at, updated_at
                from practitioner order by full_name limit ? offset ?
                """, this::practitionerView, limit, offset);
    }

    @Override
    public int updatePractitioner(PractitionerRow row, long expectedVersion) {
        int updated = update("""
                update practitioner
                set staff_code = ?, full_name = ?, active = ?, version = version + 1, updated_at = ?
                where id = ? and version = ?
                """,
                row.staffCode(), row.fullName(), row.active(),
                ts(row.updatedAt()), row.id(), expectedVersion);
        if (updated != 1) throw new StaleVersionException();
        return updated;
    }

    // ===========================================================
    // PractitionerRole
    // ===========================================================

    @Override
    public void insertPractitionerRole(PractitionerRoleRow row) {
        update("""
                insert into practitioner_role(id, practitioner_id, department_id, role_code,
                    effective_from, effective_to, status, version, created_at, updated_at)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                row.id(), row.practitionerId(), row.departmentId(), row.roleCode(),
                ts(row.effectiveFrom()), ts(row.effectiveTo()), row.status(),
                row.version(), ts(row.createdAt()), ts(row.updatedAt()));
    }

    @Override
    public Optional<PractitionerRoleView> practitionerRoleById(UUID id) {
        return queryOne("""
                select id, practitioner_id, department_id, role_code,
                       effective_from, effective_to, status, version, created_at, updated_at
                from practitioner_role where id = ?
                """, this::practitionerRoleView, id);
    }

    @Override
    public Optional<PractitionerRoleView> practitionerRoleByIdForUpdate(UUID id) {
        return queryOne("""
                select id, practitioner_id, department_id, role_code,
                       effective_from, effective_to, status, version, created_at, updated_at
                from practitioner_role where id = ? for update
                """, this::practitionerRoleView, id);
    }

    @Override
    public List<PractitionerRoleView> listPractitionerRoles(UUID practitionerId, UUID departmentId, String status, int limit, int offset) {
        // Simple multi-filter: build SQL dynamically via parameterised args pattern
        StringBuilder sql = new StringBuilder("""
                select id, practitioner_id, department_id, role_code,
                       effective_from, effective_to, status, version, created_at, updated_at
                from practitioner_role where 1=1
                """);
        java.util.List<Object> params = new java.util.ArrayList<>();
        if (practitionerId != null) { sql.append(" and practitioner_id = ?"); params.add(practitionerId); }
        if (departmentId != null)   { sql.append(" and department_id = ?");   params.add(departmentId); }
        if (status != null)         { sql.append(" and status = ?");           params.add(status); }
        sql.append(" order by effective_from desc limit ? offset ?");
        params.add(limit);
        params.add(offset);
        return jdbc.query(sql.toString(), this::practitionerRoleView, params.toArray());
    }

    @Override
    public int revokePractitionerRole(UUID id, long expectedVersion, Instant now) {
        int updated = update("""
                update practitioner_role
                set status = 'REVOKED', effective_to = ?, version = version + 1, updated_at = ?
                where id = ? and version = ? and status = 'ACTIVE'
                """, ts(now), ts(now), id, expectedVersion);
        if (updated != 1) throw new StaleVersionException();
        return updated;
    }

    // ===========================================================
    // Mappers
    // ===========================================================

    private DepartmentView departmentView(ResultSet rs, int row) throws SQLException {
        return new DepartmentView(
                uuid(rs, "id"),
                rs.getLong("version"),
                rs.getString("code"),
                rs.getString("name"),
                rs.getBoolean("active"),
                instant(rs, "effective_from"),
                instantNullable(rs, "effective_to"),
                instant(rs, "created_at"),
                instant(rs, "updated_at"));
    }

    private RoomView roomView(ResultSet rs, int row) throws SQLException {
        return new RoomView(
                uuid(rs, "id"),
                rs.getLong("version"),
                uuid(rs, "department_id"),
                rs.getString("code"),
                rs.getString("name"),
                rs.getBoolean("active"),
                instant(rs, "created_at"),
                instant(rs, "updated_at"));
    }

    private ServiceView serviceView(ResultSet rs, int row) throws SQLException {
        return new ServiceView(
                uuid(rs, "id"),
                rs.getLong("version"),
                rs.getString("code"),
                rs.getString("name"),
                rs.getString("service_type"),
                rs.getBoolean("active"),
                rs.getBoolean("allows_critical"),
                instant(rs, "created_at"),
                instant(rs, "updated_at"));
    }

    private ServicePriceView servicePriceView(ResultSet rs, int row) throws SQLException {
        return new ServicePriceView(
                uuid(rs, "id"),
                uuid(rs, "service_id"),
                rs.getBigDecimal("amount"),
                rs.getString("currency"),
                instant(rs, "effective_from"),
                instantNullable(rs, "effective_to"),
                instant(rs, "created_at"));
    }

    private PractitionerView practitionerView(ResultSet rs, int row) throws SQLException {
        return new PractitionerView(
                uuid(rs, "id"),
                rs.getLong("version"),
                uuidNullable(rs, "user_account_id"),
                rs.getString("staff_code"),
                rs.getString("full_name"),
                rs.getBoolean("active"),
                instant(rs, "created_at"),
                instant(rs, "updated_at"));
    }

    private PractitionerRoleView practitionerRoleView(ResultSet rs, int row) throws SQLException {
        return new PractitionerRoleView(
                uuid(rs, "id"),
                rs.getLong("version"),
                uuid(rs, "practitioner_id"),
                uuid(rs, "department_id"),
                rs.getString("role_code"),
                instant(rs, "effective_from"),
                instantNullable(rs, "effective_to"),
                rs.getString("status"),
                instant(rs, "created_at"),
                instant(rs, "updated_at"));
    }

    // ===========================================================
    // Helpers
    // ===========================================================

    private int update(String sql, Object... args) {
        return jdbc.update(sql, args);
    }

    private <T> Optional<T> queryOne(String sql, org.springframework.jdbc.core.RowMapper<T> mapper, Object... args) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(sql, mapper, args));
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    private static UUID uuid(ResultSet rs, String col) throws SQLException {
        return UUID.fromString(rs.getString(col));
    }

    private static UUID uuidNullable(ResultSet rs, String col) throws SQLException {
        String v = rs.getString(col);
        return v == null ? null : UUID.fromString(v);
    }

    private static Instant instant(ResultSet rs, String col) throws SQLException {
        return rs.getTimestamp(col).toInstant();
    }

    private static Instant instantNullable(ResultSet rs, String col) throws SQLException {
        Timestamp v = rs.getTimestamp(col);
        return v == null ? null : v.toInstant();
    }

    private static Timestamp ts(Instant instant) {
        return instant == null ? null : Timestamp.from(instant);
    }
}
