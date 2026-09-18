package vn.medicore.repository.impl;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import vn.medicore.common.exception.StaleVersionException;
import vn.medicore.dto.SchedulingModels.AppointmentSlotRow;
import vn.medicore.dto.SchedulingModels.BookingAvailabilityProjection;
import vn.medicore.dto.SchedulingModels.BookingCatalog;
import vn.medicore.dto.SchedulingModels.RescheduleCatalog;
import vn.medicore.dto.SchedulingModels.BookingSessionAvailabilityProjection;
import vn.medicore.dto.SchedulingModels.BookingSessionRow;
import vn.medicore.dto.SchedulingModels.BookingDepartment;
import vn.medicore.dto.SchedulingModels.BookingPractitioner;
import vn.medicore.dto.SchedulingModels.BookingPractitionerRole;
import vn.medicore.dto.SchedulingModels.BookingRoom;
import vn.medicore.dto.SchedulingModels.BookingService;
import vn.medicore.dto.SchedulingModels.WorkScheduleCandidate;
import vn.medicore.dto.SchedulingModels.WorkScheduleCatalog;
import vn.medicore.dto.SchedulingModels.WorkScheduleRow;
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
                update appointment_slot set
                    practitioner_role_id = :practitionerRoleId,
                    department_id = :departmentId,
                    room_id = :roomId,
                    service_id = :serviceId,
                    session = :session,
                    start_at = :startAt,
                    end_at = :endAt,
                    capacity = :capacity,
                    status = :status,
                    version = :version,
                    updated_at = :updatedAt
                where id = :id and version = :expectedVersion
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
    public List<BookingAvailabilityProjection> searchBookingAvailability(
            UUID patientId,
            Instant now,
            UUID excludedAppointmentId,
            UUID currentSlotId,
            int limit,
            int offset) {
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("patientId", patientId, Types.OTHER)
                .addValue("now", ts(now))
                .addValue("excludedAppointmentId", excludedAppointmentId, Types.OTHER)
                .addValue("currentSlotId", currentSlotId, Types.OTHER)
                .addValue("limit", limit)
                .addValue("offset", offset);
        return jdbc.query("""
                with candidate_slots as materialized (
                    select s.id, s.version, s.practitioner_role_id, s.department_id, s.room_id, s.service_id,
                        s.session, s.start_at, s.end_at, s.capacity
                    from appointment_slot s
                    where s.status = 'ACTIVE' and s.start_at > :now
                    order by s.start_at asc, s.id asc
                    limit :limit offset :offset
                ), patient_reservations as materialized (
                    select hold.slot_id, slot.start_at, slot.end_at
                    from slot_hold hold
                    join appointment_slot slot on slot.id = hold.slot_id
                    where hold.patient_id = :patientId
                      and hold.status = 'ACTIVE'
                      and hold.expires_at > :now

                    union all

                    select appointment.slot_id, slot.start_at, slot.end_at
                    from appointment
                    join appointment_slot slot on slot.id = appointment.slot_id
                    where appointment.patient_id = :patientId
                      and appointment.status in ('CONFIRMED', 'FULFILLED')
                      and (cast(:excludedAppointmentId as uuid) is null
                           or appointment.id <> cast(:excludedAppointmentId as uuid))
                ), active_hold_counts as (
                    select hold.slot_id, count(*)::integer as reservation_count
                    from slot_hold hold
                    join candidate_slots candidate on candidate.id = hold.slot_id
                    where hold.status = 'ACTIVE' and hold.expires_at > :now
                    group by hold.slot_id
                ), appointment_counts as (
                    select appointment.slot_id, count(*)::integer as reservation_count
                    from appointment
                    join candidate_slots candidate on candidate.id = appointment.slot_id
                    where appointment.status in ('CONFIRMED', 'FULFILLED')
                    group by appointment.slot_id
                ), slot_occupancy as (
                    select slot_id, sum(reservation_count)::integer as reservation_count
                    from (
                        select * from active_hold_counts
                        union all
                        select * from appointment_counts
                    ) counts
                    group by slot_id
                )
                select candidate.id, candidate.version, candidate.practitioner_role_id, candidate.department_id,
                    candidate.room_id, candidate.service_id, candidate.session, candidate.start_at, candidate.end_at,
                    case
                        when cast(:currentSlotId as uuid) is not null
                             and candidate.id = cast(:currentSlotId as uuid) then 'CURRENT_APPOINTMENT'
                        when exists (
                            select 1 from patient_reservations reservation
                            where reservation.slot_id = candidate.id
                        ) then 'ALREADY_BOOKED'
                        when exists (
                            select 1 from patient_reservations reservation
                            where reservation.start_at < candidate.end_at
                              and reservation.end_at > candidate.start_at
                        ) then 'PATIENT_TIME_CONFLICT'
                        when coalesce(occupancy.reservation_count, 0) >= candidate.capacity then 'SLOT_FULL'
                        else null
                    end as disabled_reason
                from candidate_slots candidate
                left join slot_occupancy occupancy on occupancy.slot_id = candidate.id
                order by candidate.start_at asc, candidate.id asc
                """, params, this::mapBookingAvailabilityProjection);
    }

    @Override
    public BookingCatalog bookingCatalog(Instant now) {
        MapSqlParameterSource params = new MapSqlParameterSource("now", ts(now));
        List<BookingDepartment> departments = jdbc.query("""
                select distinct d.id, d.name
                from appointment_slot slot
                join department d on d.id = slot.department_id
                where slot.status = 'ACTIVE' and slot.start_at > :now and d.active
                  and d.effective_from <= :now and (d.effective_to is null or d.effective_to > :now)
                order by d.name, d.id
                """, params, (rs, row) -> new BookingDepartment(rs.getObject("id", UUID.class), rs.getString("name")));
        List<BookingService> services = jdbc.query("""
                select distinct s.id, s.name, price.amount, price.currency
                from appointment_slot slot
                join service s on s.id = slot.service_id
                join lateral (
                    select amount, currency from service_price
                    where service_id = s.id and effective_from <= :now
                      and (effective_to is null or effective_to > :now)
                    order by effective_from desc, id desc limit 1
                ) price on true
                where slot.status = 'ACTIVE' and slot.start_at > :now and s.active
                order by s.name, s.id
                """, params, (rs, row) -> new BookingService(rs.getObject("id", UUID.class), rs.getString("name"),
                rs.getBigDecimal("amount"), rs.getString("currency")));
        return new BookingCatalog(departments, services);
    }

    @Override
    public RescheduleCatalog rescheduleCatalog(Instant now) {
        MapSqlParameterSource params = new MapSqlParameterSource("now", ts(now));
        List<BookingDepartment> departments = jdbc.query("""
                select distinct d.id, d.name
                from appointment_slot slot
                join department d on d.id = slot.department_id
                where slot.status = 'ACTIVE' and slot.start_at > :now and d.active
                  and d.effective_from <= :now and (d.effective_to is null or d.effective_to > :now)
                order by d.name, d.id
                """, params, (rs, row) -> new BookingDepartment(rs.getObject("id", UUID.class), rs.getString("name")));
        List<BookingRoom> rooms = jdbc.query("""
                select distinct r.id, r.name,
                    array(select department_id from room_department where room_id = r.id order by department_id) as department_ids,
                    array(select service_id from room_service where room_id = r.id order by service_id) as service_ids
                from appointment_slot slot
                join room r on r.id = slot.room_id
                join department d on d.id = slot.department_id
                where slot.status = 'ACTIVE' and slot.start_at > :now and r.active and d.active
                  and d.effective_from <= :now and (d.effective_to is null or d.effective_to > :now)
                order by r.name, r.id
                """, params, this::bookingRoom);
        List<BookingService> services = jdbc.query("""
                select distinct s.id, s.name, price.amount, price.currency
                from appointment_slot slot
                join service s on s.id = slot.service_id
                join lateral (
                    select amount, currency from service_price
                    where service_id = s.id and effective_from <= :now
                      and (effective_to is null or effective_to > :now)
                    order by effective_from desc, id desc limit 1
                ) price on true
                where slot.status = 'ACTIVE' and slot.start_at > :now and s.active
                order by s.name, s.id
                """, params, (rs, row) -> new BookingService(rs.getObject("id", UUID.class), rs.getString("name"),
                rs.getBigDecimal("amount"), rs.getString("currency")));
        List<BookingPractitioner> practitioners = jdbc.query("""
                select distinct p.id, p.full_name
                from appointment_slot slot
                join practitioner_role role on role.id = slot.practitioner_role_id
                join practitioner p on p.id = role.practitioner_id
                where slot.status = 'ACTIVE' and slot.start_at > :now and p.active and role.status = 'ACTIVE'
                  and role.effective_from <= :now and (role.effective_to is null or role.effective_to > :now)
                order by p.full_name, p.id
                """, params, (rs, row) -> new BookingPractitioner(rs.getObject("id", UUID.class), rs.getString("full_name")));
        List<BookingPractitionerRole> practitionerRoles = jdbc.query("""
                select distinct role.id, role.practitioner_id, role.role_code
                from appointment_slot slot
                join practitioner_role role on role.id = slot.practitioner_role_id
                join practitioner p on p.id = role.practitioner_id
                where slot.status = 'ACTIVE' and slot.start_at > :now and p.active and role.status = 'ACTIVE'
                  and role.effective_from <= :now and (role.effective_to is null or role.effective_to > :now)
                order by role.id
                """, params, (rs, row) -> new BookingPractitionerRole(rs.getObject("id", UUID.class),
                rs.getObject("practitioner_id", UUID.class), rs.getString("role_code")));
        return new RescheduleCatalog(departments, rooms, services, practitioners, practitionerRoles);
    }

    @Override
    public WorkScheduleCatalog workScheduleCatalog(Instant now) {
        MapSqlParameterSource params = new MapSqlParameterSource("now", ts(now));
        List<BookingDepartment> departments = jdbc.query("""
                select d.id, d.name
                from department d
                where d.active and d.effective_from <= :now and (d.effective_to is null or d.effective_to > :now)
                order by d.name, d.id
                """, params, (rs, row) -> new BookingDepartment(rs.getObject("id", UUID.class), rs.getString("name")));
        List<BookingRoom> rooms = jdbc.query("""
                select r.id, r.name,
                    array_agg(distinct rd.department_id order by rd.department_id) as department_ids,
                    array_agg(distinct rs.service_id order by rs.service_id) as service_ids
                from room r
                join room_department rd on rd.room_id = r.id
                join department d on d.id = rd.department_id
                join room_service rs on rs.room_id = r.id
                where r.active and d.active and d.effective_from <= :now
                  and (d.effective_to is null or d.effective_to > :now)
                group by r.id, r.name
                order by r.name, r.id
                """, params, this::bookingRoom);
        List<BookingService> services = jdbc.query("""
                select s.id, s.name, price.amount, price.currency
                from service s
                join lateral (
                    select amount, currency from service_price
                    where service_id = s.id and effective_from <= :now
                      and (effective_to is null or effective_to > :now)
                    order by effective_from desc, id desc limit 1
                ) price on true
                where s.active
                order by s.name, s.id
                """, params, (rs, row) -> new BookingService(rs.getObject("id", UUID.class), rs.getString("name"),
                rs.getBigDecimal("amount"), rs.getString("currency")));
        return new WorkScheduleCatalog(departments, rooms, services);
    }

    @Override
    public boolean isWorkScheduleConfigurationAvailable(
            UUID practitionerRoleId,
            UUID departmentId,
            UUID roomId,
            UUID serviceId,
            Instant now) {
        return count("""
                select count(*)
                from practitioner_role role
                join practitioner practitioner on practitioner.id = role.practitioner_id
                join department department on department.id = :departmentId
                join room room on room.id = :roomId
                join room_department room_department on room_department.room_id = room.id
                    and room_department.department_id = department.id
                join room_service room_service on room_service.room_id = room.id
                    and room_service.service_id = :serviceId
                join service service on service.id = :serviceId
                where role.id = :practitionerRoleId
                  and role.department_id = department.id
                  and role.status = 'ACTIVE'
                  and role.effective_from <= :now
                  and (role.effective_to is null or role.effective_to > :now)
                  and practitioner.active
                  and department.active
                  and department.effective_from <= :now
                  and (department.effective_to is null or department.effective_to > :now)
                  and room.active
                  and service.active
                  and exists (
                      select 1 from service_price price
                      where price.service_id = service.id
                        and price.currency = 'VND'
                        and price.effective_from <= :now
                        and (price.effective_to is null or price.effective_to > :now)
                  )
                """, new MapSqlParameterSource()
                .addValue("practitionerRoleId", practitionerRoleId)
                .addValue("departmentId", departmentId)
                .addValue("roomId", roomId)
                .addValue("serviceId", serviceId)
                .addValue("now", ts(now))) == 1;
    }

    @Override
    public Optional<BookingSessionRow> activeBookingSessionByBucketForUpdate(
            UUID departmentId, UUID serviceId, LocalDate localDate, String session) {
        return queryOne("""
                select * from booking_session
                where department_id = :departmentId and service_id = :serviceId and local_date = :localDate
                  and session = :session and status = 'ACTIVE'
                for update
                """, new MapSqlParameterSource()
                .addValue("departmentId", departmentId)
                .addValue("serviceId", serviceId)
                .addValue("localDate", localDate)
                .addValue("session", session), this::mapBookingSession);
    }

    @Override
    public void insertBookingSession(BookingSessionRow row) {
        jdbc.update("""
                insert into booking_session(id, department_id, service_id, local_date, session, start_at, end_at,
                    status, version, created_at, updated_at)
                values (:id, :departmentId, :serviceId, :localDate, :session, :startAt, :endAt,
                    :status, :version, :createdAt, :updatedAt)
                """, bookingSessionParams(row));
    }

    @Override
    public Optional<BookingSessionRow> bookingSessionById(UUID id) {
        return queryOne("select * from booking_session where id = :id", new MapSqlParameterSource("id", id), this::mapBookingSession);
    }

    @Override
    public Optional<BookingSessionRow> activeBookingSessionByIdForUpdate(UUID id) {
        return queryOne("select * from booking_session where id = :id and status = 'ACTIVE' for update",
                new MapSqlParameterSource("id", id), this::mapBookingSession);
    }

    @Override
    public void insertWorkSchedule(WorkScheduleRow row) {
        jdbc.update("""
                insert into work_schedule(id, booking_session_id, practitioner_role_id, room_id, capacity,
                    status, version, created_at, updated_at)
                values (:id, :bookingSessionId, :practitionerRoleId, :roomId, :capacity,
                    :status, :version, :createdAt, :updatedAt)
                """, workScheduleParams(row));
    }

    @Override
    public void linkAppointmentSlotToWorkSchedule(UUID slotId, UUID workScheduleId) {
        int rows = jdbc.update("update appointment_slot set work_schedule_id = :workScheduleId where id = :slotId",
                new MapSqlParameterSource("slotId", slotId).addValue("workScheduleId", workScheduleId));
        if (rows != 1) throw new IllegalStateException("Work schedule slot cannot be linked");
    }

    @Override
    public void updateWorkSchedule(WorkScheduleRow row, long expectedVersion) {
        int rows = jdbc.update("""
                update work_schedule set
                    booking_session_id = :bookingSessionId,
                    practitioner_role_id = :practitionerRoleId,
                    room_id = :roomId,
                    capacity = :capacity,
                    status = :status,
                    version = :version,
                    updated_at = :updatedAt
                where id = :id and version = :expectedVersion
                """, workScheduleParams(row).addValue("expectedVersion", expectedVersion));
        if (rows == 0) throw new StaleVersionException();
    }

    @Override
    public Optional<WorkScheduleRow> workScheduleById(UUID id, Instant now) {
        return queryOne(workScheduleProjection() + " where ws.id = :id",
                new MapSqlParameterSource("id", id).addValue("now", ts(now)), this::mapWorkSchedule);
    }

    @Override
    public Optional<WorkScheduleRow> workScheduleByIdForUpdate(UUID id, Instant now) {
        return queryOne(workScheduleProjection() + " where ws.id = :id for update",
                new MapSqlParameterSource("id", id).addValue("now", ts(now)), this::mapWorkSchedule);
    }

    @Override
    public List<WorkScheduleRow> searchWorkSchedules(LocalDate fromDate, LocalDate toDate, int limit, int offset, Instant now) {
        return jdbc.query(workScheduleProjection() + """
                where (:fromDate is null or bs.local_date >= :fromDate)
                  and (:toDate is null or bs.local_date <= :toDate)
                order by bs.local_date asc, bs.session asc, ws.id asc
                limit :limit offset :offset
                """, new MapSqlParameterSource()
                .addValue("fromDate", fromDate)
                .addValue("toDate", toDate)
                .addValue("now", ts(now))
                .addValue("limit", limit)
                .addValue("offset", offset), this::mapWorkSchedule);
    }

    @Override
    public List<BookingSessionAvailabilityProjection> searchBookingSessionAvailability(
            UUID patientId, UUID departmentId, UUID serviceId, LocalDate localDate, String session,
            Instant now, int limit, int offset) {
        return jdbc.query("""
                select bs.id, bs.version, bs.department_id, bs.service_id, bs.local_date, bs.session, bs.start_at, bs.end_at,
                    coalesce(sum(case when ws.status = 'ACTIVE' and slot.status = 'ACTIVE'
                          and practitioner.active and role.status = 'ACTIVE'
                          and role.effective_from <= :now and (role.effective_to is null or role.effective_to > :now)
                          and department.active and department.effective_from <= :now
                          and (department.effective_to is null or department.effective_to > :now)
                          and room.active and room_department.room_id is not null and room_service.room_id is not null
                          and service.active and price.service_id is not null
                        then slot.capacity else 0 end), 0)::integer as total_capacity,
                    coalesce(sum(case when ws.status = 'ACTIVE' and slot.status = 'ACTIVE'
                          and practitioner.active and role.status = 'ACTIVE'
                          and role.effective_from <= :now and (role.effective_to is null or role.effective_to > :now)
                          and department.active and department.effective_from <= :now
                          and (department.effective_to is null or department.effective_to > :now)
                          and room.active and room_department.room_id is not null and room_service.room_id is not null
                          and service.active and price.service_id is not null
                        then (select count(*) from slot_hold h where h.slot_id = slot.id and h.status = 'ACTIVE' and h.expires_at > :now)
                           + (select count(*) from appointment a where a.slot_id = slot.id and a.status in ('CONFIRMED', 'FULFILLED'))
                        else 0 end), 0)::integer as reserved_capacity,
                    case
                      when bs.start_at <= :now then 'SLOT_PAST'
                      when exists (
                        select 1 from slot_hold h join appointment_slot s on s.id = h.slot_id
                        where h.patient_id = :patientId and h.status = 'ACTIVE' and h.expires_at > :now
                          and s.start_at < bs.end_at and s.end_at > bs.start_at
                      ) then 'PATIENT_TIME_CONFLICT'
                      when exists (
                        select 1 from appointment a join appointment_slot s on s.id = a.slot_id
                        where a.patient_id = :patientId and a.status in ('CONFIRMED', 'FULFILLED')
                          and s.start_at < bs.end_at and s.end_at > bs.start_at
                      ) then 'PATIENT_TIME_CONFLICT'
                      else null
                    end as disabled_reason
                from booking_session bs
                left join work_schedule ws on ws.booking_session_id = bs.id
                left join appointment_slot slot on slot.work_schedule_id = ws.id
                left join practitioner_role role on role.id = ws.practitioner_role_id
                left join practitioner practitioner on practitioner.id = role.practitioner_id
                left join room room on room.id = ws.room_id
                left join room_department room_department on room_department.room_id = room.id
                    and room_department.department_id = bs.department_id
                left join room_service room_service on room_service.room_id = room.id
                    and room_service.service_id = bs.service_id
                left join department department on department.id = bs.department_id
                left join service service on service.id = bs.service_id
                left join lateral (
                    select service_id from service_price
                    where service_id = bs.service_id and currency = 'VND' and effective_from <= :now
                      and (effective_to is null or effective_to > :now)
                    order by effective_from desc, id desc limit 1
                ) price on true
                where bs.status = 'ACTIVE'
                  and (cast(:departmentId as uuid) is null or bs.department_id = cast(:departmentId as uuid))
                  and (cast(:serviceId as uuid) is null or bs.service_id = cast(:serviceId as uuid))
                  and (cast(:localDate as date) is null or bs.local_date = cast(:localDate as date))
                  and (cast(:session as text) is null or bs.session = cast(:session as text))
                group by bs.id
                order by bs.start_at asc, bs.id asc
                limit :limit offset :offset
                """, new MapSqlParameterSource()
                .addValue("patientId", patientId)
                .addValue("departmentId", departmentId)
                .addValue("serviceId", serviceId)
                .addValue("localDate", localDate)
                .addValue("session", session)
                .addValue("now", ts(now))
                .addValue("limit", limit)
                .addValue("offset", offset), this::mapBookingSessionAvailability);
    }

    @Override
    public List<WorkScheduleCandidate> workScheduleCandidatesForBookingSession(UUID bookingSessionId, Instant now) {
        return jdbc.query("""
                select ws.id as work_schedule_id, ws.booking_session_id, ws.practitioner_role_id, ws.room_id,
                    bs.local_date, bs.session as booking_session_session,
                    ws.capacity as work_schedule_capacity, ws.status as work_schedule_status,
                    ws.version as work_schedule_version, ws.created_at as work_schedule_created_at,
                    ws.updated_at as work_schedule_updated_at, slot.id as slot_id, slot.department_id, slot.service_id,
                    slot.session as slot_session, slot.start_at, slot.end_at, slot.capacity as slot_capacity,
                    slot.status as slot_status, slot.version as slot_version, slot.created_at as slot_created_at,
                    slot.updated_at as slot_updated_at, p.full_name as practitioner_name, r.name as room_name,
                    (select count(*) from slot_hold h where h.slot_id = slot.id and h.status = 'ACTIVE' and h.expires_at > :now)
                    + (select count(*) from appointment a where a.slot_id = slot.id and a.status in ('CONFIRMED', 'FULFILLED')) as reserved_capacity
                from work_schedule ws
                join booking_session bs on bs.id = ws.booking_session_id
                join appointment_slot slot on slot.work_schedule_id = ws.id
                join practitioner_role role on role.id = ws.practitioner_role_id
                join practitioner p on p.id = role.practitioner_id
                join room r on r.id = ws.room_id
                join room_department rd on rd.room_id = r.id and rd.department_id = bs.department_id
                join room_service room_service on room_service.room_id = r.id and room_service.service_id = bs.service_id
                join department d on d.id = bs.department_id
                join service service on service.id = bs.service_id
                join lateral (
                    select service_id from service_price
                    where service_id = bs.service_id and currency = 'VND' and effective_from <= :now
                      and (effective_to is null or effective_to > :now)
                    order by effective_from desc, id desc limit 1
                ) price on true
                where ws.booking_session_id = :bookingSessionId and ws.status = 'ACTIVE'
                  and slot.status = 'ACTIVE' and slot.start_at > :now
                  and p.active and role.status = 'ACTIVE'
                  and role.effective_from <= :now and (role.effective_to is null or role.effective_to > :now)
                  and d.active and d.effective_from <= :now and (d.effective_to is null or d.effective_to > :now)
                  and r.active and service.active
                order by slot.id asc
                for update of ws, slot
                """, new MapSqlParameterSource("bookingSessionId", bookingSessionId).addValue("now", ts(now)),
                this::mapWorkScheduleCandidate);
    }

    @Override
    public void lockPractitionerDay(UUID practitionerRoleId, String dateIso) {
        jdbc.queryForObject("select 1 from pg_advisory_xact_lock(hashtextextended(cast(:scope as text), 0))",
                new MapSqlParameterSource("scope", practitionerRoleId + ":" + dateIso), Integer.class);
    }

    @Override
    public void lockBookingSessionBucket(UUID departmentId, UUID serviceId, LocalDate localDate, String session) {
        jdbc.queryForObject("select 1 from pg_advisory_xact_lock(hashtextextended(cast(:scope as text), 0))",
                new MapSqlParameterSource("scope", departmentId + ":" + serviceId + ":" + localDate + ":" + session),
                Integer.class);
    }

    @Override
    public void lockPatientSchedule(UUID patientId) {
        jdbc.queryForObject("select 1 from pg_advisory_xact_lock(hashtextextended(cast(:patientId as text), 0))",
                new MapSqlParameterSource("patientId", patientId.toString()), Integer.class);
    }

    @Override
    public boolean hasPatientScheduleConflict(
            UUID patientId,
            Instant startAt,
            Instant endAt,
            Instant now,
            UUID excludedAppointmentId,
            UUID excludedSlotHoldId) {
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("patientId", patientId, Types.OTHER)
                .addValue("startAt", ts(startAt))
                .addValue("endAt", ts(endAt))
                .addValue("now", ts(now));

        StringBuilder sql = new StringBuilder("""
                select (
                    select count(*)
                    from slot_hold hold
                    join appointment_slot slot on slot.id = hold.slot_id
                    where hold.patient_id = :patientId
                      and hold.status = 'ACTIVE'
                      and hold.expires_at > :now
                      and slot.start_at < :endAt
                      and slot.end_at > :startAt
                """);
        if (excludedSlotHoldId != null) {
            sql.append("      and hold.id <> :excludedSlotHoldId\n");
            params.addValue("excludedSlotHoldId", excludedSlotHoldId, Types.OTHER);
        }
        sql.append("""
                ) + (
                    select count(*)
                    from appointment appointment
                    join appointment_slot slot on slot.id = appointment.slot_id
                    where appointment.patient_id = :patientId
                      and appointment.status in ('CONFIRMED', 'FULFILLED')
                      and slot.start_at < :endAt
                      and slot.end_at > :startAt
                """);
        if (excludedAppointmentId != null) {
            sql.append("      and appointment.id <> :excludedAppointmentId\n");
            params.addValue("excludedAppointmentId", excludedAppointmentId, Types.OTHER);
        }
        sql.append(")");
        return count(sql.toString(), params) > 0;
    }

    @Override
    public boolean hasPatientSlotReservation(
            UUID patientId,
            UUID slotId,
            Instant now,
            UUID excludedAppointmentId,
            UUID excludedSlotHoldId) {
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("patientId", patientId, Types.OTHER)
                .addValue("slotId", slotId, Types.OTHER)
                .addValue("now", ts(now));

        StringBuilder sql = new StringBuilder("""
                select (
                    select count(*) from slot_hold
                    where patient_id = :patientId
                      and slot_id = :slotId
                      and status = 'ACTIVE'
                      and expires_at > :now
                """);
        if (excludedSlotHoldId != null) {
            sql.append("      and id <> :excludedSlotHoldId\n");
            params.addValue("excludedSlotHoldId", excludedSlotHoldId, Types.OTHER);
        }
        sql.append("""
                ) + (
                    select count(*) from appointment
                    where patient_id = :patientId
                      and slot_id = :slotId
                      and status in ('CONFIRMED', 'FULFILLED')
                """);
        if (excludedAppointmentId != null) {
            sql.append("      and id <> :excludedAppointmentId\n");
            params.addValue("excludedAppointmentId", excludedAppointmentId, Types.OTHER);
        }
        sql.append(")");
        return count(sql.toString(), params) > 0;
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
    public List<vn.medicore.dto.SchedulingModels.AppointmentRow> searchAppointments(List<UUID> patientIds, int limit, int offset) {
        if (patientIds == null || patientIds.isEmpty()) {
            return jdbc.query("select * from appointment order by created_at desc limit :limit offset :offset",
                    new MapSqlParameterSource().addValue("limit", limit).addValue("offset", offset),
                    this::mapAppointment);
        }
        return jdbc.query("select * from appointment where patient_id in (:patientIds) order by created_at desc limit :limit offset :offset",
                new MapSqlParameterSource().addValue("patientIds", patientIds).addValue("limit", limit).addValue("offset", offset),
                this::mapAppointment);
    }

    private static final String PATIENT_APPOINTMENT_PROJECTION_BASE_SQL = """
            select
                a.id, a.version, a.patient_id, a.slot_id, a.status, a.rescheduled_from_id, a.rescheduled_to_id,
                a.created_at, a.updated_at,
                d.name as department_name, r.name as room_name, srv.name as service_name,
                p.full_name as practitioner_name, pr.role_code as practitioner_role_code,
                s.start_at, s.end_at, s.session,
                coalesce(h.deposit_amount, 0.00) as required_deposit_amount,
                coalesce(h.currency, 'VND') as currency,
                coalesce(da.paid_amount, 0.00) as paid_deposit_amount,
                da.alloc_status,
                pi.status as payment_intent_status
            from appointment a
            join appointment_slot s on a.slot_id = s.id
            left join slot_hold h on a.slot_hold_id = h.id
            left join department d on s.department_id = d.id
            left join room r on s.room_id = r.id
            left join service srv on s.service_id = srv.id
            left join practitioner_role pr on s.practitioner_role_id = pr.id
            left join practitioner p on pr.practitioner_id = p.id
            left join (
                select
                    appointment_id,
                    sum(case when status in ('ACTIVE', 'REFUND_PENDING', 'TRANSFERRED') then amount else 0 end) as paid_amount,
                    max(status) as alloc_status
                from deposit_allocation
                group by appointment_id
            ) da on a.id = da.appointment_id
            left join lateral (
                select status from payment_intent
                where (h.id is not null and slot_hold_id = h.id)
                order by created_at desc limit 1
            ) pi on true
            """;

    @Override
    public List<vn.medicore.dto.SchedulingModels.PatientAppointment> searchPatientAppointments(List<UUID> patientIds, Instant now, int limit, int offset) {
        if (patientIds == null || patientIds.isEmpty()) {
            return jdbc.query(PATIENT_APPOINTMENT_PROJECTION_BASE_SQL + " order by a.created_at desc limit :limit offset :offset",
                    new MapSqlParameterSource().addValue("limit", limit).addValue("offset", offset),
                    (rs, rowNum) -> mapPatientAppointment(rs, now));
        }
        return jdbc.query(PATIENT_APPOINTMENT_PROJECTION_BASE_SQL + " where a.patient_id in (:patientIds) order by a.created_at desc limit :limit offset :offset",
                new MapSqlParameterSource().addValue("patientIds", patientIds).addValue("limit", limit).addValue("offset", offset),
                (rs, rowNum) -> mapPatientAppointment(rs, now));
    }

    @Override
    public Optional<vn.medicore.dto.SchedulingModels.PatientAppointment> patientAppointmentById(UUID id, Instant now) {
        return queryOne(PATIENT_APPOINTMENT_PROJECTION_BASE_SQL + " where a.id = :id",
                new MapSqlParameterSource("id", id),
                (rs, rowNum) -> mapPatientAppointment(rs, now));
    }

    private vn.medicore.dto.SchedulingModels.PatientAppointment mapPatientAppointment(ResultSet rs, Instant now) throws SQLException {
        UUID id = rs.getObject("id", UUID.class);
        long version = rs.getLong("version");
        UUID patientId = rs.getObject("patient_id", UUID.class);
        UUID slotId = rs.getObject("slot_id", UUID.class);
        String status = rs.getString("status");
        String departmentName = rs.getString("department_name");
        String roomName = rs.getString("room_name");
        String serviceName = rs.getString("service_name");
        String practitionerName = rs.getString("practitioner_name");
        String practitionerRoleCode = rs.getString("practitioner_role_code");
        Instant startAt = instant(rs, "start_at");
        Instant endAt = instant(rs, "end_at");
        String session = rs.getString("session");

        BigDecimal requiredDeposit = rs.getBigDecimal("required_deposit_amount");
        if (requiredDeposit == null) requiredDeposit = BigDecimal.ZERO;
        BigDecimal paidDeposit = rs.getBigDecimal("paid_deposit_amount");
        if (paidDeposit == null) paidDeposit = BigDecimal.ZERO;
        String currency = rs.getString("currency");
        if (currency == null || currency.isBlank()) currency = "VND";

        String allocStatus = rs.getString("alloc_status");
        String piStatus = rs.getString("payment_intent_status");

        Instant createdAt = instant(rs, "created_at");
        Instant updatedAt = instant(rs, "updated_at");
        UUID rescheduledFromId = rs.getObject("rescheduled_from_id", UUID.class);
        UUID rescheduledToId = rs.getObject("rescheduled_to_id", UUID.class);

        Instant cutoff = startAt.minus(java.time.Duration.ofHours(24));
        boolean isBeforeCutoff = now.isBefore(cutoff);
        boolean isConfirmed = "CONFIRMED".equals(status);

        boolean canCancel;
        String cancelDisabledReason;
        if (!isConfirmed) {
            canCancel = false;
            cancelDisabledReason = "APPOINTMENT_" + status;
        } else if (!isBeforeCutoff) {
            canCancel = false;
            cancelDisabledReason = "SELF_SERVICE_CANCEL_WINDOW_CLOSED";
        } else {
            canCancel = true;
            cancelDisabledReason = null;
        }

        boolean canReschedule;
        String rescheduleDisabledReason;
        if (!isConfirmed) {
            canReschedule = false;
            rescheduleDisabledReason = "APPOINTMENT_" + status;
        } else if (!isBeforeCutoff) {
            canReschedule = false;
            rescheduleDisabledReason = "SELF_SERVICE_RESCHEDULE_WINDOW_CLOSED";
        } else {
            canReschedule = true;
            rescheduleDisabledReason = null;
        }

        String cancellationOutcome = null;
        if ("CANCELLED".equals(status)) {
            if (requiredDeposit.compareTo(BigDecimal.ZERO) == 0) {
                cancellationOutcome = "NOT_REQUIRED";
            } else {
                cancellationOutcome = "REFUND_PENDING";
            }
        }

        String depositState;
        if (requiredDeposit.compareTo(BigDecimal.ZERO) == 0) {
            depositState = "NOT_REQUIRED";
        } else if ("REFUND_PENDING".equals(allocStatus) || ("CANCELLED".equals(status) && paidDeposit.compareTo(BigDecimal.ZERO) > 0)) {
            depositState = "REFUND_PENDING";
        } else if ("RECONCILIATION_REQUIRED".equals(piStatus)) {
            depositState = "RECONCILIATION_REQUIRED";
        } else if (paidDeposit.compareTo(BigDecimal.ZERO) > 0) {
            depositState = "VERIFIED";
        } else {
            depositState = "RECONCILIATION_REQUIRED";
        }

        String requiredDepositStr = requiredDeposit.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString();
        String paidDepositStr = paidDeposit.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString();

        return new vn.medicore.dto.SchedulingModels.PatientAppointment(
                id, version, patientId, slotId, status,
                departmentName, roomName, serviceName, practitionerName, practitionerRoleCode,
                startAt, endAt, session,
                requiredDepositStr, paidDepositStr, currency, depositState,
                canCancel, cancelDisabledReason, canReschedule, rescheduleDisabledReason,
                cancellationOutcome, cutoff,
                rescheduledFromId, rescheduledToId, createdAt, updatedAt
        );
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
    public List<vn.medicore.dto.PaymentModels.DepositAllocationRow> activeDepositAllocationsByAppointmentIdForUpdate(UUID appointmentId) {
        return jdbc.query("""
                select * from deposit_allocation
                where appointment_id = :appointmentId and status = 'ACTIVE'
                order by id
                for update
                """, new MapSqlParameterSource("appointmentId", appointmentId), this::mapDepositAllocation);
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
    public void insertDepositTransferLeg(vn.medicore.dto.PaymentModels.DepositTransferLegRow row) {
        jdbc.update("""
                insert into deposit_transfer_leg (
                    id, deposit_transfer_id, source_allocation_id, target_allocation_id,
                    amount, currency, created_at
                ) values (
                    :id, :depositTransferId, :sourceAllocationId, :targetAllocationId,
                    :amount, :currency, :createdAt
                )
                """, new MapSqlParameterSource()
                .addValue("id", row.id())
                .addValue("depositTransferId", row.depositTransferId())
                .addValue("sourceAllocationId", row.sourceAllocationId())
                .addValue("targetAllocationId", row.targetAllocationId())
                .addValue("amount", row.amount())
                .addValue("currency", row.currency())
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

    private static String workScheduleProjection() {
        return """
                select ws.id, ws.booking_session_id, ws.practitioner_role_id, ws.room_id, ws.capacity, ws.status,
                    ws.version, ws.created_at, ws.updated_at, slot.id as slot_id,
                    bs.department_id, bs.service_id, bs.local_date, bs.session,
                    coalesce((select count(*) from slot_hold h where h.slot_id = slot.id and h.status = 'ACTIVE' and h.expires_at > :now)
                      + (select count(*) from appointment a where a.slot_id = slot.id and a.status in ('CONFIRMED', 'FULFILLED')), 0)::integer as reserved_capacity
                from work_schedule ws
                join appointment_slot slot on slot.work_schedule_id = ws.id
                join booking_session bs on bs.id = ws.booking_session_id
                """;
    }

    private static MapSqlParameterSource bookingSessionParams(BookingSessionRow row) {
        return new MapSqlParameterSource().addValue("id", row.id()).addValue("departmentId", row.departmentId())
                .addValue("serviceId", row.serviceId()).addValue("localDate", row.localDate()).addValue("session", row.session())
                .addValue("startAt", ts(row.startAt())).addValue("endAt", ts(row.endAt())).addValue("status", row.status())
                .addValue("version", row.version()).addValue("createdAt", ts(row.createdAt())).addValue("updatedAt", ts(row.updatedAt()));
    }

    private static MapSqlParameterSource workScheduleParams(WorkScheduleRow row) {
        return new MapSqlParameterSource().addValue("id", row.id()).addValue("bookingSessionId", row.bookingSessionId())
                .addValue("practitionerRoleId", row.practitionerRoleId()).addValue("roomId", row.roomId())
                .addValue("capacity", row.capacity()).addValue("status", row.status()).addValue("version", row.version())
                .addValue("createdAt", ts(row.createdAt())).addValue("updatedAt", ts(row.updatedAt()));
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

    private BookingRoom bookingRoom(ResultSet rs, int rowNum) throws SQLException {
        return new BookingRoom(rs.getObject("id", UUID.class), uuidList(rs, "department_ids"),
                uuidList(rs, "service_ids"), rs.getString("name"));
    }

    private static List<UUID> uuidList(ResultSet rs, String column) throws SQLException {
        java.sql.Array array = rs.getArray(column);
        if (array == null) return List.of();
        try {
            Object[] values = (Object[]) array.getArray();
            return java.util.Arrays.stream(values).map(UUID.class::cast).toList();
        } finally {
            array.free();
        }
    }

    private BookingSessionRow mapBookingSession(ResultSet rs, int rowNum) throws SQLException {
        return new BookingSessionRow(rs.getObject("id", UUID.class), rs.getObject("department_id", UUID.class),
                rs.getObject("service_id", UUID.class), rs.getObject("local_date", LocalDate.class), rs.getString("session"),
                instant(rs, "start_at"), instant(rs, "end_at"), rs.getString("status"), rs.getLong("version"),
                instant(rs, "created_at"), instant(rs, "updated_at"));
    }

    private WorkScheduleRow mapWorkSchedule(ResultSet rs, int rowNum) throws SQLException {
        int reserved = rs.getInt("reserved_capacity");
        int capacity = rs.getInt("capacity");
        return new WorkScheduleRow(rs.getObject("id", UUID.class), rs.getObject("booking_session_id", UUID.class),
                rs.getObject("practitioner_role_id", UUID.class), rs.getObject("room_id", UUID.class), capacity,
                rs.getString("status"), rs.getLong("version"), instant(rs, "created_at"), instant(rs, "updated_at"),
                rs.getObject("slot_id", UUID.class), reserved, Math.max(0, capacity - reserved),
                rs.getObject("department_id", UUID.class), rs.getObject("service_id", UUID.class),
                rs.getObject("local_date", LocalDate.class), rs.getString("session"));
    }

    private BookingSessionAvailabilityProjection mapBookingSessionAvailability(ResultSet rs, int rowNum) throws SQLException {
        return new BookingSessionAvailabilityProjection(rs.getObject("id", UUID.class), rs.getLong("version"),
                rs.getObject("department_id", UUID.class), rs.getObject("service_id", UUID.class),
                rs.getObject("local_date", LocalDate.class), rs.getString("session"), instant(rs, "start_at"), instant(rs, "end_at"),
                rs.getInt("total_capacity"), rs.getInt("reserved_capacity"), rs.getString("disabled_reason"));
    }

    private WorkScheduleCandidate mapWorkScheduleCandidate(ResultSet rs, int rowNum) throws SQLException {
        WorkScheduleRow schedule = new WorkScheduleRow(
                rs.getObject("work_schedule_id", UUID.class), rs.getObject("booking_session_id", UUID.class),
                rs.getObject("practitioner_role_id", UUID.class), rs.getObject("room_id", UUID.class),
                rs.getInt("work_schedule_capacity"), rs.getString("work_schedule_status"), rs.getLong("work_schedule_version"),
                instant(rs, "work_schedule_created_at"), instant(rs, "work_schedule_updated_at"),
                rs.getObject("slot_id", UUID.class), rs.getInt("reserved_capacity"),
                Math.max(0, rs.getInt("work_schedule_capacity") - rs.getInt("reserved_capacity")),
                rs.getObject("department_id", UUID.class), rs.getObject("service_id", UUID.class),
                rs.getObject("local_date", LocalDate.class), rs.getString("slot_session"));
        AppointmentSlotRow slot = new AppointmentSlotRow(rs.getObject("slot_id", UUID.class),
                rs.getObject("practitioner_role_id", UUID.class), rs.getObject("department_id", UUID.class),
                rs.getObject("room_id", UUID.class), rs.getObject("service_id", UUID.class), rs.getString("slot_session"),
                instant(rs, "start_at"), instant(rs, "end_at"), rs.getInt("slot_capacity"), rs.getString("slot_status"),
                rs.getLong("slot_version"), instant(rs, "slot_created_at"), instant(rs, "slot_updated_at"));
        return new WorkScheduleCandidate(schedule, slot, rs.getInt("reserved_capacity"),
                rs.getString("practitioner_name"), rs.getString("room_name"));
    }

    private AppointmentSlotRow mapAppointmentSlot(ResultSet rs, int rowNum) throws SQLException {
        return new AppointmentSlotRow(rs.getObject("id", UUID.class), rs.getObject("practitioner_role_id", UUID.class),
                rs.getObject("department_id", UUID.class), rs.getObject("room_id", UUID.class), rs.getObject("service_id", UUID.class),
                rs.getString("session"), instant(rs, "start_at"), instant(rs, "end_at"), rs.getInt("capacity"), rs.getString("status"),
                rs.getLong("version"), instant(rs, "created_at"), instant(rs, "updated_at"));
    }

    private BookingAvailabilityProjection mapBookingAvailabilityProjection(ResultSet rs, int rowNum) throws SQLException {
        return new BookingAvailabilityProjection(
                rs.getObject("id", UUID.class),
                rs.getLong("version"),
                rs.getObject("practitioner_role_id", UUID.class),
                rs.getObject("department_id", UUID.class),
                rs.getObject("room_id", UUID.class),
                rs.getObject("service_id", UUID.class),
                rs.getString("session"),
                instant(rs, "start_at"),
                instant(rs, "end_at"),
                rs.getString("disabled_reason"));
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
