package vn.medicore.scheduling;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.math.BigDecimal;
import java.time.Instant;
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
import vn.medicore.dto.SchedulingModels.CreateSlotHoldRequest;
import vn.medicore.dto.SchedulingModels.SlotHoldRow;
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
        UUID patientId = insertPatient("Confirmed Patient");
        jdbc.update("insert into appointment (id, patient_id, slot_id, status, version, created_at, updated_at) values (?, ?, ?, 'CONFIRMED', 0, now(), now())",
                ids.next(), patientId, slot.id());

        IllegalStateException exception = assertThrows(IllegalStateException.class,
                () -> service.createSlotHold(new CreateSlotHoldRequest(slot.id(), patientId), auditContext));

        assertThat(exception.getMessage()).isEqualTo("Slot is fully booked");
        assertThat(jdbc.queryForObject("select outcome from audit_event where action = 'slot_hold.create' and reason = 'capacity_exhausted'",
                String.class)).isEqualTo("DENIED");
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
    void SC_R1_BOOK_02_practitionerRoleCannotExceedSessionCapacity() {
        Instant start = Instant.now().plus(2, ChronoUnit.DAYS);
        createSlot(start, 1);
        service.createAppointmentSlot(new CreateAppointmentSlotRequest(
                practitionerRoleId, departmentId, roomId, serviceId, "MORNING", start.plus(60, ChronoUnit.MINUTES),
                start.plus(90, ChronoUnit.MINUTES), 1), auditContext);

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> service.createAppointmentSlot(
                new CreateAppointmentSlotRequest(practitionerRoleId, departmentId, roomId, serviceId, "MORNING",
                        start.plus(120, ChronoUnit.MINUTES), start.plus(150, ChronoUnit.MINUTES), 1), auditContext));
        assertThat(exception.getMessage()).contains("exceed 2 active slots per session");
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
