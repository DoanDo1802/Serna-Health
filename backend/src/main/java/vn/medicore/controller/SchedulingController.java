package vn.medicore.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.medicore.common.web.RequestContext;
import vn.medicore.dto.AuthenticatedAccount;
import vn.medicore.dto.PatientModels.Page;
import vn.medicore.dto.SchedulingAuditContext;
import vn.medicore.dto.SchedulingModels.AppointmentRow;
import vn.medicore.dto.SchedulingModels.AppointmentSlotRow;
import vn.medicore.dto.SchedulingModels.BookingAvailabilitySlot;
import vn.medicore.dto.SchedulingModels.BookingSessionAvailability;
import vn.medicore.dto.SchedulingModels.CancelAppointmentRequest;
import vn.medicore.dto.SchedulingModels.CreateAppointmentSlotRequest;
import vn.medicore.dto.SchedulingModels.CreateBookingSessionHoldRequest;
import vn.medicore.dto.SchedulingModels.CreateSlotHoldRequest;
import vn.medicore.dto.SchedulingModels.CreateSlotHoldResponse;
import vn.medicore.dto.SchedulingModels.BookingCatalog;
import vn.medicore.dto.SchedulingModels.CreateWorkScheduleRequest;
import vn.medicore.dto.SchedulingModels.UpdateWorkScheduleRequest;
import vn.medicore.dto.SchedulingModels.WorkScheduleCatalog;
import vn.medicore.dto.SchedulingModels.WorkScheduleRow;
import vn.medicore.dto.SchedulingModels.CreateRescheduleSlotHoldRequest;
import vn.medicore.dto.SchedulingModels.PatientAppointment;
import vn.medicore.dto.SchedulingModels.RescheduleCatalog;
import vn.medicore.dto.SchedulingModels.SlotHoldRow;
import vn.medicore.dto.SchedulingModels.UpdateAppointmentSlotRequest;
import vn.medicore.service.SchedulingAccessPolicy;
import vn.medicore.service.SchedulingService;

@RestController
@RequestMapping("/api/v1")
public class SchedulingController {

    private final SchedulingService service;
    private final SchedulingAccessPolicy accessPolicy;

    public SchedulingController(SchedulingService service, SchedulingAccessPolicy accessPolicy) {
        this.service = service;
        this.accessPolicy = accessPolicy;
    }

    @PostMapping("/appointment-slots")
    @PreAuthorize("hasAuthority('appointment_slot.create')")
    ResponseEntity<AppointmentSlotRow> createAppointmentSlot(
            @Valid @RequestBody AppointmentSlotRequest body,
            @AuthenticationPrincipal AuthenticatedAccount actor,
            HttpServletRequest request) {
        AppointmentSlotRow value = service.createAppointmentSlot(body.toCommand(), auditContext(request, actor));
        return versioned(value, value.version());
    }

    @PatchMapping("/appointment-slots/{slotId}")
    @PreAuthorize("hasAuthority('appointment_slot.update')")
    ResponseEntity<AppointmentSlotRow> updateAppointmentSlot(
            @PathVariable UUID slotId,
            @Valid @RequestBody CapacityRequest body,
            @RequestHeader("If-Match") String ifMatch,
            @AuthenticationPrincipal AuthenticatedAccount actor,
            HttpServletRequest request) {
        AppointmentSlotRow value = service.updateAppointmentSlot(
                slotId, new UpdateAppointmentSlotRequest(body.capacity()), version(ifMatch), auditContext(request, actor));
        return versioned(value, value.version());
    }

    @GetMapping("/appointment-slots/{slotId}")
    @PreAuthorize("hasAuthority('appointment_slot.read')")
    ResponseEntity<AppointmentSlotRow> getAppointmentSlot(@PathVariable UUID slotId) {
        AppointmentSlotRow value = service.getAppointmentSlot(slotId);
        return versioned(value, value.version());
    }

    @GetMapping("/appointment-slots")
    @PreAuthorize("hasAuthority('appointment_slot.read')")
    Page<AppointmentSlotRow> searchAppointmentSlots(
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit) {
        return service.searchAppointmentSlots(cursor, limit);
    }

    @PostMapping("/appointment-slots/{slotId}/actions/cancel")
    @PreAuthorize("hasAuthority('appointment_slot.cancel')")
    ResponseEntity<AppointmentSlotRow> cancelAppointmentSlot(
            @PathVariable UUID slotId,
            @RequestHeader("If-Match") String ifMatch,
            @AuthenticationPrincipal AuthenticatedAccount actor,
            HttpServletRequest request) {
        service.cancelAppointmentSlot(slotId, version(ifMatch), auditContext(request, actor));
        AppointmentSlotRow value = service.getAppointmentSlot(slotId);
        return versioned(value, value.version());
    }

    @GetMapping("/admin/work-schedules/catalog")
    @PreAuthorize("hasAuthority('work_schedule.read')")
    WorkScheduleCatalog workScheduleCatalog() {
        return service.workScheduleCatalog();
    }

    @GetMapping("/admin/work-schedules")
    @PreAuthorize("hasAuthority('work_schedule.read')")
    Page<WorkScheduleRow> searchWorkSchedules(
            @RequestParam(required = false) LocalDate fromDate,
            @RequestParam(required = false) LocalDate toDate,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit) {
        return service.searchWorkSchedules(fromDate, toDate, cursor, limit);
    }

    @GetMapping("/admin/work-schedules/{scheduleId}")
    @PreAuthorize("hasAuthority('work_schedule.read')")
    ResponseEntity<WorkScheduleRow> getWorkSchedule(@PathVariable UUID scheduleId) {
        WorkScheduleRow value = service.getWorkSchedule(scheduleId);
        return versioned(value, value.version());
    }

    @PostMapping("/admin/work-schedules")
    @PreAuthorize("hasAuthority('work_schedule.create')")
    ResponseEntity<WorkScheduleRow> createWorkSchedule(
            @Valid @RequestBody WorkScheduleRequest body,
            @AuthenticationPrincipal AuthenticatedAccount actor,
            HttpServletRequest request) {
        WorkScheduleRow value = service.createWorkSchedule(body.toCommand(), auditContext(request, actor));
        return versioned(value, value.version());
    }

    @PatchMapping("/admin/work-schedules/{scheduleId}")
    @PreAuthorize("hasAuthority('work_schedule.update')")
    ResponseEntity<WorkScheduleRow> updateWorkSchedule(
            @PathVariable UUID scheduleId,
            @Valid @RequestBody UpdateWorkScheduleBody body,
            @RequestHeader("If-Match") String ifMatch,
            @AuthenticationPrincipal AuthenticatedAccount actor,
            HttpServletRequest request) {
        WorkScheduleRow value = service.updateWorkSchedule(
                scheduleId, body.toCommand(), version(ifMatch), auditContext(request, actor));
        return versioned(value, value.version());
    }

    @PostMapping("/admin/work-schedules/{scheduleId}/actions/cancel")
    @PreAuthorize("hasAuthority('work_schedule.cancel')")
    ResponseEntity<WorkScheduleRow> cancelWorkSchedule(
            @PathVariable UUID scheduleId,
            @RequestHeader("If-Match") String ifMatch,
            @AuthenticationPrincipal AuthenticatedAccount actor,
            HttpServletRequest request) {
        service.cancelWorkSchedule(scheduleId, version(ifMatch), auditContext(request, actor));
        WorkScheduleRow value = service.getWorkSchedule(scheduleId);
        return versioned(value, value.version());
    }

    @GetMapping("/booking/catalog")
    ResponseEntity<vn.medicore.dto.SchedulingModels.BookingCatalog> bookingCatalog(
            @RequestParam UUID patientId,
            @AuthenticationPrincipal AuthenticatedAccount actor) {
        accessPolicy.requirePatientAccess(actor, patientId, "slot_hold.create");
        return ResponseEntity.ok(service.bookingCatalog());
    }

    @GetMapping("/booking/availability")
    Page<BookingSessionAvailability> getBookingAvailability(
            @RequestParam UUID patientId,
            @RequestParam(required = false) UUID departmentId,
            @RequestParam(required = false) UUID serviceId,
            @RequestParam(required = false) LocalDate date,
            @RequestParam(required = false) String session,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit,
            @AuthenticationPrincipal AuthenticatedAccount actor) {
        accessPolicy.requirePatientAccess(actor, patientId, "slot_hold.create");
        return service.getBookingAvailability(patientId, departmentId, serviceId, date, session, cursor, limit);
    }

    @GetMapping("/appointments/{appointmentId}/actions/reschedule-availability")
    Page<BookingAvailabilitySlot> getRescheduleAvailability(
            @PathVariable UUID appointmentId,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit,
            @AuthenticationPrincipal AuthenticatedAccount actor) {
        AppointmentRow appointment = service.getAppointment(appointmentId);
        accessPolicy.requirePatientAccess(actor, appointment.patientId(), "appointment.reschedule");
        return service.getRescheduleAvailability(appointmentId, cursor, limit);
    }

    @GetMapping("/appointments/{appointmentId}/actions/reschedule-catalog")
    ResponseEntity<RescheduleCatalog> rescheduleCatalog(
            @PathVariable UUID appointmentId,
            @AuthenticationPrincipal AuthenticatedAccount actor) {
        AppointmentRow appointment = service.getAppointment(appointmentId);
        accessPolicy.requirePatientAccess(actor, appointment.patientId(), "appointment.reschedule");
        return ResponseEntity.ok(service.rescheduleCatalog());
    }

    @PostMapping("/slot-holds")
    ResponseEntity<CreateSlotHoldResponse> createSlotHold(
            @Valid @RequestBody SlotHoldRequest body,
            @AuthenticationPrincipal AuthenticatedAccount actor,
            HttpServletRequest request) {
        accessPolicy.requirePatientAccess(actor, body.patientId(), "slot_hold.create");
        CreateSlotHoldResponse value = service.createBookingSessionHold(
                new CreateBookingSessionHoldRequest(body.bookingSessionId(), body.patientId()), auditContext(request, actor));
        return versioned(value, value.version());
    }

    @PostMapping("/appointments/{appointmentId}/actions/reschedule-slot-holds")
    ResponseEntity<SlotHoldRow> createRescheduleSlotHold(
            @PathVariable UUID appointmentId,
            @Valid @RequestBody RescheduleSlotHoldRequest body,
            @AuthenticationPrincipal AuthenticatedAccount actor,
            HttpServletRequest request) {
        var appointment = service.getAppointment(appointmentId);
        accessPolicy.requirePatientAccess(actor, appointment.patientId(), "appointment.reschedule");
        SlotHoldRow value = service.createRescheduleSlotHold(
                new CreateRescheduleSlotHoldRequest(body.slotId(), appointment.patientId(), appointmentId),
                auditContext(request, actor));
        return versioned(value, value.version());
    }

    @GetMapping("/slot-holds/{holdId}")
    ResponseEntity<SlotHoldRow> getSlotHold(
            @PathVariable UUID holdId,
            @AuthenticationPrincipal AuthenticatedAccount actor,
            HttpServletRequest request) {
        SlotHoldRow existing = service.getSlotHoldForAccess(holdId);
        accessPolicy.requirePatientAccess(actor, existing.patientId(), "slot_hold.read");
        SlotHoldRow value = service.getSlotHold(holdId, auditContext(request, actor));
        return versioned(value, value.version());
    }

    @DeleteMapping("/slot-holds/{holdId}")
    ResponseEntity<SlotHoldRow> cancelSlotHold(
            @PathVariable UUID holdId,
            @RequestHeader("If-Match") String ifMatch,
            @AuthenticationPrincipal AuthenticatedAccount actor,
            HttpServletRequest request) {
        SchedulingAuditContext context = auditContext(request, actor);
        SlotHoldRow existing = service.getSlotHoldForAccess(holdId);
        accessPolicy.requirePatientAccess(actor, existing.patientId(), "slot_hold.cancel");
        service.cancelSlotHold(holdId, version(ifMatch), context);
        SlotHoldRow value = service.getSlotHold(holdId, context);
        return versioned(value, value.version());
    }

    @GetMapping("/appointments")
    Page<PatientAppointment> listAppointments(
            @RequestParam(required = false) UUID patientId,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit,
            @AuthenticationPrincipal AuthenticatedAccount actor) {
        boolean isStaff = accessPolicy.isAuthorizedStaff(actor, "practitioner.read");

        List<UUID> targetPatientIds;
        if (patientId != null) {
            if (!isStaff) {
                accessPolicy.requirePatientAccess(actor, patientId, "patient.read");
            }
            targetPatientIds = List.of(patientId);
        } else {
            List<UUID> accessiblePatientIds = accessPolicy.getAccessiblePatientIds(actor);
            if (accessiblePatientIds.isEmpty() && !isStaff) {
                return new Page<>(List.of(), null, false);
            }
            targetPatientIds = isStaff && accessiblePatientIds.isEmpty() ? null : accessiblePatientIds;
        }

        return service.searchPatientAppointments(targetPatientIds, cursor, limit);
    }

    @GetMapping("/appointments/{appointmentId}")
    ResponseEntity<PatientAppointment> getAppointment(
            @PathVariable UUID appointmentId,
            @AuthenticationPrincipal AuthenticatedAccount actor) {
        AppointmentRow appointment = service.getAppointment(appointmentId);
        boolean isStaff = accessPolicy.isAuthorizedStaff(actor, "practitioner.read");
        if (!isStaff) {
            accessPolicy.requirePatientAccess(actor, appointment.patientId(), "patient.read");
        }
        PatientAppointment value = service.getPatientAppointment(appointmentId);
        return versioned(value, value.version());
    }

    @PostMapping("/appointments/{appointmentId}/actions/cancel")
    ResponseEntity<PatientAppointment> cancelAppointment(
            @PathVariable UUID appointmentId,
            @RequestHeader("If-Match") String ifMatch,
            @Valid @RequestBody(required = false) CancelAppointmentRequest body,
            @AuthenticationPrincipal AuthenticatedAccount actor,
            HttpServletRequest request) {
        AppointmentRow appointment = service.getAppointment(appointmentId);
        boolean isStaff = accessPolicy.isAuthorizedStaff(actor, "appointment.cancel");
        if (!isStaff) {
            accessPolicy.requirePatientAccess(actor, appointment.patientId(), "appointment.cancel");
        }
        PatientAppointment value = service.cancelAppointment(
                appointmentId, version(ifMatch), body != null ? body.reason() : null, auditContext(request, actor), isStaff);
        return versioned(value, value.version());
    }

    private static SchedulingAuditContext auditContext(HttpServletRequest request, AuthenticatedAccount actor) {
        return new SchedulingAuditContext(actor.accountId(), actor.sessionId().toString(),
                Map.of("permissions", List.copyOf(actor.permissions())), RequestContext.requestId(request),
                RequestContext.correlationId(request));
    }

    private static <T> ResponseEntity<T> versioned(T body, long value) {
        return ResponseEntity.ok().eTag(Long.toString(value)).body(body);
    }

    private static long version(String value) {
        if (value == null || !value.matches("^\"[0-9]+\"$")) throw new IllegalArgumentException("If-Match is invalid");
        return Long.parseLong(value.substring(1, value.length() - 1));
    }

    record AppointmentSlotRequest(
            @NotNull UUID practitionerRoleId,
            @NotNull UUID departmentId,
            @NotNull UUID roomId,
            @NotNull UUID serviceId,
            @NotBlank String session,
            @NotNull Instant startAt,
            @NotNull Instant endAt,
            @Min(1) @Max(100) int capacity) {
        CreateAppointmentSlotRequest toCommand() {
            return new CreateAppointmentSlotRequest(
                    practitionerRoleId, departmentId, roomId, serviceId, session, startAt, endAt, capacity);
        }
    }

    record CapacityRequest(@Min(1) @Max(100) int capacity) {
    }

    record UpdateWorkScheduleBody(
            UUID practitionerRoleId,
            UUID departmentId,
            UUID roomId,
            UUID serviceId,
            LocalDate localDate,
            String session,
            @Min(1) @Max(100) Integer capacity) {
        UpdateWorkScheduleRequest toCommand() {
            return new UpdateWorkScheduleRequest(
                    practitionerRoleId, departmentId, roomId, serviceId, localDate, session, capacity);
        }
    }

    record SlotHoldRequest(@NotNull UUID bookingSessionId, @NotNull UUID patientId) {
    }

    record WorkScheduleRequest(
            @NotNull UUID practitionerRoleId,
            @NotNull UUID departmentId,
            @NotNull UUID roomId,
            @NotNull UUID serviceId,
            @NotNull LocalDate localDate,
            @NotBlank String session,
            @Min(1) @Max(100) int capacity) {
        CreateWorkScheduleRequest toCommand() {
            return new CreateWorkScheduleRequest(
                    practitionerRoleId, departmentId, roomId, serviceId, localDate, session, capacity);
        }
    }

    record RescheduleSlotHoldRequest(@NotNull UUID slotId) {
    }
}
