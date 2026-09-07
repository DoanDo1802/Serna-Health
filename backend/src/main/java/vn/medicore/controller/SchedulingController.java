package vn.medicore.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
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
import vn.medicore.dto.SchedulingModels.AppointmentSlotRow;
import vn.medicore.dto.SchedulingModels.CreateAppointmentSlotRequest;
import vn.medicore.dto.SchedulingModels.CreateSlotHoldRequest;
import vn.medicore.dto.SchedulingModels.SlotHoldRow;
import vn.medicore.dto.SchedulingModels.UpdateAppointmentSlotRequest;
import vn.medicore.service.PatientService;
import vn.medicore.service.SchedulingService;

@RestController
@RequestMapping("/api/v1")
public class SchedulingController {

    private final SchedulingService service;
    private final PatientService patients;
    private final Clock clock;

    public SchedulingController(SchedulingService service, PatientService patients, Clock clock) {
        this.service = service;
        this.patients = patients;
        this.clock = clock;
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
    ResponseEntity<AppointmentSlotRow> getAppointmentSlot(@PathVariable UUID slotId) {
        AppointmentSlotRow value = service.getAppointmentSlot(slotId);
        return versioned(value, value.version());
    }

    @GetMapping("/appointment-slots")
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

    @GetMapping("/booking/catalog")
    ResponseEntity<vn.medicore.dto.SchedulingModels.BookingCatalog> bookingCatalog(
            @RequestParam UUID patientId,
            @AuthenticationPrincipal AuthenticatedAccount actor) {
        requireHoldAccess(actor, patientId, "slot_hold.create");
        return ResponseEntity.ok(service.bookingCatalog());
    }

    @PostMapping("/slot-holds")
    ResponseEntity<SlotHoldRow> createSlotHold(
            @Valid @RequestBody SlotHoldRequest body,
            @AuthenticationPrincipal AuthenticatedAccount actor,
            HttpServletRequest request) {
        requireHoldAccess(actor, body.patientId(), "slot_hold.create");
        SlotHoldRow value = service.createSlotHold(new CreateSlotHoldRequest(body.slotId(), body.patientId()), auditContext(request, actor));
        return versioned(value, value.version());
    }

    @GetMapping("/slot-holds/{holdId}")
    ResponseEntity<SlotHoldRow> getSlotHold(
            @PathVariable UUID holdId,
            @AuthenticationPrincipal AuthenticatedAccount actor,
            HttpServletRequest request) {
        SlotHoldRow existing = service.getSlotHoldForAccess(holdId);
        requireHoldAccess(actor, existing.patientId(), "slot_hold.read");
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
        requireHoldAccess(actor, existing.patientId(), "slot_hold.cancel");
        service.cancelSlotHold(holdId, version(ifMatch), context);
        SlotHoldRow value = service.getSlotHold(holdId, context);
        return versioned(value, value.version());
    }

    private void requireHoldAccess(AuthenticatedAccount actor, UUID patientId, String schedulingPermission) {
        Instant now = clock.instant();
        boolean allowed = patients.listAccountPatientLinks(actor.accountId()).stream().anyMatch(link ->
                link.patientId().equals(patientId) && "ACTIVE".equals(link.status())
                        && !now.isBefore(link.validFrom()) && (link.validTo() == null || now.isBefore(link.validTo()))
                        && ("OWN".equals(link.relationship()) || ("REPRESENTATION_VERIFIED".equals(link.verificationTier())
                        && Boolean.TRUE.equals(link.permissionScope().get(schedulingPermission)))));
        if (!allowed) throw new AccessDeniedException("Patient access is not granted");
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

    record SlotHoldRequest(@NotNull UUID slotId, @NotNull UUID patientId) {
    }
}
