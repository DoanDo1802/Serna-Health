package vn.medicore.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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
import vn.medicore.dto.ClinicalModels.ClinicalNotePage;
import vn.medicore.dto.ClinicalModels.ClinicalNoteVersionPage;
import vn.medicore.dto.ClinicalModels.ClinicalNoteVersionView;
import vn.medicore.dto.ClinicalModels.ClinicalNoteView;
import vn.medicore.dto.ClinicalModels.CreateClinicalNoteRequest;
import vn.medicore.dto.ClinicalModels.ReasonCommand;
import vn.medicore.dto.ClinicalModels.UpdateClinicalNoteDraftRequest;
import vn.medicore.dto.SchedulingAuditContext;
import vn.medicore.service.ClinicalCareService;

@RestController
@RequestMapping("/api/v1")
public class ClinicalCareController {

    private final ClinicalCareService service;

    public ClinicalCareController(ClinicalCareService service) {
        this.service = service;
    }

    @GetMapping("/encounters/{encounterId}/clinical-notes")
    @PreAuthorize("hasAuthority('clinical.note.read')")
    public ResponseEntity<ClinicalNotePage> listEncounterClinicalNotes(
            @PathVariable UUID encounterId,
            @AuthenticationPrincipal AuthenticatedAccount actor) {
        return ResponseEntity.ok(service.listEncounterClinicalNotes(encounterId, actor));
    }

    @PostMapping("/encounters/{encounterId}/clinical-notes")
    @PreAuthorize("hasAuthority('encounter.write')")
    public ResponseEntity<ClinicalNoteView> createClinicalNote(
            @PathVariable UUID encounterId,
            @Valid @RequestBody CreateClinicalNoteRequest body,
            @AuthenticationPrincipal AuthenticatedAccount actor,
            HttpServletRequest request) {
        ClinicalNoteView value = service.createClinicalNote(encounterId, body, actor, auditContext(request, actor));
        return versioned(value, value.version());
    }

    @GetMapping("/clinical-notes/{noteId}")
    @PreAuthorize("hasAuthority('clinical.note.read')")
    public ResponseEntity<ClinicalNoteView> getClinicalNote(
            @PathVariable UUID noteId,
            @AuthenticationPrincipal AuthenticatedAccount actor) {
        ClinicalNoteView value = service.getClinicalNote(noteId, actor);
        return versioned(value, value.version());
    }

    @GetMapping("/clinical-notes/{noteId}/versions")
    @PreAuthorize("hasAuthority('clinical.note.read')")
    public ResponseEntity<ClinicalNoteVersionPage> listClinicalNoteVersions(
            @PathVariable UUID noteId,
            @AuthenticationPrincipal AuthenticatedAccount actor) {
        return ResponseEntity.ok(service.listClinicalNoteVersions(noteId, actor));
    }

    @GetMapping("/clinical-note-versions/{versionId}")
    @PreAuthorize("hasAuthority('clinical.note.read')")
    public ResponseEntity<ClinicalNoteVersionView> getClinicalNoteVersion(
            @PathVariable UUID versionId,
            @AuthenticationPrincipal AuthenticatedAccount actor) {
        ClinicalNoteVersionView value = service.getClinicalNoteVersion(versionId, actor);
        return versioned(value, value.version());
    }

    @PatchMapping("/clinical-note-versions/{versionId}")
    @PreAuthorize("hasAuthority('encounter.write')")
    public ResponseEntity<ClinicalNoteVersionView> updateClinicalNoteDraft(
            @PathVariable UUID versionId,
            @RequestHeader("If-Match") String ifMatch,
            @Valid @RequestBody UpdateClinicalNoteDraftRequest body,
            @AuthenticationPrincipal AuthenticatedAccount actor,
            HttpServletRequest request) {
        ClinicalNoteVersionView value = service.updateClinicalNoteDraft(
                versionId, body, version(ifMatch), actor, auditContext(request, actor));
        return versioned(value, value.version());
    }

    @PostMapping("/clinical-note-versions/{versionId}/actions/finalize")
    @PreAuthorize("hasAuthority('clinical.note.finalize')")
    public ResponseEntity<ClinicalNoteVersionView> finalizeClinicalNoteVersion(
            @PathVariable UUID versionId,
            @RequestHeader("If-Match") String ifMatch,
            @AuthenticationPrincipal AuthenticatedAccount actor,
            HttpServletRequest request) {
        ClinicalNoteVersionView value = service.finalizeClinicalNoteVersion(
                versionId, version(ifMatch), actor, auditContext(request, actor));
        return versioned(value, value.version());
    }

    @PostMapping("/clinical-note-versions/{versionId}/actions/amend")
    @PreAuthorize("hasAuthority('clinical.version.amend')")
    public ResponseEntity<ClinicalNoteVersionView> amendClinicalNoteVersion(
            @PathVariable UUID versionId,
            @RequestHeader("If-Match") String ifMatch,
            @Valid @RequestBody ReasonCommand body,
            @AuthenticationPrincipal AuthenticatedAccount actor,
            HttpServletRequest request) {
        ClinicalNoteVersionView value = service.amendClinicalNoteVersion(
                versionId, body != null ? body.reason() : null, version(ifMatch), actor, auditContext(request, actor));
        return versioned(value, value.version());
    }

    @PostMapping("/clinical-note-versions/{versionId}/actions/enter-in-error")
    @PreAuthorize("hasAuthority('clinical.version.enter_in_error')")
    public ResponseEntity<ClinicalNoteVersionView> enterClinicalNoteVersionInError(
            @PathVariable UUID versionId,
            @RequestHeader("If-Match") String ifMatch,
            @Valid @RequestBody ReasonCommand body,
            @AuthenticationPrincipal AuthenticatedAccount actor,
            HttpServletRequest request) {
        ClinicalNoteVersionView value = service.enterClinicalNoteVersionInError(
                versionId, body != null ? body.reason() : null, version(ifMatch), actor, auditContext(request, actor));
        return versioned(value, value.version());
    }

    @GetMapping("/patients/{patientId}/clinical-notes")
    @PreAuthorize("hasAuthority('clinical.note.read')")
    public ResponseEntity<ClinicalNotePage> listPatientClinicalNotes(
            @PathVariable UUID patientId,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit,
            @RequestParam(defaultValue = "0") @Min(0) int offset,
            @AuthenticationPrincipal AuthenticatedAccount actor) {
        return ResponseEntity.ok(service.listPatientClinicalNotes(patientId, limit, offset, actor));
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
