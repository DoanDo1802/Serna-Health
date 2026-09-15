package vn.medicore.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.medicore.common.web.RequestContext;
import vn.medicore.dto.AuthenticatedAccount;
import vn.medicore.dto.ReceptionModels.CheckInAppointmentRequest;
import vn.medicore.dto.ReceptionModels.CheckInView;
import vn.medicore.dto.ReceptionModels.EncounterPage;
import vn.medicore.dto.ReceptionModels.EncounterView;
import vn.medicore.dto.ReceptionModels.VisitPage;
import vn.medicore.dto.ReceptionModels.VisitView;
import vn.medicore.dto.SchedulingAuditContext;
import vn.medicore.service.ReceptionService;

@RestController
@RequestMapping("/api/v1")
public class ReceptionQueueController {

    private final ReceptionService service;

    public ReceptionQueueController(ReceptionService service) {
        this.service = service;
    }

    @PostMapping("/appointments/{appointmentId}/check-ins")
    @PreAuthorize("hasAuthority('checkin.execute')")
    public ResponseEntity<CheckInView> checkInAppointment(
            @PathVariable UUID appointmentId,
            @RequestBody(required = false) CheckInAppointmentRequest body,
            @AuthenticationPrincipal AuthenticatedAccount actor,
            HttpServletRequest request) {
        CheckInView value = service.checkInAppointment(appointmentId, body, actor, auditContext(request, actor));
        return versioned(value, value.version());
    }

    @GetMapping("/check-ins/{checkInId}")
    @PreAuthorize("hasAuthority('checkin.read')")
    public ResponseEntity<CheckInView> getCheckIn(
            @PathVariable UUID checkInId,
            @AuthenticationPrincipal AuthenticatedAccount actor) {
        CheckInView value = service.getCheckIn(checkInId, actor);
        return versioned(value, value.version());
    }

    @GetMapping("/visits")
    @PreAuthorize("hasAuthority('visit.read')")
    public ResponseEntity<VisitPage> listVisits(
            @RequestParam(required = false) UUID patientId,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit,
            @RequestParam(defaultValue = "0") @Min(0) int offset,
            @AuthenticationPrincipal AuthenticatedAccount actor) {
        return ResponseEntity.ok(service.listVisits(patientId, status, limit, offset, actor));
    }

    @GetMapping("/visits/{visitId}")
    @PreAuthorize("hasAuthority('visit.read')")
    public ResponseEntity<VisitView> getVisit(
            @PathVariable UUID visitId,
            @AuthenticationPrincipal AuthenticatedAccount actor) {
        VisitView value = service.getVisit(visitId, actor);
        return versioned(value, value.version());
    }

    @PostMapping("/visits/{visitId}/actions/complete")
    @PreAuthorize("hasAuthority('visit.complete')")
    public ResponseEntity<VisitView> completeVisit(
            @PathVariable UUID visitId,
            @RequestHeader("If-Match") String ifMatch,
            @AuthenticationPrincipal AuthenticatedAccount actor,
            HttpServletRequest request) {
        VisitView value = service.completeVisit(visitId, version(ifMatch), actor, auditContext(request, actor));
        return versioned(value, value.version());
    }

    @GetMapping("/visits/{visitId}/encounters")
    @PreAuthorize("hasAuthority('encounter.read')")
    public ResponseEntity<EncounterPage> listVisitEncounters(
            @PathVariable UUID visitId,
            @AuthenticationPrincipal AuthenticatedAccount actor) {
        return ResponseEntity.ok(service.listVisitEncounters(visitId, actor));
    }

    @GetMapping("/encounters/{encounterId}")
    @PreAuthorize("hasAuthority('encounter.read')")
    public ResponseEntity<EncounterView> getEncounter(
            @PathVariable UUID encounterId,
            @AuthenticationPrincipal AuthenticatedAccount actor) {
        EncounterView value = service.getEncounter(encounterId, actor);
        return versioned(value, value.version());
    }

    @PostMapping("/encounters/{encounterId}/actions/start")
    @PreAuthorize("hasAuthority('encounter.start')")
    public ResponseEntity<EncounterView> startEncounter(
            @PathVariable UUID encounterId,
            @RequestHeader("If-Match") String ifMatch,
            @AuthenticationPrincipal AuthenticatedAccount actor,
            HttpServletRequest request) {
        EncounterView value = service.startEncounter(encounterId, version(ifMatch), actor, auditContext(request, actor));
        return versioned(value, value.version());
    }

    @PostMapping("/encounters/{encounterId}/actions/complete")
    @PreAuthorize("hasAuthority('encounter.complete')")
    public ResponseEntity<EncounterView> completeEncounter(
            @PathVariable UUID encounterId,
            @RequestHeader("If-Match") String ifMatch,
            @AuthenticationPrincipal AuthenticatedAccount actor,
            HttpServletRequest request) {
        EncounterView value = service.completeEncounter(encounterId, version(ifMatch), actor, auditContext(request, actor));
        return versioned(value, value.version());
    }

    @GetMapping("/doctor/encounters")
    @PreAuthorize("hasAuthority('encounter.read')")
    public ResponseEntity<EncounterPage> listDoctorEncounters(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "50") @Min(1) @Max(100) int limit,
            @RequestParam(defaultValue = "0") @Min(0) int offset,
            @AuthenticationPrincipal AuthenticatedAccount actor) {
        return ResponseEntity.ok(service.searchDoctorEncounters(date, status, limit, offset, actor));
    }

    private static SchedulingAuditContext auditContext(HttpServletRequest request, AuthenticatedAccount actor) {
        return new SchedulingAuditContext(
                actor.accountId(), actor.sessionId().toString(),
                Map.of("permissions", List.copyOf(actor.permissions())),
                RequestContext.requestId(request),
                RequestContext.correlationId(request));
    }

    private static <T> ResponseEntity<T> versioned(T body, long value) {
        return ResponseEntity.ok().eTag(Long.toString(value)).body(body);
    }

    private static long version(String value) {
        if (value == null || !value.matches("^\"[0-9]+\"$")) {
            throw new IllegalArgumentException("If-Match header is invalid");
        }
        return Long.parseLong(value.substring(1, value.length() - 1));
    }
}
