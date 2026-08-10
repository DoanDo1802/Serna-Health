package vn.medicore.repository.impl;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import vn.medicore.common.exception.StaleVersionException;
import vn.medicore.dto.SchedulingModels.AppointmentSlotRow;
import vn.medicore.dto.SchedulingModels.SlotHoldRow;
import vn.medicore.repository.SchedulingRepository;

@Repository
public class SchedulingJdbcRepositoryImpl implements SchedulingRepository {

    private final NamedParameterJdbcTemplate jdbc;

    public SchedulingJdbcRepositoryImpl(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void insertAppointmentSlot(AppointmentSlotRow row) {
        jdbc.update(
                """
                insert into appointment_slot(
                    id, practitioner_role_id, department_id, room_id, service_id,
                    session, start_at, end_at, capacity, status, version, created_at, updated_at
                ) values (
                    :id, :practitionerRoleId, :departmentId, :roomId, :serviceId,
                    :session, :startAt, :endAt, :capacity, :status, :version, :createdAt, :updatedAt
                )
                """,
                new MapSqlParameterSource()
                        .addValue("id", row.id())
                        .addValue("practitionerRoleId", row.practitionerRoleId())
                        .addValue("departmentId", row.departmentId())
                        .addValue("roomId", row.roomId())
                        .addValue("serviceId", row.serviceId())
                        .addValue("session", row.session())
                        .addValue("startAt", ts(row.startAt()))
                        .addValue("endAt", ts(row.endAt()))
                        .addValue("capacity", row.capacity())
                        .addValue("status", row.status())
                        .addValue("version", row.version())
                        .addValue("createdAt", ts(row.createdAt()))
                        .addValue("updatedAt", ts(row.updatedAt())));
    }

    @Override
    public void updateAppointmentSlot(AppointmentSlotRow row, long expectedVersion) {
        int rows = jdbc.update(
                """
                update appointment_slot set
                    capacity = :capacity,
                    status = :status,
                    version = :newVersion,
                    updated_at = :updatedAt
                where id = :id and version = :expectedVersion
                """,
                new MapSqlParameterSource()
                        .addValue("id", row.id())
                        .addValue("capacity", row.capacity())
                        .addValue("status", row.status())
                        .addValue("newVersion", row.version())
                        .addValue("updatedAt", ts(row.updatedAt()))
                        .addValue("expectedVersion", expectedVersion));
        if (rows == 0) throw new StaleVersionException();
    }

    @Override
    public Optional<AppointmentSlotRow> appointmentSlotById(UUID id) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    "select * from appointment_slot where id = :id",
                    new MapSqlParameterSource("id", id),
                    this::mapAppointmentSlot));
        } catch (DataAccessException e) {
            return Optional.empty();
        }
    }

    @Override
    public List<AppointmentSlotRow> searchAppointmentSlots(int limit, int offset) {
        return jdbc.query(
                "select * from appointment_slot order by start_at desc, id limit :limit offset :offset",
                new MapSqlParameterSource("limit", limit).addValue("offset", offset),
                this::mapAppointmentSlot);
    }

    @Override
    public void lockPractitionerDay(UUID practitionerRoleId, String dateIso) {
        // We hash the practitionerRoleId and the date to get a 64-bit integer for pg_advisory_xact_lock.
        long hash = (practitionerRoleId.toString() + dateIso).hashCode();
        jdbc.getJdbcOperations().execute("select pg_advisory_xact_lock(" + hash + ")");
    }

    @Override
    public int countActiveSlotsByPractitionerAndDate(UUID practitionerRoleId, String dateIso) {
        Integer count = jdbc.queryForObject(
                """
                select count(*) from appointment_slot 
                where practitioner_role_id = :roleId 
                  and status = 'ACTIVE'
                  and date(start_at at time zone 'Asia/Ho_Chi_Minh') = :date::date
                """,
                new MapSqlParameterSource("roleId", practitionerRoleId).addValue("date", dateIso),
                Integer.class);
        return count == null ? 0 : count;
    }

    @Override
    public int countActiveSlotsByPractitionerAndSession(UUID practitionerRoleId, String dateIso, String session) {
        Integer count = jdbc.queryForObject(
                """
                select count(*) from appointment_slot 
                where practitioner_role_id = :roleId 
                  and status = 'ACTIVE'
                  and session = :session
                  and date(start_at at time zone 'Asia/Ho_Chi_Minh') = :date::date
                """,
                new MapSqlParameterSource("roleId", practitionerRoleId)
                        .addValue("date", dateIso)
                        .addValue("session", session),
                Integer.class);
        return count == null ? 0 : count;
    }

    @Override
    public void insertSlotHold(SlotHoldRow row) {
        jdbc.update(
                """
                insert into slot_hold(
                    id, slot_id, patient_id, expires_at, deposit_amount, currency,
                    idempotency_scope, idempotency_key, request_hash, status, version, created_at, updated_at
                ) values (
                    :id, :slotId, :patientId, :expiresAt, :depositAmount, :currency,
                    :scope, :key, :hash, :status, :version, :createdAt, :updatedAt
                )
                """,
                new MapSqlParameterSource()
                        .addValue("id", row.id())
                        .addValue("slotId", row.slotId())
                        .addValue("patientId", row.patientId())
                        .addValue("expiresAt", ts(row.expiresAt()))
                        .addValue("depositAmount", row.depositAmount())
                        .addValue("currency", row.currency())
                        .addValue("scope", row.idempotencyScope())
                        .addValue("key", row.idempotencyKey())
                        .addValue("hash", row.requestHash())
                        .addValue("status", row.status())
                        .addValue("version", row.version())
                        .addValue("createdAt", ts(row.createdAt()))
                        .addValue("updatedAt", ts(row.updatedAt())));
    }

    @Override
    public void updateSlotHold(SlotHoldRow row, long expectedVersion) {
        int rows = jdbc.update(
                """
                update slot_hold set
                    status = :status,
                    version = :newVersion,
                    updated_at = :updatedAt
                where id = :id and version = :expectedVersion
                """,
                new MapSqlParameterSource()
                        .addValue("id", row.id())
                        .addValue("status", row.status())
                        .addValue("newVersion", row.version())
                        .addValue("updatedAt", ts(row.updatedAt()))
                        .addValue("expectedVersion", expectedVersion));
        if (rows == 0) throw new StaleVersionException();
    }

    @Override
    public Optional<SlotHoldRow> slotHoldById(UUID id) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    "select * from slot_hold where id = :id",
                    new MapSqlParameterSource("id", id),
                    this::mapSlotHold));
        } catch (DataAccessException e) {
            return Optional.empty();
        }
    }

    @Override
    public Optional<SlotHoldRow> slotHoldByIdempotency(String scope, String key) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    "select * from slot_hold where idempotency_scope = :scope and idempotency_key = :key",
                    new MapSqlParameterSource("scope", scope).addValue("key", key),
                    this::mapSlotHold));
        } catch (DataAccessException e) {
            return Optional.empty();
        }
    }

    @Override
    public int countActiveHoldsAndAppointments(UUID slotId) {
        // For R1-05, we only count slot holds. Appointments will be added in R1-07.
        Integer count = jdbc.queryForObject(
                """
                select count(*) from slot_hold 
                where slot_id = :slotId 
                  and status = 'ACTIVE' 
                  and expires_at > now()
                """,
                new MapSqlParameterSource("slotId", slotId),
                Integer.class);
        return count == null ? 0 : count;
    }

    private AppointmentSlotRow mapAppointmentSlot(ResultSet rs, int rowNum) throws SQLException {
        return new AppointmentSlotRow(
                rs.getObject("id", UUID.class),
                rs.getObject("practitioner_role_id", UUID.class),
                rs.getObject("department_id", UUID.class),
                rs.getObject("room_id", UUID.class),
                rs.getObject("service_id", UUID.class),
                rs.getString("session"),
                instant(rs, "start_at"),
                instant(rs, "end_at"),
                rs.getInt("capacity"),
                rs.getString("status"),
                rs.getLong("version"),
                instant(rs, "created_at"),
                instant(rs, "updated_at")
        );
    }

    private SlotHoldRow mapSlotHold(ResultSet rs, int rowNum) throws SQLException {
        return new SlotHoldRow(
                rs.getObject("id", UUID.class),
                rs.getObject("slot_id", UUID.class),
                rs.getObject("patient_id", UUID.class),
                instant(rs, "expires_at"),
                rs.getBigDecimal("deposit_amount"),
                rs.getString("currency"),
                rs.getString("idempotency_scope"),
                rs.getString("idempotency_key"),
                rs.getString("request_hash"),
                rs.getString("status"),
                rs.getLong("version"),
                instant(rs, "created_at"),
                instant(rs, "updated_at")
        );
    }

    private static Timestamp ts(Instant instant) {
        return instant == null ? null : Timestamp.from(instant);
    }

    private static Instant instant(ResultSet rs, String col) throws SQLException {
        Timestamp ts = rs.getTimestamp(col);
        return ts == null ? null : ts.toInstant();
    }
}
