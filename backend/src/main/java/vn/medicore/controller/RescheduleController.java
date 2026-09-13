package vn.medicore.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.medicore.common.web.RequestContext;
import vn.medicore.dto.AuthenticatedAccount;
import vn.medicore.dto.SchedulingAuditContext;
import vn.medicore.dto.SchedulingModels.AppointmentRow;
import vn.medicore.dto.SchedulingModels.RescheduleAppointmentRequest;
import vn.medicore.dto.SchedulingModels.RescheduleAppointmentResponse;
import vn.medicore.service.RescheduleService;
import vn.medicore.service.SchedulingAccessPolicy;

@RestController
@RequestMapping("/api/v1")
public class RescheduleController {

    private final RescheduleService rescheduleService;
    private final SchedulingAccessPolicy accessPolicy;

    public RescheduleController(
            RescheduleService rescheduleService,
            SchedulingAccessPolicy accessPolicy) {
        this.rescheduleService = rescheduleService;
        this.accessPolicy = accessPolicy;
    }

    @PostMapping("/appointments/{appointmentId}/actions/reschedule")
    public ResponseEntity<RescheduleAppointmentResponse> rescheduleAppointment(
            @PathVariable UUID appointmentId,
            @RequestHeader(value = "If-Match", required = true) String ifMatch,
            @Valid @RequestBody RescheduleAppointmentRequest body,
            @AuthenticationPrincipal AuthenticatedAccount actor,
            HttpServletRequest request) {
        long version = parseVersion(ifMatch);
        AppointmentRow existing = rescheduleService.getAppointmentForAccess(appointmentId);
        boolean isStaff = accessPolicy.isAuthorizedStaff(actor, "appointment.reschedule");
        if (!isStaff) {
            accessPolicy.requirePatientAccess(actor, existing.patientId(), "appointment.reschedule");
        }
        SchedulingAuditContext context = auditContext(request, actor);
        RescheduleAppointmentResponse response = rescheduleService.rescheduleAppointment(
                appointmentId, body, version, context, isStaff);
        return ResponseEntity.ok()
                .eTag(Long.toString(response.oldAppointmentVersion()))
                .body(response);
    }

    private static SchedulingAuditContext auditContext(HttpServletRequest request, AuthenticatedAccount actor) {
        return new SchedulingAuditContext(
                actor.accountId(),
                actor.sessionId().toString(),
                Map.of("permissions", List.copyOf(actor.permissions())),
                RequestContext.requestId(request),
                RequestContext.correlationId(request));
    }

    private static long parseVersion(String value) {
        if (value == null || !value.matches("^\"[0-9]+\"$")) {
            throw new IllegalArgumentException("If-Match is invalid");
        }
        return Long.parseLong(value.substring(1, value.length() - 1));
    }
}
