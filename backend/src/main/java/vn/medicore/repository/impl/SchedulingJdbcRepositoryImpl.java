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
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import vn.medicore.common.exception.StaleVersionException;
import vn.medicore.dto.SchedulingModels.AppointmentSlotRow;
import vn.medicore.dto.SchedulingModels.SlotHoldJdbcRow;
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
        jdbc.update("""
                insert into appointment_slot(id, practitioner_role_id, department_id, room_id, service_id,
                    session, start_at, end_at, capacity, status, version, created_at, updated_at)
                values (:id, :practitionerRoleId, :departmentId, :roomId, :serviceId, :session, :startAt,
                    :endAt, :capacity, :status, :version, :createdAt, :updatedAt)
                """, slotParams(row));
    }

    @Override
    public void updateAppointmentSlot(AppointmentSlotRow row, long expectedVersion) {
        int rows = jdbc.update("""
                update appointment_slot set capacity = :capacity, status = :status, version = :version,
                    updated_at = :updatedAt where id = :id and version = :expectedVersion
                """, slotParams(row).addValue("expectedVersion", expectedVersion));
        if (rows == 0) throw new StaleVersionException();
    }

    @Override
    public Optional<AppointmentSlotRow> appointmentSlotById(UUID id) {
        return queryOne("select * from appointment_slot where id = :id", new MapSqlParameterSource("id", id), this::mapAppointmentSlot);
    }

    @Override
    public Optional<AppointmentSlotRow> appointmentSlotByIdForUpdate(UUID id) {
        return queryOne("select * from appointment_slot where id = :id for update", new MapSqlParameterSource("id", id), this::mapAppointmentSlot);
    }

    @Override
    public List<AppointmentSlotRow> searchAppointmentSlots(int limit, int offset) {
        return jdbc.query("""
                select * from appointment_slot where status = 'ACTIVE'
                order by start_at asc, id asc limit :limit offset :offset
                """, new MapSqlParameterSource("limit", limit).addValue("offset", offset), this::mapAppointmentSlot);
    }

    @Override
    public void lockPractitionerDay(UUID practitionerRoleId, String dateIso) {
        long hash = (practitionerRoleId + dateIso).hashCode();
        jdbc.getJdbcOperations().execute("select pg_advisory_xact_lock(" + hash + ")");
    }

    @Override
    public int countActiveSlotsByPractitionerAndDate(UUID practitionerRoleId, String dateIso) {
        return count("""
                select count(*) from appointment_slot where practitioner_role_id = :roleId and status = 'ACTIVE'
                    and date(start_at at time zone 'Asia/Ho_Chi_Minh') = cast(:date as date)
                """, new MapSqlParameterSource("roleId", practitionerRoleId).addValue("date", dateIso));
    }

    @Override
    public int countActiveSlotsByPractitionerAndSession(UUID practitionerRoleId, String dateIso, String session) {
        return count("""
                select count(*) from appointment_slot where practitioner_role_id = :roleId and status = 'ACTIVE'
                    and session = :session and date(start_at at time zone 'Asia/Ho_Chi_Minh') = cast(:date as date)
                """, new MapSqlParameterSource("roleId", practitionerRoleId).addValue("date", dateIso).addValue("session", session));
    }

    @Override
    public void insertSlotHold(SlotHoldJdbcRow row) {
        jdbc.update("""
                insert into slot_hold(id, slot_id, patient_id, expires_at, deposit_amount, currency,
                    idempotency_scope, idempotency_key, request_hash, status, version, created_at, updated_at)
                values (:id, :slotId, :patientId, :expiresAt, :depositAmount, :currency, null, null, null,
                    :status, :version, :createdAt, :updatedAt)
                """, holdParams(row));
    }

    @Override
    public void updateSlotHold(SlotHoldJdbcRow row, long expectedVersion) {
        int rows = jdbc.update("""
                update slot_hold set status = :status, version = :version, updated_at = :updatedAt
                where id = :id and version = :expectedVersion
                """, holdParams(row).addValue("expectedVersion", expectedVersion));
        if (rows == 0) throw new StaleVersionException();
    }

    @Override
    public Optional<SlotHoldRow> slotHoldById(UUID id) {
        return queryOne("select * from slot_hold where id = :id", new MapSqlParameterSource("id", id), this::mapSlotHoldJdbc)
                .map(SlotHoldJdbcRow::toRow);
    }

    @Override
    public Optional<SlotHoldRow> slotHoldByIdForUpdate(UUID id) {
        return queryOne("select * from slot_hold where id = :id for update", new MapSqlParameterSource("id", id), this::mapSlotHoldJdbc)
                .map(SlotHoldJdbcRow::toRow);
    }

    @Override
    public int expireActiveHolds(UUID slotId, Instant now) {
        return jdbc.update("""
                update slot_hold set status = 'EXPIRED', version = version + 1, updated_at = :now
                where slot_id = :slotId and status = 'ACTIVE' and expires_at <= :now
                """, new MapSqlParameterSource("slotId", slotId).addValue("now", ts(now)));
    }

    @Override
    public int countActiveHoldsAndAppointments(UUID slotId, Instant now) {
        return count("""
                select (
                    select count(*) from slot_hold
                    where slot_id = :slotId and status = 'ACTIVE' and expires_at > :now
                ) + (
                    select count(*) from appointment
                    where slot_id = :slotId and status in ('CONFIRMED', 'FULFILLED')
                )
                """, new MapSqlParameterSource("slotId", slotId).addValue("now", ts(now)));
    }

    @Override
    public Optional<BigDecimal> effectiveServicePrice(UUID serviceId, Instant at) {
        return queryOne("""
                select amount from service_price where service_id = :serviceId and currency = 'VND'
                    and effective_from <= :at and (effective_to is null or effective_to > :at)
                order by effective_from desc, id desc limit 1
                """, new MapSqlParameterSource("serviceId", serviceId).addValue("at", ts(at)),
                (rs, rowNum) -> rs.getBigDecimal("amount"));
    }

    @Override
    public void insertAppointment(vn.medicore.dto.SchedulingModels.AppointmentRow row) {
        jdbc.update("""
                insert into appointment (id, patient_id, slot_hold_id, slot_id, rescheduled_from_id, rescheduled_to_id, status, version, created_at, updated_at)
                values (:id, :patientId, :slotHoldId, :slotId, :rescheduledFromId, :rescheduledToId, :status, :version, :createdAt, :updatedAt)
                """, new MapSqlParameterSource()
                .addValue("id", row.id())
                .addValue("patientId", row.patientId())
                .addValue("slotHoldId", row.slotHoldId())
                .addValue("slotId", row.slotId())
                .addValue("rescheduledFromId", row.rescheduledFromId())
                .addValue("rescheduledToId", row.rescheduledToId())
                .addValue("status", row.status())
                .addValue("version", row.version())
                .addValue("createdAt", ts(row.createdAt()))
                .addValue("updatedAt", ts(row.updatedAt())));
    }

    @Override
    public void updateAppointment(vn.medicore.dto.SchedulingModels.AppointmentRow row, long expectedVersion) {
        int updated = jdbc.update("""
                update appointment set
                    patient_id = :patientId,
                    slot_hold_id = :slotHoldId,
                    slot_id = :slotId,
                    rescheduled_from_id = :rescheduledFromId,
                    rescheduled_to_id = :rescheduledToId,
                    status = :status,
                    version = :version,
                    updated_at = :updatedAt
                where id = :id and version = :expectedVersion
                """, new MapSqlParameterSource()
                .addValue("id", row.id())
                .addValue("patientId", row.patientId())
                .addValue("slotHoldId", row.slotHoldId())
                .addValue("slotId", row.slotId())
                .addValue("rescheduledFromId", row.rescheduledFromId())
                .addValue("rescheduledToId", row.rescheduledToId())
                .addValue("status", row.status())
                .addValue("version", row.version())
                .addValue("updatedAt", ts(row.updatedAt()))
                .addValue("expectedVersion", expectedVersion));
        if (updated == 0) {
            throw new StaleVersionException();
        }
    }

    @Override
    public Optional<vn.medicore.dto.SchedulingModels.AppointmentRow> appointmentById(UUID id) {
        return queryOne("select * from appointment where id = :id", new MapSqlParameterSource("id", id), this::mapAppointment);
    }

    @Override
    public Optional<vn.medicore.dto.SchedulingModels.AppointmentRow> appointmentByIdForUpdate(UUID id) {
        return queryOne("select * from appointment where id = :id for update", new MapSqlParameterSource("id", id), this::mapAppointment);
    }

    @Override
    public Optional<vn.medicore.dto.SchedulingModels.AppointmentRow> appointmentBySlotHoldId(UUID slotHoldId) {
        return queryOne("select * from appointment where slot_hold_id = :slotHoldId", new MapSqlParameterSource("slotHoldId", slotHoldId), this::mapAppointment);
    }

    @Override
    public void insertDepositAllocation(vn.medicore.dto.PaymentModels.DepositAllocationRow row) {
        jdbc.update("""
                insert into deposit_allocation (
                    id, payment_id, appointment_id, amount, currency, allocation_type,
                    source_allocation_id, status, created_at, correlation_id
                ) values (
                    :id, :paymentId, :appointmentId, :amount, :currency, :allocationType,
                    :sourceAllocationId, :status, :createdAt, :correlationId
                )
                """, new MapSqlParameterSource()
                .addValue("id", row.id())
                .addValue("paymentId", row.paymentId())
                .addValue("appointmentId", row.appointmentId())
                .addValue("amount", row.amount())
                .addValue("currency", row.currency())
                .addValue("allocationType", row.allocationType())
                .addValue("sourceAllocationId", row.sourceAllocationId())
                .addValue("status", row.status())
                .addValue("createdAt", ts(row.createdAt()))
                .addValue("correlationId", row.correlationId()));
    }

    @Override
    public void updateDepositAllocationStatus(UUID id, String newStatus, String expectedStatus) {
        int updated = jdbc.update("""
                update deposit_allocation set status = :newStatus
                where id = :id and status = :expectedStatus
                """, new MapSqlParameterSource()
                .addValue("id", id)
                .addValue("newStatus", newStatus)
                .addValue("expectedStatus", expectedStatus));
        if (updated == 0) {
            throw new StaleVersionException();
        }
    }

    @Override
    public List<vn.medicore.dto.PaymentModels.DepositAllocationRow> depositAllocationsByAppointmentId(UUID appointmentId) {
        return jdbc.query("select * from deposit_allocation where appointment_id = :appointmentId order by created_at asc",
                new MapSqlParameterSource("appointmentId", appointmentId), this::mapDepositAllocation);
    }

    @Override
    public Optional<vn.medicore.dto.PaymentModels.DepositAllocationRow> activeDepositAllocationByAppointmentId(UUID appointmentId) {
        return queryOne("select * from deposit_allocation where appointment_id = :appointmentId and status = 'ACTIVE' order by created_at desc limit 1",
                new MapSqlParameterSource("appointmentId", appointmentId), this::mapDepositAllocation);
    }

    @Override
    public Optional<vn.medicore.dto.PaymentModels.DepositAllocationRow> depositAllocationById(UUID id) {
        return queryOne("select * from deposit_allocation where id = :id", new MapSqlParameterSource("id", id), this::mapDepositAllocation);
    }

    @Override
    public void insertDepositTransfer(vn.medicore.dto.PaymentModels.DepositTransferRow row) {
        jdbc.update("""
                insert into deposit_transfer (
                    id, old_appointment_id, new_appointment_id, source_allocation_id, target_allocation_id,
                    amount, currency, difference_amount, difference_disposition, actor_account_id,
                    reason, correlation_id, created_at
                ) values (
                    :id, :oldAppointmentId, :newAppointmentId, :sourceAllocationId, :targetAllocationId,
                    :amount, :currency, :differenceAmount, :differenceDisposition, :actorAccountId,
                    :reason, :correlationId, :createdAt
                )
                """, new MapSqlParameterSource()
                .addValue("id", row.id())
                .addValue("oldAppointmentId", row.oldAppointmentId())
                .addValue("newAppointmentId", row.newAppointmentId())
                .addValue("sourceAllocationId", row.sourceAllocationId())
                .addValue("targetAllocationId", row.targetAllocationId())
                .addValue("amount", row.amount())
                .addValue("currency", row.currency())
                .addValue("differenceAmount", row.differenceAmount())
                .addValue("differenceDisposition", row.differenceDisposition())
                .addValue("actorAccountId", row.actorAccountId())
                .addValue("reason", row.reason())
                .addValue("correlationId", row.correlationId())
                .addValue("createdAt", ts(row.createdAt())));
    }

    @Override
    public Optional<vn.medicore.dto.PaymentModels.DepositTransferRow> depositTransferByOldAppointmentId(UUID oldAppointmentId) {
        return queryOne("select * from deposit_transfer where old_appointment_id = :oldAppointmentId",
                new MapSqlParameterSource("oldAppointmentId", oldAppointmentId), this::mapDepositTransfer);
    }

    private vn.medicore.dto.SchedulingModels.AppointmentRow mapAppointment(ResultSet rs, int rowNum) throws SQLException {
        return new vn.medicore.dto.SchedulingModels.AppointmentRow(
                rs.getObject("id", UUID.class),
                rs.getObject("patient_id", UUID.class),
                rs.getObject("slot_hold_id", UUID.class),
                rs.getObject("slot_id", UUID.class),
                rs.getObject("rescheduled_from_id", UUID.class),
                rs.getObject("rescheduled_to_id", UUID.class),
                rs.getString("status"),
                rs.getLong("version"),
                instant(rs, "created_at"),
                instant(rs, "updated_at"));
    }

    private vn.medicore.dto.PaymentModels.DepositAllocationRow mapDepositAllocation(ResultSet rs, int rowNum) throws SQLException {
        return new vn.medicore.dto.PaymentModels.DepositAllocationRow(
                rs.getObject("id", UUID.class),
                rs.getObject("payment_id", UUID.class),
                rs.getObject("appointment_id", UUID.class),
                rs.getBigDecimal("amount"),
                rs.getString("currency"),
                rs.getString("allocation_type"),
                rs.getObject("source_allocation_id", UUID.class),
                rs.getString("status"),
                instant(rs, "created_at"),
                rs.getString("correlation_id"));
    }

    private vn.medicore.dto.PaymentModels.DepositTransferRow mapDepositTransfer(ResultSet rs, int rowNum) throws SQLException {
        return new vn.medicore.dto.PaymentModels.DepositTransferRow(
                rs.getObject("id", UUID.class),
                rs.getObject("old_appointment_id", UUID.class),
                rs.getObject("new_appointment_id", UUID.class),
                rs.getObject("source_allocation_id", UUID.class),
                rs.getObject("target_allocation_id", UUID.class),
                rs.getBigDecimal("amount"),
                rs.getString("currency"),
                rs.getBigDecimal("difference_amount"),
                rs.getString("difference_disposition"),
                rs.getObject("actor_account_id", UUID.class),
                rs.getString("reason"),
                rs.getString("correlation_id"),
                instant(rs, "created_at"));
    }

    private int count(String sql, MapSqlParameterSource params) {
        Integer value = jdbc.queryForObject(sql, params, Integer.class);
        return value == null ? 0 : value;
    }

    private <T> Optional<T> queryOne(String sql, MapSqlParameterSource params, org.springframework.jdbc.core.RowMapper<T> mapper) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(sql, params, mapper));
        } catch (EmptyResultDataAccessException exception) {
            return Optional.empty();
        }
    }

    private static MapSqlParameterSource slotParams(AppointmentSlotRow row) {
        return new MapSqlParameterSource().addValue("id", row.id()).addValue("practitionerRoleId", row.practitionerRoleId())
                .addValue("departmentId", row.departmentId()).addValue("roomId", row.roomId()).addValue("serviceId", row.serviceId())
                .addValue("session", row.session()).addValue("startAt", ts(row.startAt())).addValue("endAt", ts(row.endAt()))
                .addValue("capacity", row.capacity()).addValue("status", row.status()).addValue("version", row.version())
                .addValue("createdAt", ts(row.createdAt())).addValue("updatedAt", ts(row.updatedAt()));
    }

    private static MapSqlParameterSource holdParams(SlotHoldJdbcRow row) {
        return new MapSqlParameterSource().addValue("id", row.id()).addValue("slotId", row.slotId()).addValue("patientId", row.patientId())
                .addValue("expiresAt", ts(row.expiresAt())).addValue("depositAmount", row.depositAmount()).addValue("currency", row.currency())
                .addValue("status", row.status()).addValue("version", row.version()).addValue("createdAt", ts(row.createdAt()))
                .addValue("updatedAt", ts(row.updatedAt()));
    }

    private AppointmentSlotRow mapAppointmentSlot(ResultSet rs, int rowNum) throws SQLException {
        return new AppointmentSlotRow(rs.getObject("id", UUID.class), rs.getObject("practitioner_role_id", UUID.class),
                rs.getObject("department_id", UUID.class), rs.getObject("room_id", UUID.class), rs.getObject("service_id", UUID.class),
                rs.getString("session"), instant(rs, "start_at"), instant(rs, "end_at"), rs.getInt("capacity"), rs.getString("status"),
                rs.getLong("version"), instant(rs, "created_at"), instant(rs, "updated_at"));
    }

    private SlotHoldJdbcRow mapSlotHoldJdbc(ResultSet rs, int rowNum) throws SQLException {
        return new SlotHoldJdbcRow(rs.getObject("id", UUID.class), rs.getObject("slot_id", UUID.class), rs.getObject("patient_id", UUID.class),
                instant(rs, "expires_at"), rs.getBigDecimal("deposit_amount"), rs.getString("currency"),
                rs.getString("idempotency_scope"), rs.getString("idempotency_key"), rs.getString("request_hash"), rs.getString("status"),
                rs.getLong("version"), instant(rs, "created_at"), instant(rs, "updated_at"));
    }

    private static Timestamp ts(Instant value) { return value == null ? null : Timestamp.from(value); }
    private static Instant instant(ResultSet rs, String column) throws SQLException {
        Timestamp value = rs.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }
}
