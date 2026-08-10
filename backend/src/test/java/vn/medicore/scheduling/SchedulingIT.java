package vn.medicore.scheduling;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import vn.medicore.common.utils.UuidV7Generator;
import vn.medicore.dto.AuthenticatedAccount;
import vn.medicore.dto.SchedulingModels.AppointmentSlotRow;
import vn.medicore.dto.SchedulingModels.CreateAppointmentSlotRequest;
import vn.medicore.service.SchedulingService;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
@SpringBootTest
@ActiveProfiles("test")
public class SchedulingIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17.10");

    @Autowired
    private SchedulingService service;

    @Autowired
    private UuidV7Generator ids;

    @Autowired
    private JdbcTemplate jdbc;

    private UUID practitionerRoleId;
    private UUID departmentId;
    private UUID roomId;
    private UUID serviceId;
    private AuthenticatedAccount actor;

    @BeforeEach
    void setup() {
        practitionerRoleId = ids.next();
        departmentId = ids.next();
        roomId = ids.next();
        serviceId = ids.next();
        UUID practitionerId = ids.next();
        
        actor = new AuthenticatedAccount(ids.next(), ids.next(), java.util.Set.of(), java.util.List.of());

        // Insert dummy catalog data to satisfy FKs
        String depCode = ids.next().toString();
        jdbc.update("insert into department (id, code, name, active, effective_from, created_at, updated_at) values (?, ?, ?, true, now(), now(), now()) on conflict do nothing", departmentId, depCode, "Cardiology");
        String roomCode = ids.next().toString();
        jdbc.update("insert into room (id, department_id, code, name, active, created_at, updated_at) values (?, ?, ?, ?, true, now(), now()) on conflict do nothing", roomId, departmentId, roomCode, "Room 101");
        String srvCode = ids.next().toString();
        jdbc.update("insert into service (id, code, name, service_type, active, created_at, updated_at) values (?, ?, ?, 'CONSULTATION', true, now(), now()) on conflict do nothing", serviceId, srvCode, "Consultation");
        String drCode = ids.next().toString();
        jdbc.update("insert into practitioner (id, staff_code, full_name, active, created_at, updated_at) values (?, ?, ?, true, now(), now()) on conflict do nothing", practitionerId, drCode, "Dr. John Doe");
        jdbc.update("insert into practitioner_role (id, practitioner_id, department_id, role_code, status, effective_from, created_at, updated_at) values (?, ?, ?, ?, 'ACTIVE', now(), now(), now()) on conflict do nothing", practitionerRoleId, practitionerId, departmentId, "DOCTOR");
    }

    @Test
    void SC_R1_BOOK_01_slot_creation_respects_capacity_and_overlap() {
        Instant start = Instant.now().plus(1, ChronoUnit.DAYS);
        Instant end = start.plus(30, ChronoUnit.MINUTES);

        // 1. Create first slot (successful)
        CreateAppointmentSlotRequest req1 = new CreateAppointmentSlotRequest(
                practitionerRoleId, departmentId, roomId, serviceId, "MORNING", start, end, 2);
        
        AppointmentSlotRow slot1 = service.createAppointmentSlot(req1, actor, "req-1", "corr-1");
        assertThat(slot1).isNotNull();
        assertThat(slot1.status()).isEqualTo("ACTIVE");

        // 2. Try to create an overlapping slot for the same practitioner role
        Instant overlapStart = start.plus(15, ChronoUnit.MINUTES);
        Instant overlapEnd = overlapStart.plus(30, ChronoUnit.MINUTES);
        
        CreateAppointmentSlotRequest req2 = new CreateAppointmentSlotRequest(
                practitionerRoleId, departmentId, roomId, serviceId, "MORNING", overlapStart, overlapEnd, 1);

        // Should throw DataIntegrityViolationException due to GiST exclude constraint
        assertThrows(DataIntegrityViolationException.class, () -> {
            service.createAppointmentSlot(req2, actor, "req-2", "corr-2");
        });
    }

    @Test
    void SC_R1_BOOK_02_practitioner_role_cannot_exceed_session_capacity() {
        Instant baseStart = Instant.now().plus(2, ChronoUnit.DAYS);
        
        // 1. Create 2 slots in the MORNING (Max allowed per session)
        service.createAppointmentSlot(
                new CreateAppointmentSlotRequest(practitionerRoleId, departmentId, roomId, serviceId, "MORNING", baseStart, baseStart.plus(30, ChronoUnit.MINUTES), 1),
                actor, "req-1", "corr-1");
                
        service.createAppointmentSlot(
                new CreateAppointmentSlotRequest(practitionerRoleId, departmentId, roomId, serviceId, "MORNING", baseStart.plus(60, ChronoUnit.MINUTES), baseStart.plus(90, ChronoUnit.MINUTES), 1),
                actor, "req-2", "corr-2");

        // 2. Try to create 3rd slot in MORNING
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
            service.createAppointmentSlot(
                    new CreateAppointmentSlotRequest(practitionerRoleId, departmentId, roomId, serviceId, "MORNING", baseStart.plus(120, ChronoUnit.MINUTES), baseStart.plus(150, ChronoUnit.MINUTES), 1),
                    actor, "req-3", "corr-3");
        });
        
        assertThat(ex.getMessage()).contains("exceed 2 active slots per session");
    }
}
