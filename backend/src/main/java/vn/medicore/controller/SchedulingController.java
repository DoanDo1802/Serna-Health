package vn.medicore.controller;

import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.medicore.dto.AuthenticatedAccount;
import vn.medicore.dto.SchedulingModels.AppointmentSlotRow;
import vn.medicore.dto.SchedulingModels.CreateAppointmentSlotRequest;
import vn.medicore.dto.SchedulingModels.CreateSlotHoldRequest;
import vn.medicore.dto.SchedulingModels.SlotHoldRow;
import vn.medicore.dto.SchedulingModels.UpdateAppointmentSlotRequest;
import vn.medicore.service.SchedulingService;

@RestController
@RequestMapping("/api/v1")
public class SchedulingController {

    private final SchedulingService service;

    public SchedulingController(SchedulingService service) {
        this.service = service;
    }

    // --- Appointment Slots ---

    @PostMapping("/appointment-slots")
    public ResponseEntity<AppointmentSlotRow> createAppointmentSlot(
            @RequestBody CreateAppointmentSlotRequest request,
            @RequestAttribute("authenticatedAccount") AuthenticatedAccount actor,
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestHeader(value = "X-Correlation-Id", required = false) String correlationId) {
        
        AppointmentSlotRow row = service.createAppointmentSlot(request, actor, requestId, correlationId);
        return ResponseEntity.ok()
                .header("ETag", String.format("\"%d\"", row.version()))
                .body(row);
    }

    @PatchMapping("/appointment-slots/{slotId}")
    public ResponseEntity<AppointmentSlotRow> updateAppointmentSlot(
            @PathVariable UUID slotId,
            @RequestBody UpdateAppointmentSlotRequest request,
            @RequestHeader("If-Match") String ifMatch,
            @RequestAttribute("authenticatedAccount") AuthenticatedAccount actor,
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestHeader(value = "X-Correlation-Id", required = false) String correlationId) {
        
        long expectedVersion = parseETag(ifMatch);
        AppointmentSlotRow row = service.updateAppointmentSlot(slotId, request, expectedVersion, actor, requestId, correlationId);
        return ResponseEntity.ok()
                .header("ETag", String.format("\"%d\"", row.version()))
                .body(row);
    }

    @GetMapping("/appointment-slots/{slotId}")
    public ResponseEntity<AppointmentSlotRow> getAppointmentSlot(@PathVariable UUID slotId) {
        AppointmentSlotRow row = service.getAppointmentSlot(slotId);
        return ResponseEntity.ok()
                .header("ETag", String.format("\"%d\"", row.version()))
                .body(row);
    }

    @GetMapping("/appointment-slots")
    public ResponseEntity<List<AppointmentSlotRow>> searchAppointmentSlots(
            @RequestParam(defaultValue = "50") int limit,
            @RequestParam(defaultValue = "0") int offset) {
        List<AppointmentSlotRow> rows = service.searchAppointmentSlots(limit, offset);
        return ResponseEntity.ok(rows);
    }

    @PostMapping("/appointment-slots/{slotId}/actions/cancel")
    public ResponseEntity<Void> cancelAppointmentSlot(
            @PathVariable UUID slotId,
            @RequestHeader("If-Match") String ifMatch,
            @RequestAttribute("authenticatedAccount") AuthenticatedAccount actor,
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestHeader(value = "X-Correlation-Id", required = false) String correlationId) {
        
        long expectedVersion = parseETag(ifMatch);
        service.cancelAppointmentSlot(slotId, expectedVersion, actor, requestId, correlationId);
        return ResponseEntity.noContent().build();
    }

    // --- Slot Holds ---

    @PostMapping("/slot-holds")
    public ResponseEntity<SlotHoldRow> createSlotHold(
            @RequestBody CreateSlotHoldRequest request,
            @RequestAttribute("authenticatedAccount") AuthenticatedAccount actor,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestHeader("X-Request-Hash") String requestHash,
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestHeader(value = "X-Correlation-Id", required = false) String correlationId) {
        
        // Scope derived from actor, usually handled in filter but passed explicitly here or computed
        String scope = "account:" + actor.accountId(); 
        
        SlotHoldRow row = service.createSlotHold(request, actor, scope, idempotencyKey, requestHash, requestId, correlationId);
        return ResponseEntity.ok()
                .header("ETag", String.format("\"%d\"", row.version()))
                .body(row);
    }

    @GetMapping("/slot-holds/{holdId}")
    public ResponseEntity<SlotHoldRow> getSlotHold(@PathVariable UUID holdId) {
        SlotHoldRow row = service.getSlotHold(holdId);
        return ResponseEntity.ok()
                .header("ETag", String.format("\"%d\"", row.version()))
                .body(row);
    }

    @DeleteMapping("/slot-holds/{holdId}")
    public ResponseEntity<Void> cancelSlotHold(
            @PathVariable UUID holdId,
            @RequestHeader("If-Match") String ifMatch,
            @RequestAttribute("authenticatedAccount") AuthenticatedAccount actor,
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestHeader(value = "X-Correlation-Id", required = false) String correlationId) {
        
        long expectedVersion = parseETag(ifMatch);
        service.cancelSlotHold(holdId, expectedVersion, actor, requestId, correlationId);
        return ResponseEntity.noContent().build();
    }

    private long parseETag(String etag) {
        if (etag == null) throw new IllegalArgumentException("If-Match header is required");
        return Long.parseLong(etag.replaceAll("\"", ""));
    }
}
