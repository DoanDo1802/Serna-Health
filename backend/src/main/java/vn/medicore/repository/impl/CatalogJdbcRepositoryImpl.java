package vn.medicore.repository.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
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
    private final ObjectMapper objectMapper;

    public CatalogJdbcRepositoryImpl(JdbcTemplate jdbc, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
    }

    // ===========================================================
    // Department
    // ===========================================================

    @Override
    public void insertDepartment(DepartmentRow row) {
        String examTemplateJson = row.examTemplateJson() != null ? row.examTemplateJson() : "{\"fields\": []}";
        update("""
                insert into department(id, code, name, active, effective_from, effective_to, exam_template, version, created_at, updated_at)
                values (?, ?, ?, ?, ?, ?, cast(? as jsonb), ?, ?, ?)
                """,
                row.id(), row.code(), row.name(), row.active(),
                ts(row.effectiveFrom()), ts(row.effectiveTo()),
                examTemplateJson,
                row.version(), ts(row.createdAt()), ts(row.updatedAt()));
    }

    @Override
    public Optional<DepartmentView> departmentById(UUID id) {
        return queryOne("""
                select id, code, name, active, effective_from, effective_to, exam_template, version, created_at, updated_at
                from department where id = ?
                """, this::departmentView, id);
    }

    @Override
    public Optional<DepartmentView> departmentByIdForUpdate(UUID id) {
        return queryOne("""
                select id, code, name, active, effective_from, effective_to, exam_template, version, created_at, updated_at
                from department where id = ? for update
                """, this::departmentView, id);
    }

    @Override
    public List<DepartmentView> listDepartments(Boolean active, int limit, int offset) {
        if (active != null) {
            return jdbc.query("""
                    select id, code, name, active, effective_from, effective_to, exam_template, version, created_at, updated_at
                    from department where active = ? order by name, id limit ? offset ?
                    """, this::departmentView, active, limit, offset);
        }
        return jdbc.query("""
                select id, code, name, active, effective_from, effective_to, exam_template, version, created_at, updated_at
                from department order by name, id limit ? offset ?
                """, this::departmentView, limit, offset);
    }

    @Override
    public int updateDepartment(DepartmentRow row, long expectedVersion) {
        int updated = update("""
                update department
                set code = ?, name = ?, active = ?, effective_from = ?, effective_to = ?,
                    exam_template = coalesce(cast(? as jsonb), exam_template, '{"fields": []}'::jsonb),
                    version = version + 1, updated_at = ?
                where id = ? and version = ?
                """,
                row.code(), row.name(), row.active(),
                ts(row.effectiveFrom()), ts(row.effectiveTo()),
                row.examTemplateJson(),
                ts(row.updatedAt()), row.id(), expectedVersion);
        if (updated != 1) throw new StaleVersionException();
        return updated;
    }

    @Override
    public int countRoomsByDepartmentId(UUID departmentId) {
        Integer count = jdbc.queryForObject("select count(*) from room_department where department_id = ?", Integer.class, departmentId);
        return count != null ? count : 0;
    }

    @Override
    public int countPersonnelByDepartmentId(UUID departmentId) {
        Integer count = jdbc.queryForObject("""
                select (select count(*) from account_role_assignment where department_id = ? and status = 'ACTIVE')
                     + (select count(*) from practitioner_role where department_id = ? and status = 'ACTIVE')
                """, Integer.class, departmentId, departmentId);
        return count != null ? count : 0;
    }

    @Override
    public int deleteDepartment(UUID departmentId, long expectedVersion) {
        update("delete from practitioner_role where department_id = ? and status != 'ACTIVE'", departmentId);
        update("delete from account_role_assignment where department_id = ? and status != 'ACTIVE'", departmentId);
        int deleted = update("delete from department where id = ? and version = ?", departmentId, expectedVersion);
        if (deleted != 1) throw new StaleVersionException();
        return deleted;
    }

    // ===========================================================
    // Room
    // ===========================================================

    @Override
    public void insertRoom(RoomRow row) {
        update("""
                insert into room(id, department_id, code, name, active, version, created_at, updated_at)
                values (?, null, ?, ?, ?, ?, ?, ?)
                """,
                row.id(), row.code(), row.name(), row.active(), row.version(), ts(row.createdAt()), ts(row.updatedAt()));
    }

    @Override
    public Optional<RoomView> roomById(UUID id) {
        return queryOne("""
                select id, code, name, active, version, created_at, updated_at
                from room where id = ?
                """, this::roomView, id);
    }

    @Override
    public Optional<RoomView> roomByIdForUpdate(UUID id) {
        return queryOne("""
                select id, code, name, active, version, created_at, updated_at
                from room where id = ? for update
                """, this::roomView, id);
    }

    @Override
    public List<RoomView> listRooms(UUID departmentId, Boolean active, int limit, int offset) {
        String filters = "";
        if (departmentId != null) filters += " join room_department rd on rd.room_id = r.id";
        filters += " where 1 = 1";
        if (departmentId != null) filters += " and rd.department_id = ?";
        if (active != null) filters += " and r.active = ?";
        String sql = "select r.id, r.code, r.name, r.active, r.version, r.created_at, r.updated_at from room r"
                + filters + " order by r.name, r.id limit ? offset ?";
        if (departmentId != null && active != null) return jdbc.query(sql, this::roomView, departmentId, active, limit, offset);
        if (departmentId != null) return jdbc.query(sql, this::roomView, departmentId, limit, offset);
        if (active != null) return jdbc.query(sql, this::roomView, active, limit, offset);
        return jdbc.query(sql, this::roomView, limit, offset);
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

    @Override
    public List<UUID> roomDepartmentIds(UUID roomId) {
        return jdbc.query("select department_id from room_department where room_id = ? order by department_id",
                (rs, rowNum) -> rs.getObject(1, UUID.class), roomId);
    }

    @Override
    public List<UUID> roomServiceIds(UUID roomId) {
        return jdbc.query("select service_id from room_service where room_id = ? order by service_id",
                (rs, rowNum) -> rs.getObject(1, UUID.class), roomId);
    }

    @Override
    public void replaceRoomAssignments(UUID roomId, List<UUID> departmentIds, List<UUID> serviceIds, Instant createdAt) {
        update("delete from room_department where room_id = ?", roomId);
        update("delete from room_service where room_id = ?", roomId);
        for (UUID departmentId : departmentIds) {
            update("insert into room_department(room_id, department_id, created_at) values (?, ?, ?)",
                    roomId, departmentId, ts(createdAt));
        }
        for (UUID serviceId : serviceIds) {
            update("insert into room_service(room_id, service_id, created_at) values (?, ?, ?)",
                    roomId, serviceId, ts(createdAt));
        }
    }

    @Override
    public int countActiveOrFutureSchedulesUsingRoomDepartmentOrService(
            UUID roomId, List<UUID> removedDepartmentIds, List<UUID> removedServiceIds, Instant now) {
        if (removedDepartmentIds.isEmpty() && removedServiceIds.isEmpty()) return 0;
        String sql = """
                select count(*)
                from work_schedule ws
                join booking_session bs on bs.id = ws.booking_session_id
                where ws.room_id = ? and ws.status = 'ACTIVE' and bs.status = 'ACTIVE' and bs.end_at > ?
                  and ((cardinality(?::uuid[]) > 0 and bs.department_id = any(?::uuid[]))
                    or (cardinality(?::uuid[]) > 0 and bs.service_id = any(?::uuid[])))
                """;
        java.sql.Array departmentArray = jdbc.execute((java.sql.Connection connection) ->
                connection.createArrayOf("uuid", removedDepartmentIds.toArray(UUID[]::new)));
        java.sql.Array serviceArray = jdbc.execute((java.sql.Connection connection) ->
                connection.createArrayOf("uuid", removedServiceIds.toArray(UUID[]::new)));
        try {
            Integer count = jdbc.queryForObject(sql, Integer.class, roomId, ts(now), departmentArray, departmentArray,
                    serviceArray, serviceArray);
            return count == null ? 0 : count;
        } finally {
            try { departmentArray.free(); } catch (java.sql.SQLException ignored) { }
            try { serviceArray.free(); } catch (java.sql.SQLException ignored) { }
        }
    }

    @Override
    public int countSchedulesByRoomId(UUID roomId) {
        Integer count = jdbc.queryForObject(
                "select count(*) from work_schedule where room_id = ?",
                Integer.class, roomId);
        return count == null ? 0 : count;
    }

    @Override
    public int deleteRoom(UUID roomId, long expectedVersion) {
        update("delete from room_department where room_id = ?", roomId);
        update("delete from room_service where room_id = ?", roomId);
        update("update facility_floor_element set room_id = null where room_id = ?", roomId);
        int deleted = update("delete from room where id = ? and version = ?", roomId, expectedVersion);
        if (deleted != 1) throw new StaleVersionException();
        return deleted;
    }

    // ===========================================================
    // Service
    // ===========================================================

    @Override
    public void insertService(ServiceRow row) {
        update("""
                insert into service(id, code, name, service_type, department_id, active, allows_critical, version, created_at, updated_at)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                row.id(), row.code(), row.name(), row.serviceType(), row.departmentId(),
                row.active(), row.allowsCritical(), row.version(),
                ts(row.createdAt()), ts(row.updatedAt()));
    }

    @Override
    public Optional<ServiceView> serviceById(UUID id) {
        return queryOne("""
                select id, code, name, service_type, department_id, active, allows_critical, version, created_at, updated_at
                from service where id = ?
                """, this::serviceView, id);
    }

    @Override
    public Optional<ServiceView> serviceByIdForUpdate(UUID id) {
        return queryOne("""
                select id, code, name, service_type, department_id, active, allows_critical, version, created_at, updated_at
                from service where id = ? for update
                """, this::serviceView, id);
    }

    @Override
    public List<ServiceView> listServices(String serviceType, Boolean active, UUID departmentId, int limit, int offset) {
        StringBuilder sql = new StringBuilder("""
                select id, code, name, service_type, department_id, active, allows_critical, version, created_at, updated_at
                from service where 1=1
                """);
        List<Object> params = new ArrayList<>();
        if (serviceType != null) {
            sql.append(" and service_type = ?");
            params.add(serviceType);
        }
        if (active != null) {
            sql.append(" and active = ?");
            params.add(active);
        }
        if (departmentId != null) {
            sql.append(" and department_id = ?");
            params.add(departmentId);
        }
        sql.append(" order by name, id limit ? offset ?");
        params.add(limit);
        params.add(offset);
        return jdbc.query(sql.toString(), this::serviceView, params.toArray());
    }

    @Override
    public int updateService(ServiceRow row, long expectedVersion) {
        int updated = update("""
                update service
                set code = ?, name = ?, service_type = ?, department_id = ?, active = ?, version = version + 1, updated_at = ?
                where id = ? and version = ?
                """,
                row.code(), row.name(), row.serviceType(), row.departmentId(), row.active(),
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
                select id, service_id, amount, currency, effective_from, effective_to, version, created_at, updated_at
                from service_price where service_id = ?
                order by effective_from desc, id limit ? offset ?
                """, this::servicePriceView, serviceId, limit, offset);
    }

    @Override
    public Optional<ServicePriceView> priceById(UUID id) {
        return queryOne("""
                select id, service_id, amount, currency, effective_from, effective_to, version, created_at, updated_at
                from service_price where id = ?
                """, this::servicePriceView, id);
    }

    @Override
    public Optional<ServicePriceView> currentPrice(UUID serviceId, Instant at) {
        return queryOne("""
                select id, service_id, amount, currency, effective_from, effective_to, version, created_at, updated_at
                from service_price
                where service_id = ? and effective_from <= ?
                  and (effective_to is null or effective_to > ?)
                order by effective_from desc, id limit 1
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
    public List<PractitionerView> listPractitioners(Boolean active, int limit, int offset) {
        if (active != null) {
            return jdbc.query("""
                    select id, user_account_id, staff_code, full_name, active, version, created_at, updated_at
                    from practitioner where active = ? order by full_name, id limit ? offset ?
                    """, this::practitionerView, active, limit, offset);
        }
        return jdbc.query("""
                select id, user_account_id, staff_code, full_name, active, version, created_at, updated_at
                from practitioner order by full_name, id limit ? offset ?
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

    @Override
    public Optional<PractitionerView> practitionerByAccountId(UUID accountId) {
        return queryOne("""
                select id, user_account_id, staff_code, full_name, active, version, created_at, updated_at
                from practitioner where user_account_id = ?
                """, this::practitionerView, accountId);
    }

    @Override
    public Optional<PractitionerView> practitionerByStaffCode(String staffCode) {
        return queryOne("""
                select id, user_account_id, staff_code, full_name, active, version, created_at, updated_at
                from practitioner where staff_code = ?
                """, this::practitionerView, staffCode);
    }

    @Override
    public List<UUID> listPersonnelAccountIds(String type, Boolean active, int limit, int offset) {
        StringBuilder sql = new StringBuilder("""
                select account_id from (
                    select p.user_account_id as account_id, p.active as profile_active, a.status as account_status, p.created_at
                    from practitioner p
                    join practitioner_profile pp on pp.practitioner_id = p.id
                    join user_account a on a.id = p.user_account_id
                    where p.user_account_id is not null
                    union all
                    select pm.account_id, pm.active, a.status, pm.created_at
                    from personnel_member pm
                    join user_account a on a.id = pm.account_id
                ) personnel
                where 1=1
                """);
        java.util.List<Object> params = new java.util.ArrayList<>();
        if ("DOCTOR".equals(type)) {
            sql.append(" and account_id in (select user_account_id from practitioner where user_account_id is not null)");
        } else if ("STAFF".equals(type)) {
            sql.append(" and account_id in (select account_id from personnel_member)");
        }
        if (Boolean.TRUE.equals(active)) {
            sql.append(" and profile_active and account_status = 'ACTIVE'");
        } else if (Boolean.FALSE.equals(active)) {
            sql.append(" and (not profile_active or account_status <> 'ACTIVE')");
        }
        sql.append(" order by created_at, account_id limit ? offset ?");
        params.add(limit);
        params.add(offset);
        return jdbc.queryForList(sql.toString(), UUID.class, params.toArray());
    }

    @Override
    public void insertPersonnelMember(PersonnelMemberRow row) {
        update("""
                insert into personnel_member(account_id, staff_code, full_name, active, version, created_at, updated_at)
                values (?, ?, ?, ?, ?, ?, ?)
                """, row.accountId(), row.staffCode(), row.fullName(), row.active(), row.version(),
                ts(row.createdAt()), ts(row.updatedAt()));
    }

    @Override
    public Optional<PersonnelMemberRow> personnelMemberByAccountId(UUID accountId) {
        return queryOne("""
                select account_id, staff_code, full_name, active, version, created_at, updated_at
                from personnel_member where account_id = ?
                """, this::personnelMemberRow, accountId);
    }

    @Override
    public Optional<PersonnelMemberRow> personnelMemberByStaffCode(String staffCode) {
        return queryOne("""
                select account_id, staff_code, full_name, active, version, created_at, updated_at
                from personnel_member where staff_code = ?
                """, this::personnelMemberRow, staffCode);
    }

    @Override
    public int updatePersonnelMember(PersonnelMemberRow row, long expectedVersion) {
        int updated = update("""
                update personnel_member
                set staff_code = ?, full_name = ?, active = ?, version = version + 1, updated_at = ?
                where account_id = ? and version = ?
                """, row.staffCode(), row.fullName(), row.active(), ts(row.updatedAt()), row.accountId(), expectedVersion);
        if (updated != 1) throw new StaleVersionException();
        return updated;
    }

    @Override
    public void insertPractitionerProfile(PractitionerProfileRow row) {
        update("""
                insert into practitioner_profile(practitioner_id, phone, date_of_birth, gender, address,
                    professional_title, academic_degree, specialty_designation, license_number,
                    licensing_authority, license_issued_on, license_expires_on, years_experience,
                    biography, avatar_url, version, created_at, updated_at)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, row.practitionerId(), row.phone(), row.dateOfBirth(), row.gender(), row.address(),
                row.professionalTitle(), row.academicDegree(), row.specialtyDesignation(), row.licenseNumber(),
                row.licensingAuthority(), row.licenseIssuedOn(), row.licenseExpiresOn(), row.yearsExperience(),
                row.biography(), row.avatarUrl(), row.version(), ts(row.createdAt()), ts(row.updatedAt()));
    }

    @Override
    public Optional<PractitionerProfileRow> practitionerProfileByPractitionerId(UUID practitionerId) {
        return queryOne("""
                select practitioner_id, phone, date_of_birth, gender, address, professional_title,
                    academic_degree, specialty_designation, license_number, licensing_authority,
                    license_issued_on, license_expires_on, years_experience, biography, avatar_url,
                    version, created_at, updated_at
                from practitioner_profile where practitioner_id = ?
                """, this::practitionerProfileRow, practitionerId);
    }

    @Override
    public int updatePractitionerProfile(PractitionerProfileRow row, long expectedVersion) {
        int updated = update("""
                update practitioner_profile
                set phone = ?, date_of_birth = ?, gender = ?, address = ?, professional_title = ?,
                    academic_degree = ?, specialty_designation = ?, license_number = ?, licensing_authority = ?,
                    license_issued_on = ?, license_expires_on = ?, years_experience = ?, biography = ?, avatar_url = ?,
                    version = version + 1, updated_at = ?
                where practitioner_id = ? and version = ?
                """, row.phone(), row.dateOfBirth(), row.gender(), row.address(), row.professionalTitle(),
                row.academicDegree(), row.specialtyDesignation(), row.licenseNumber(), row.licensingAuthority(),
                row.licenseIssuedOn(), row.licenseExpiresOn(), row.yearsExperience(), row.biography(), row.avatarUrl(),
                ts(row.updatedAt()), row.practitionerId(), expectedVersion);
        if (updated != 1) throw new StaleVersionException();
        return updated;
    }

    @Override
    public void revokeActivePractitionerRoles(UUID practitionerId, UUID actorId, Instant now, String reason) {
        update("""
                update practitioner_role
                set status = 'REVOKED',
                    effective_to = case when effective_from < ? then ? else effective_to end,
                    revoked_at = ?, revoked_by_account_id = ?, revoke_reason = ?,
                    version = version + 1, updated_at = ?
                where practitioner_id = ? and status = 'ACTIVE'
                """, ts(now), ts(now), ts(now), actorId, reason, ts(now), practitionerId);
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
                       effective_from, effective_to, status, revoked_at, revoked_by_account_id, revoke_reason,
                       version, created_at, updated_at
                from practitioner_role where id = ?
                """, this::practitionerRoleView, id);
    }

    @Override
    public Optional<PractitionerRoleView> practitionerRoleByIdForUpdate(UUID id) {
        return queryOne("""
                select id, practitioner_id, department_id, role_code,
                       effective_from, effective_to, status, revoked_at, revoked_by_account_id, revoke_reason,
                       version, created_at, updated_at
                from practitioner_role where id = ? for update
                """, this::practitionerRoleView, id);
    }

    @Override
    public int updatePractitionerRole(PractitionerRoleRow row, long expectedVersion) {
        int updated = update("""
                update practitioner_role
                set department_id = ?, status = ?, effective_from = ?, effective_to = ?,
                    version = version + 1, updated_at = ?
                where id = ? and version = ?
                """, row.departmentId(), row.status(), ts(row.effectiveFrom()), ts(row.effectiveTo()), ts(row.updatedAt()),
                row.id(), expectedVersion);
        if (updated != 1) throw new StaleVersionException();
        return updated;
    }

    @Override
    public List<PractitionerRoleView> listPractitionerRoles(UUID practitionerId, UUID departmentId, String status, int limit, int offset) {
        // Simple multi-filter: build SQL dynamically via parameterised args pattern
        StringBuilder sql = new StringBuilder("""
                select id, practitioner_id, department_id, role_code,
                       effective_from, effective_to, status, revoked_at, revoked_by_account_id, revoke_reason,
                       version, created_at, updated_at
                from practitioner_role where 1=1
                """);
        java.util.List<Object> params = new java.util.ArrayList<>();
        if (practitionerId != null) { sql.append(" and practitioner_id = ?"); params.add(practitionerId); }
        if (departmentId != null)   { sql.append(" and department_id = ?");   params.add(departmentId); }
        if (status != null)         { sql.append(" and status = ?");           params.add(status); }
        sql.append(" order by effective_from desc, id limit ? offset ?");
        params.add(limit);
        params.add(offset);
        return jdbc.query(sql.toString(), this::practitionerRoleView, params.toArray());
    }

    @Override
    public int revokePractitionerRole(
            UUID id,
            long expectedVersion,
            Instant now,
            UUID revokedByAccountId,
            String revokeReason) {
        int updated = update("""
                update practitioner_role
                set status = 'REVOKED',
                    effective_to = case when effective_from < ? then ? else effective_to end,
                    revoked_at = ?, revoked_by_account_id = ?, revoke_reason = ?,
                    version = version + 1, updated_at = ?
                where id = ? and version = ? and status = 'ACTIVE'
                """, ts(now), ts(now), ts(now), revokedByAccountId, revokeReason, ts(now), id, expectedVersion);
        if (updated != 1) throw new StaleVersionException();
        return updated;
    }

    // ===========================================================
    // Mappers
    // ===========================================================

    private DepartmentView departmentView(ResultSet rs, int row) throws SQLException {
        String examTemplateStr = rs.getString("exam_template");
        Object examTemplate = parseJson(examTemplateStr);
        return new DepartmentView(
                uuid(rs, "id"),
                rs.getLong("version"),
                rs.getString("code"),
                rs.getString("name"),
                rs.getBoolean("active"),
                instant(rs, "effective_from"),
                instantNullable(rs, "effective_to"),
                examTemplate,
                instant(rs, "created_at"),
                instant(rs, "updated_at"));
    }

    private Object parseJson(String json) {
        if (json == null || json.isBlank()) {
            return Map.of("fields", List.of());
        }
        try {
            return objectMapper.readValue(json, Object.class);
        } catch (Exception e) {
            return Map.of("fields", List.of());
        }
    }

    private RoomView roomView(ResultSet rs, int row) throws SQLException {
        return new RoomView(
                uuid(rs, "id"),
                rs.getLong("version"),
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
                uuidNullable(rs, "department_id"),
                rs.getBoolean("active"),
                rs.getBoolean("allows_critical"),
                instant(rs, "created_at"),
                instant(rs, "updated_at"));
    }

    private ServicePriceView servicePriceView(ResultSet rs, int row) throws SQLException {
        return new ServicePriceView(
                uuid(rs, "id"),
                rs.getLong("version"),
                uuid(rs, "service_id"),
                rs.getBigDecimal("amount"),
                rs.getString("currency"),
                instant(rs, "effective_from"),
                instantNullable(rs, "effective_to"),
                instant(rs, "created_at"),
                instant(rs, "updated_at"));
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

    private PersonnelMemberRow personnelMemberRow(ResultSet rs, int row) throws SQLException {
        return new PersonnelMemberRow(
                uuid(rs, "account_id"),
                rs.getString("staff_code"),
                rs.getString("full_name"),
                rs.getBoolean("active"),
                rs.getLong("version"),
                instant(rs, "created_at"),
                instant(rs, "updated_at"));
    }

    private PractitionerProfileRow practitionerProfileRow(ResultSet rs, int row) throws SQLException {
        return new PractitionerProfileRow(
                uuid(rs, "practitioner_id"),
                rs.getString("phone"),
                rs.getObject("date_of_birth", java.time.LocalDate.class),
                rs.getString("gender"),
                rs.getString("address"),
                rs.getString("professional_title"),
                rs.getString("academic_degree"),
                rs.getString("specialty_designation"),
                rs.getString("license_number"),
                rs.getString("licensing_authority"),
                rs.getObject("license_issued_on", java.time.LocalDate.class),
                rs.getObject("license_expires_on", java.time.LocalDate.class),
                rs.getInt("years_experience"),
                rs.getString("biography"),
                rs.getString("avatar_url"),
                rs.getLong("version"),
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
                instantNullable(rs, "revoked_at"),
                uuidNullable(rs, "revoked_by_account_id"),
                rs.getString("revoke_reason"),
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
