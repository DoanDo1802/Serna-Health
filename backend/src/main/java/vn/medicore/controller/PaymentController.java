package vn.medicore.controller;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.medicore.common.web.RequestContext;
import vn.medicore.dto.AuthenticatedAccount;
import vn.medicore.dto.PaymentModels.CommandAcceptedResponse;
import vn.medicore.dto.PaymentModels.PaymentIntentRow;
import vn.medicore.dto.PaymentModels.SimulatePaymentOutcomeRequest;
import vn.medicore.dto.SchedulingAuditContext;
import vn.medicore.dto.SchedulingModels.RescheduleTopUpRequest;
import vn.medicore.dto.SchedulingModels.SlotHoldRow;
import vn.medicore.service.PaymentService;
import vn.medicore.service.RescheduleService;
import vn.medicore.service.SchedulingAccessPolicy;
import vn.medicore.service.SchedulingService;

@RestController
@RequestMapping("/api/v1")
public class PaymentController {

    private final PaymentService paymentService;
    private final SchedulingService schedulingService;
    private final RescheduleService rescheduleService;
    private final SchedulingAccessPolicy accessPolicy;

    public PaymentController(
            PaymentService paymentService,
            SchedulingService schedulingService,
            RescheduleService rescheduleService,
            SchedulingAccessPolicy accessPolicy) {
        this.paymentService = paymentService;
        this.schedulingService = schedulingService;
        this.rescheduleService = rescheduleService;
        this.accessPolicy = accessPolicy;
    }

    @PostMapping("/slot-holds/{holdId}/payment-intents")
    public ResponseEntity<PaymentIntentRow> createPaymentIntent(
            @PathVariable UUID holdId,
            @AuthenticationPrincipal AuthenticatedAccount actor,
            HttpServletRequest request) {
        SlotHoldRow hold = schedulingService.getSlotHoldForAccess(holdId);
        accessPolicy.requirePatientAccess(actor, hold.patientId(), "payment_intent.create");
        SchedulingAuditContext context = auditContext(request, actor);
        PaymentIntentRow value = paymentService.createPaymentIntent(holdId, context);
        return versioned(value, value.version());
    }

    @PostMapping("/appointments/{appointmentId}/actions/reschedule-top-up")
    public ResponseEntity<PaymentIntentRow> createRescheduleTopUpIntent(
            @PathVariable UUID appointmentId,
            @RequestHeader(value = "If-Match", required = true) String ifMatch,
            @RequestBody RescheduleTopUpRequest body,
            @AuthenticationPrincipal AuthenticatedAccount actor,
            HttpServletRequest request) {
        long version = parseVersion(ifMatch);
        var appointment = rescheduleService.getAppointmentForAccess(appointmentId);
        boolean isStaff = accessPolicy.isAuthorizedStaff(actor, "appointment.reschedule");
        if (!isStaff) {
            accessPolicy.requirePatientAccess(actor, appointment.patientId(), "appointment.reschedule");
        }
        if (body == null || body.targetSlotHoldId() == null) {
            throw new IllegalArgumentException("Target slot hold ID is required");
        }
        PaymentIntentRow value = paymentService.createRescheduleTopUpIntent(
                appointmentId, body.targetSlotHoldId(), version, body.reason(), auditContext(request, actor), isStaff);
        return versioned(value, value.version());
    }

    @GetMapping("/payment-intents/{paymentIntentId}")
    public ResponseEntity<PaymentIntentRow> getPaymentIntent(
            @PathVariable UUID paymentIntentId,
            @AuthenticationPrincipal AuthenticatedAccount actor,
            HttpServletRequest request) {
        PaymentIntentRow existing = paymentService.getPaymentIntentForAccess(paymentIntentId);
        SlotHoldRow hold = schedulingService.getSlotHoldForAccess(existing.slotHoldId());
        accessPolicy.requirePatientAccess(actor, hold.patientId(), "payment_intent.read");
        SchedulingAuditContext context = auditContext(request, actor);
        PaymentIntentRow value = paymentService.getPaymentIntent(paymentIntentId, context);
        return versioned(value, value.version());
    }

    @PostMapping("/webhooks/payments/{provider}")
    public ResponseEntity<CommandAcceptedResponse> receivePaymentWebhook(
            @PathVariable String provider,
            @RequestHeader(value = "X-Provider-Event-Id", required = false) String eventId,
            @RequestHeader(value = "X-Provider-Timestamp", required = false) String timestamp,
            @RequestHeader(value = "X-Provider-Signature", required = false) String signature,
            @RequestBody(required = false) byte[] body,
            HttpServletRequest request) {
        String correlationId = RequestContext.correlationId(request);
        paymentService.processPaymentWebhook(
                provider,
                body != null ? body : new byte[0],
                eventId,
                timestamp,
                signature,
                correlationId);
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(new CommandAcceptedResponse("ACCEPTED"));
    }

    @PostMapping("/mock-payment-intents/{paymentIntentId}/actions/simulate")
    @PreAuthorize("hasAuthority('payment.mock.simulate')")
    public ResponseEntity<CommandAcceptedResponse> simulateMockPaymentOutcome(
            @PathVariable UUID paymentIntentId,
            @RequestBody SimulatePaymentOutcomeRequest body,
            @AuthenticationPrincipal AuthenticatedAccount actor,
            HttpServletRequest request) {
        PaymentIntentRow existing = paymentService.getPaymentIntentForAccess(paymentIntentId);
        SlotHoldRow hold = schedulingService.getSlotHoldForAccess(existing.slotHoldId());
        accessPolicy.requirePatientAccess(actor, hold.patientId(), "payment_intent.read");
        SchedulingAuditContext context = auditContext(request, actor);
        paymentService.simulateMockPaymentOutcome(paymentIntentId, body, context);
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(new CommandAcceptedResponse("ACCEPTED"));
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

    private static <T> ResponseEntity<T> versioned(T body, long value) {
        return ResponseEntity.ok().eTag(Long.toString(value)).body(body);
    }
}
