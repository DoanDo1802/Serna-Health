package vn.medicore.scheduling;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import vn.medicore.common.utils.UuidV7Generator;
import vn.medicore.dto.SchedulingAuditContext;
import vn.medicore.dto.SchedulingModels.AppointmentSlotRow;
import vn.medicore.dto.SchedulingModels.CreateAppointmentSlotRequest;
import vn.medicore.dto.SchedulingModels.CreateBookingSessionHoldRequest;
import vn.medicore.dto.SchedulingModels.CreateSlotHoldRequest;
import vn.medicore.dto.SchedulingModels.CreateWorkScheduleRequest;
import vn.medicore.dto.SchedulingModels.UpdateWorkScheduleRequest;
import vn.medicore.dto.SchedulingModels.CreateSlotHoldResponse;
import vn.medicore.dto.SchedulingModels.SlotHoldRow;
import vn.medicore.dto.SchedulingModels.WorkScheduleRow;
import vn.medicore.service.SchedulingService;

@Testcontainers
@SpringBootTest
@ActiveProfiles("test")
public class SchedulingIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17.10");

    @Autowired private SchedulingService service;
    @Autowired private UuidV7Generator ids;
    @Autowired private JdbcTemplate jdbc;

    private UUID practitionerRoleId;
    private UUID departmentId;
    private UUID roomId;
    private UUID serviceId;
    private SchedulingAuditContext auditContext;

    @BeforeEach
    void setup() {
        practitionerRoleId = ids.next();
        departmentId = ids.next();
        roomId = ids.next();
        serviceId = ids.next();
        UUID practitionerId = ids.next();
        auditContext = new SchedulingAuditContext(ids.next(), ids.next().toString(), Map.of(), "request", "correlation");

        jdbc.update("insert into department (id, code, name, active, effective_from, created_at, updated_at) values (?, ?, ?, true, now(), now(), now())",
                departmentId, ids.next().toString(), "Cardiology");
        jdbc.update("insert into room (id, department_id, code, name, active, created_at, updated_at) values (?, ?, ?, ?, true, now(), now())",
                roomId, departmentId, ids.next().toString(), "Room 101");
        jdbc.update("insert into service (id, code, name, service_type, active, created_at, updated_at) values (?, ?, ?, 'CONSULTATION', true, now(), now())",
                serviceId, ids.next().toString(), "Consultation");
        jdbc.update("insert into practitioner (id, staff_code, full_name, active, created_at, updated_at) values (?, ?, ?, true, now(), now())",
                practitionerId, ids.next().toString(), "Dr. John Doe");
        jdbc.update("insert into practitioner_role (id, practitioner_id, department_id, role_code, status, effective_from, created_at, updated_at) values (?, ?, ?, ?, 'ACTIVE', now(), now(), now())",
                practitionerRoleId, practitionerId, departmentId, "DOCTOR");
        insertPrice(new BigDecimal("80000.00"));
    }

    @Test
    void SC_R1_BOOK_01_slot_creation_respects_capacity_and_overlap() {
        Instant start = Instant.now().plus(1, ChronoUnit.DAYS);
        AppointmentSlotRow slot = createSlot(start, 2);
        assertThat(slot.status()).isEqualTo("ACTIVE");

        assertThrows(DataIntegrityViolationException.class, () -> service.createAppointmentSlot(
                new CreateAppointmentSlotRequest(practitionerRoleId, departmentId, roomId, serviceId, "MORNING",
                        start.plus(15, ChronoUnit.MINUTES), start.plus(45, ChronoUnit.MINUTES), 1),
                auditContext));
    }

    @Test
    void slotHoldSnapshotsFiveMinuteExpiryAndEffectivePrice() {
        AppointmentSlotRow slot = createSlot(Instant.now().plus(1, ChronoUnit.DAYS), 1);
        UUID patientId = insertPatient("Hold Patient");
        Instant before = Instant.now();

        SlotHoldRow hold = service.createSlotHold(new CreateSlotHoldRequest(slot.id(), patientId), auditContext);

        assertThat(hold.status()).isEqualTo("ACTIVE");
        assertThat(hold.depositAmount()).isEqualByComparingTo("80000.00");
        assertThat(hold.currency()).isEqualTo("VND");
        assertThat(hold.expiresAt()).isBetween(before.plus(299, ChronoUnit.SECONDS), before.plus(301, ChronoUnit.SECONDS));
    }

    @Test
    void slotHoldCapsDepositAtOneHundredThousandVnd() {
        jdbc.update("delete from service_price where service_id = ?", serviceId);
        insertPrice(new BigDecimal("120000.00"));
        AppointmentSlotRow slot = createSlot(Instant.now().plus(1, ChronoUnit.DAYS), 1);

        SlotHoldRow hold = service.createSlotHold(new CreateSlotHoldRequest(slot.id(), insertPatient("High Price Patient")), auditContext);

        assertThat(hold.depositAmount()).isEqualByComparingTo("100000.00");
    }

    @Test
    void releaseAndLazyExpiryUseTerminalLifecycle() {
        AppointmentSlotRow slot = createSlot(Instant.now().plus(1, ChronoUnit.DAYS), 2);
        SlotHoldRow released = service.createSlotHold(new CreateSlotHoldRequest(slot.id(), insertPatient("Release Patient")), auditContext);
        service.cancelSlotHold(released.id(), released.version(), auditContext);
        assertThat(service.getSlotHold(released.id(), auditContext).status()).isEqualTo("RELEASED");

        SlotHoldRow expired = service.createSlotHold(new CreateSlotHoldRequest(slot.id(), insertPatient("Expired Patient")), auditContext);
        jdbc.update("update slot_hold set created_at = now() - interval '10 minutes', expires_at = now() - interval '1 second' where id = ?", expired.id());
        SlotHoldRow value = service.getSlotHold(expired.id(), auditContext);
        assertThat(value.status()).isEqualTo("EXPIRED");
        assertThat(value.version()).isEqualTo(1L);
    }

    @Test
    void confirmedAppointmentConsumesSlotCapacity() {
        AppointmentSlotRow slot = createSlot(Instant.now().plus(1, ChronoUnit.DAYS), 1);
        UUID confirmedPatientId = insertPatient("Confirmed Patient");
        UUID holdId = ids.next();
        jdbc.update("""
                insert into slot_hold (id, slot_id, patient_id, expires_at, deposit_amount, currency, status, version, created_at, updated_at)
                values (?, ?, ?, now() + interval '5 minutes', 80000.00, 'VND', 'CONSUMED', 1, now(), now())
                """, holdId, slot.id(), confirmedPatientId);
        jdbc.update("insert into appointment (id, patient_id, slot_hold_id, slot_id, status, version, created_at, updated_at) values (?, ?, ?, ?, 'CONFIRMED', 0, now(), now())",
                ids.next(), confirmedPatientId, holdId, slot.id());

        IllegalStateException exception = assertThrows(IllegalStateException.class,
                () -> service.createSlotHold(new CreateSlotHoldRequest(slot.id(), insertPatient("Capacity Patient")), auditContext));
        assertThat(exception.getMessage()).isEqualTo("Slot is fully booked");
    }

    @Test
    void confirmedAppointmentPrecedesCapacityForSamePatient() {
        AppointmentSlotRow slot = createSlot(Instant.now().plus(1, ChronoUnit.DAYS), 1);
        UUID patientId = insertPatient("Conflict Patient");
        UUID holdId = ids.next();
        jdbc.update("""
                insert into slot_hold (id, slot_id, patient_id, expires_at, deposit_amount, currency, status, version, created_at, updated_at)
                values (?, ?, ?, now() + interval '5 minutes', 80000.00, 'VND', 'CONSUMED', 1, now(), now())
                """, holdId, slot.id(), patientId);
        jdbc.update("insert into appointment (id, patient_id, slot_hold_id, slot_id, status, version, created_at, updated_at) values (?, ?, ?, ?, 'CONFIRMED', 0, now(), now())",
                ids.next(), patientId, holdId, slot.id());

        assertThrows(vn.medicore.common.exception.PatientScheduleConflictException.class,
                () -> service.createSlotHold(new CreateSlotHoldRequest(slot.id(), patientId), auditContext));
    }

    @Test
    void SC_R1_BOOK_04_finalCapacityRaceCreatesExactlyOneHold() throws Exception {
        AppointmentSlotRow slot = createSlot(Instant.now().plus(1, ChronoUnit.DAYS), 1);
        UUID firstPatientId = insertPatient("Concurrent First");
        UUID secondPatientId = insertPatient("Concurrent Second");
        CyclicBarrier start = new CyclicBarrier(2);
        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            List<Future<Boolean>> results = List.of(
                    executor.submit(createHoldAt(start, slot.id(), firstPatientId, "first")),
                    executor.submit(createHoldAt(start, slot.id(), secondPatientId, "second")));
            int successful = 0;
            for (Future<Boolean> result : results) if (result.get()) successful++;
            assertThat(successful).isEqualTo(1);
        }
        assertThat(jdbc.queryForObject("select count(*) from slot_hold where slot_id = ? and status = 'ACTIVE' and expires_at > now()",
                Integer.class, slot.id())).isEqualTo(1);
    }

    @Test
    void workScheduleMaterializesCanonicalSlotAndReusesBookingSession() {
        LocalDate date = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(10);
        WorkScheduleRow first = createWorkSchedule(date, "MORNING", 2);
        UUID secondRoleId = insertPractitionerRole("Dr. Second");
        UUID secondRoomId = insertRoom("Room 102");
        WorkScheduleRow second = service.createWorkSchedule(new CreateWorkScheduleRequest(
                secondRoleId, departmentId, secondRoomId, serviceId, date, "MORNING", 3), auditContext);

        assertThat(first.bookingSessionId()).isEqualTo(second.bookingSessionId());
        assertThat(first.slotId()).isNotNull();
        assertThat(first.status()).isEqualTo("ACTIVE");
        assertThat(first.remainingCapacity()).isEqualTo(2);
        assertThat(jdbc.queryForObject("select count(*) from booking_session where id = ?", Integer.class, first.bookingSessionId()))
                .isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from work_schedule where booking_session_id = ?", Integer.class,
                first.bookingSessionId())).isEqualTo(2);
        assertThat(jdbc.queryForObject("select work_schedule_id from appointment_slot where id = ?", UUID.class, first.slotId()))
                .isEqualTo(first.id());
        assertThat(jdbc.queryForObject("select start_at from appointment_slot where id = ?", Instant.class, first.slotId()))
                .isEqualTo(date.atTime(8, 0).atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant());
        assertThat(jdbc.queryForObject("select end_at from appointment_slot where id = ?", Instant.class, first.slotId()))
                .isEqualTo(date.atTime(12, 0).atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant());
    }

    @Test
    void workScheduleUpdateAndCancelSynchronizeLinkedSlotLifecycle() {
        WorkScheduleRow created = createWorkSchedule(LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(11), "AFTERNOON", 2);

        WorkScheduleRow updated = service.updateWorkSchedule(
                created.id(), new UpdateWorkScheduleRequest(4), created.version(), auditContext);
        assertThat(updated.capacity()).isEqualTo(4);
        assertThat(updated.version()).isEqualTo(1);
        assertThat(jdbc.queryForObject("select capacity from appointment_slot where id = ?", Integer.class, created.slotId())).isEqualTo(4);
        assertThat(jdbc.queryForObject("select version from appointment_slot where id = ?", Long.class, created.slotId())).isEqualTo(1L);

        service.cancelWorkSchedule(updated.id(), updated.version(), auditContext);
        assertThat(service.getWorkSchedule(updated.id()).status()).isEqualTo("CANCELLED");
        assertThat(jdbc.queryForObject("select status from appointment_slot where id = ?", String.class, created.slotId()))
                .isEqualTo("CANCELLED");
    }

    @Test
    void aggregateHoldAssignsLeastLoadedExactSlotAndProtectsScheduleCancellation() {
        LocalDate date = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(12);
        WorkScheduleRow first = createWorkSchedule(date, "MORNING", 2);
        UUID secondRoleId = insertPractitionerRole("Dr. Assignment");
        UUID secondRoomId = insertRoom("Room 103");
        WorkScheduleRow second = service.createWorkSchedule(new CreateWorkScheduleRequest(
                secondRoleId, departmentId, secondRoomId, serviceId, date, "MORNING", 2), auditContext);
        UUID occupiedPatientId = insertPatient("Occupied");
        service.createSlotHold(new CreateSlotHoldRequest(first.slotId(), occupiedPatientId), auditContext);
        UUID patientId = insertPatient("Aggregate Patient");

        CreateSlotHoldResponse response = service.createBookingSessionHold(
                new CreateBookingSessionHoldRequest(first.bookingSessionId(), patientId), auditContext);

        UUID assignedSlotId = jdbc.queryForObject("select slot_id from slot_hold where id = ?", UUID.class, response.id());
        assertThat(assignedSlotId).isEqualTo(second.slotId());
        assertThat(response.assignment().roomName()).isEqualTo("Room 103");
        assertThat(response.assignment().session()).isEqualTo("MORNING");
        assertThrows(IllegalStateException.class,
                () -> service.cancelWorkSchedule(second.id(), second.version(), auditContext));
    }

    @Test
    void workScheduleRejectsStaleOrUnsafeCapacityChangesAndAllowsExpiredHoldCancellation() {
        WorkScheduleRow created = createWorkSchedule(LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(13), "MORNING", 2);
        UUID firstHoldId = service.createSlotHold(new CreateSlotHoldRequest(created.slotId(), insertPatient("Reserved Capacity One")), auditContext).id();
        UUID secondHoldId = service.createSlotHold(new CreateSlotHoldRequest(created.slotId(), insertPatient("Reserved Capacity Two")), auditContext).id();

        assertThrows(IllegalStateException.class,
                () -> service.updateWorkSchedule(created.id(), new UpdateWorkScheduleRequest(1), created.version(), auditContext));
        WorkScheduleRow updated = service.updateWorkSchedule(
                created.id(), new UpdateWorkScheduleRequest(2), created.version(), auditContext);
        assertThrows(vn.medicore.common.exception.StaleVersionException.class,
                () -> service.updateWorkSchedule(created.id(), new UpdateWorkScheduleRequest(2), created.version(), auditContext));

        jdbc.update("""
                update slot_hold
                set created_at = now() - interval '10 minutes',
                    expires_at = now() - interval '1 second'
                where id in (?, ?)
                """, firstHoldId, secondHoldId);
        service.cancelWorkSchedule(updated.id(), updated.version(), auditContext);
        assertThat(service.getWorkSchedule(updated.id()).status()).isEqualTo("CANCELLED");
        assertThat(jdbc.queryForObject("select count(*) from slot_hold where id in (?, ?) and status = 'EXPIRED'", Integer.class,
                firstHoldId, secondHoldId)).isEqualTo(2);
    }

    @Test
    void aggregateHoldFinalCapacityRaceCreatesExactlyOneHold() throws Exception {
        WorkScheduleRow schedule = createWorkSchedule(LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(14), "AFTERNOON", 1);
        UUID firstPatientId = insertPatient("Aggregate Concurrent First");
        UUID secondPatientId = insertPatient("Aggregate Concurrent Second");
        CyclicBarrier start = new CyclicBarrier(2);
        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            List<Future<Boolean>> results = List.of(
                    executor.submit(createBookingSessionHoldAt(start, schedule.bookingSessionId(), firstPatientId, "aggregate-first")),
                    executor.submit(createBookingSessionHoldAt(start, schedule.bookingSessionId(), secondPatientId, "aggregate-second")));
            int successful = 0;
            for (Future<Boolean> result : results) if (result.get()) successful++;
            assertThat(successful).isEqualTo(1);
        }
        assertThat(jdbc.queryForObject("select count(*) from slot_hold where slot_id = ? and status = 'ACTIVE' and expires_at > now()",
                Integer.class, schedule.slotId())).isEqualTo(1);
    }

    @Test
    void aggregateAvailabilityReflectsSharedCapacityAndInactivePractitioner() {
        LocalDate date = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(13);
        WorkScheduleRow first = createWorkSchedule(date, "MORNING", 2);
        UUID secondRoleId = insertPractitionerRole("Dr. Inactive");
        UUID secondRoomId = insertRoom("Room 104");
        service.createWorkSchedule(new CreateWorkScheduleRequest(
                secondRoleId, departmentId, secondRoomId, serviceId, date, "MORNING", 3), auditContext);
        UUID patientId = insertPatient("Availability Patient");
        service.createSlotHold(new CreateSlotHoldRequest(first.slotId(), insertPatient("Reserved")), auditContext);

        var availability = service.getBookingAvailability(patientId, departmentId, serviceId, date, "MORNING", null, 10).items();
        assertThat(availability).singleElement().satisfies(value -> {
            assertThat(value.totalCapacity()).isEqualTo(5);
            assertThat(value.reservedCapacity()).isEqualTo(1);
            assertThat(value.remainingCapacity()).isEqualTo(4);
            assertThat(value.canCreateHold()).isTrue();
        });

        jdbc.update("update practitioner set active = false where id = (select practitioner_id from practitioner_role where id = ?)", secondRoleId);
        var afterDeactivate = service.getBookingAvailability(patientId, departmentId, serviceId, date, "MORNING", null, 10).items();
        assertThat(afterDeactivate).singleElement().satisfies(value -> {
            assertThat(value.totalCapacity()).isEqualTo(2);
            assertThat(value.reservedCapacity()).isEqualTo(1);
            assertThat(value.remainingCapacity()).isEqualTo(1);
        });
    }

    @Test
    void SC_R1_BOOK_02_practitionerRoleCannotExceedSessionCapacity() {
        LocalDate date = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(14);
        Instant start = date.atTime(8, 0).atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant();
        createSlot(start, 1);
        service.createAppointmentSlot(new CreateAppointmentSlotRequest(
                practitionerRoleId, departmentId, roomId, serviceId, "MORNING", start.plus(60, ChronoUnit.MINUTES),
                start.plus(90, ChronoUnit.MINUTES), 1), auditContext);

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> service.createAppointmentSlot(
                new CreateAppointmentSlotRequest(practitionerRoleId, departmentId, roomId, serviceId, "MORNING",
                        start.plus(120, ChronoUnit.MINUTES), start.plus(150, ChronoUnit.MINUTES), 1), auditContext));
        assertThat(exception.getMessage()).contains("exceed 2 active slots per session");
    }

    private WorkScheduleRow createWorkSchedule(LocalDate date, String session, int capacity) {
        return service.createWorkSchedule(new CreateWorkScheduleRequest(
                practitionerRoleId, departmentId, roomId, serviceId, date, session, capacity), auditContext);
    }

    private UUID insertPractitionerRole(String fullName) {
        UUID practitionerId = ids.next();
        UUID roleId = ids.next();
        jdbc.update("insert into practitioner (id, staff_code, full_name, active, created_at, updated_at) values (?, ?, ?, true, now(), now())",
                practitionerId, ids.next().toString(), fullName);
        jdbc.update("insert into practitioner_role (id, practitioner_id, department_id, role_code, status, effective_from, created_at, updated_at) values (?, ?, ?, 'DOCTOR', 'ACTIVE', now(), now(), now())",
                roleId, practitionerId, departmentId);
        return roleId;
    }

    private UUID insertRoom(String name) {
        UUID value = ids.next();
        jdbc.update("insert into room (id, department_id, code, name, active, created_at, updated_at) values (?, ?, ?, ?, true, now(), now())",
                value, departmentId, ids.next().toString(), name);
        return value;
    }

    private Callable<Boolean> createHoldAt(CyclicBarrier start, UUID slotId, UUID patientId, String suffix) {
        return () -> {
            start.await();
            try {
                service.createSlotHold(new CreateSlotHoldRequest(slotId, patientId),
                        new SchedulingAuditContext(ids.next(), ids.next().toString(), Map.of(), "request-" + suffix, "correlation-" + suffix));
                return true;
            } catch (IllegalStateException exception) {
                return false;
            }
        };
    }

    private Callable<Boolean> createBookingSessionHoldAt(
            CyclicBarrier start,
            UUID bookingSessionId,
            UUID patientId,
            String suffix) {
        return () -> {
            start.await();
            try {
                service.createBookingSessionHold(new CreateBookingSessionHoldRequest(bookingSessionId, patientId),
                        new SchedulingAuditContext(ids.next(), ids.next().toString(), Map.of(),
                                "aggregate-request-" + suffix, "aggregate-correlation-" + suffix));
                return true;
            } catch (IllegalStateException exception) {
                return false;
            }
        };
    }

    private AppointmentSlotRow createSlot(Instant start, int capacity) {
        return service.createAppointmentSlot(new CreateAppointmentSlotRequest(
                practitionerRoleId, departmentId, roomId, serviceId, "MORNING", start,
                start.plus(30, ChronoUnit.MINUTES), capacity), auditContext);
    }

    private UUID insertPatient(String name) {
        UUID patientId = ids.next();
        jdbc.update("insert into patient (id, full_name, date_of_birth, version, created_at, updated_at) values (?, ?, date '1990-01-01', 0, now(), now())",
                patientId, name);
        return patientId;
    }

    private void insertPrice(BigDecimal amount) {
        jdbc.update("insert into service_price (id, service_id, amount, currency, effective_from, created_at) values (?, ?, ?, 'VND', now() - interval '1 minute', now())",
                ids.next(), serviceId, amount);
    }
}
