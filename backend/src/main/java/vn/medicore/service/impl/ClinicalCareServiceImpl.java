package vn.medicore.service.impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.medicore.common.exception.ResourceNotFoundException;
import vn.medicore.common.utils.UuidV7Generator;
import vn.medicore.dto.AuthenticatedAccount;
import vn.medicore.dto.CatalogModels.PractitionerRoleView;
import vn.medicore.dto.CatalogModels.PractitionerView;
import vn.medicore.dto.ClinicalModels.ClinicalNotePage;
import vn.medicore.dto.ClinicalModels.ClinicalNoteRow;
import vn.medicore.dto.ClinicalModels.ClinicalNoteVersionPage;
import vn.medicore.dto.ClinicalModels.ClinicalNoteVersionRow;
import vn.medicore.dto.ClinicalModels.ClinicalNoteVersionView;
import vn.medicore.dto.ClinicalModels.ClinicalNoteView;
import vn.medicore.dto.ClinicalModels.CreateClinicalNoteRequest;
import vn.medicore.dto.ClinicalModels.UpdateClinicalNoteDraftRequest;
import vn.medicore.dto.ReceptionModels.EncounterRow;
import vn.medicore.dto.SchedulingAuditContext;
import vn.medicore.dto.SecurityAuditRecorder;
import vn.medicore.repository.CatalogRepository;
import vn.medicore.repository.ClinicalRepository;
import vn.medicore.repository.ReceptionRepository;
import vn.medicore.service.ClinicalCareService;

@Service
@Transactional
public class ClinicalCareServiceImpl implements ClinicalCareService {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() { };

    private final ClinicalRepository clinicalRepository;
    private final ReceptionRepository receptionRepository;
    private final CatalogRepository catalogRepository;
    private final SecurityAuditRecorder securityAudit;
    private final ObjectMapper objectMapper;
    private final UuidV7Generator ids;
    private final Clock clock;

    public ClinicalCareServiceImpl(
            ClinicalRepository clinicalRepository,
            ReceptionRepository receptionRepository,
            CatalogRepository catalogRepository,
            SecurityAuditRecorder securityAudit,
            ObjectMapper objectMapper,
            UuidV7Generator ids,
            Clock clock) {
        this.clinicalRepository = clinicalRepository;
        this.receptionRepository = receptionRepository;
        this.catalogRepository = catalogRepository;
        this.securityAudit = securityAudit;
        this.objectMapper = objectMapper;
        this.ids = ids;
        this.clock = clock;
    }

    @Override
    public ClinicalNoteView createClinicalNote(
            UUID encounterId,
            CreateClinicalNoteRequest request,
            AuthenticatedAccount actor,
            SchedulingAuditContext auditContext) {
        EncounterRow encounter = receptionRepository.encounterById(encounterId)
                .orElseThrow(() -> new ResourceNotFoundException("Encounter not found"));

        UUID authorRoleId = requirePractitionerRoleId(actor);
        if (!actor.permissions().contains("audit.read") && !receptionRepository.isPractitionerRoleParticipant(encounterId, authorRoleId)) {
            throw new ResourceNotFoundException("Encounter not found or access denied");
        }

        Instant now = clock.instant();
        UUID noteId = ids.next();
        UUID versionId = ids.next();

        String contentJson = toJson(request.content());
        String digest = computeDigest(contentJson);

        ClinicalNoteRow noteRow = new ClinicalNoteRow(
                noteId, encounterId, encounter.patientId(), request.noteType(),
                "DRAFT", null, 0L, now, now);
        clinicalRepository.insertClinicalNote(noteRow);

        ClinicalNoteVersionRow versionRow = new ClinicalNoteVersionRow(
                versionId, noteId, 1, "DRAFT",
                request.contentSchemaVersion() != null ? request.contentSchemaVersion() : "1.0",
                contentJson, digest, authorRoleId, null, null, null, null, null,
                0L, now, now);
        clinicalRepository.insertClinicalNoteVersion(versionRow);

        clinicalRepository.setInitialCurrentVersion(noteId, versionId);
        ClinicalNoteRow finalNoteRow = new ClinicalNoteRow(
                noteId, encounterId, encounter.patientId(), request.noteType(),
                "DRAFT", versionId, 0L, now, now);

        securityAudit.record(
                actor.accountId(), auditContext.permissionSnapshot(), encounter.patientId(),
                "encounter.write", "SUCCEEDED", "CLINICAL_NOTE_CREATED", "ClinicalNote",
                noteId, 0L, auditContext.sessionId(), auditContext.requestId(), auditContext.correlationId());

        return toClinicalNoteView(finalNoteRow, versionRow);
    }

    @Override
    @Transactional(readOnly = true)
    public ClinicalNoteView getClinicalNote(UUID noteId, AuthenticatedAccount actor) {
        ClinicalNoteRow note = clinicalRepository.clinicalNoteById(noteId)
                .orElseThrow(() -> new ResourceNotFoundException("ClinicalNote not found"));
        verifyNoteAccess(note, actor);
        ClinicalNoteVersionRow version = note.currentVersionId() != null
                ? clinicalRepository.clinicalNoteVersionById(note.currentVersionId()).orElse(null)
                : null;
        return toClinicalNoteView(note, version);
    }

    @Override
    @Transactional(readOnly = true)
    public ClinicalNotePage listEncounterClinicalNotes(UUID encounterId, AuthenticatedAccount actor) {
        EncounterRow encounter = receptionRepository.encounterById(encounterId)
                .orElseThrow(() -> new ResourceNotFoundException("Encounter not found"));
        verifyEncounterAccess(encounter, actor);

        List<ClinicalNoteRow> notes = clinicalRepository.listClinicalNotesByEncounter(encounterId);
        List<ClinicalNoteView> items = notes.stream().map(note -> {
            ClinicalNoteVersionRow version = note.currentVersionId() != null
                    ? clinicalRepository.clinicalNoteVersionById(note.currentVersionId()).orElse(null)
                    : null;
            return toClinicalNoteView(note, version);
        }).toList();

        return new ClinicalNotePage(items, null, false);
    }

    @Override
    @Transactional(readOnly = true)
    public ClinicalNotePage listPatientClinicalNotes(UUID patientId, int limit, int offset, AuthenticatedAccount actor) {
        List<ClinicalNoteRow> notes = clinicalRepository.listClinicalNotesByPatient(patientId, limit + 1, offset);
        boolean hasMore = notes.size() > limit;
        List<ClinicalNoteView> items = notes.stream().limit(limit).map(note -> {
            ClinicalNoteVersionRow version = note.currentVersionId() != null
                    ? clinicalRepository.clinicalNoteVersionById(note.currentVersionId()).orElse(null)
                    : null;
            return toClinicalNoteView(note, version);
        }).toList();

        return new ClinicalNotePage(items, null, hasMore);
    }

    @Override
    @Transactional(readOnly = true)
    public ClinicalNoteVersionPage listClinicalNoteVersions(UUID noteId, AuthenticatedAccount actor) {
        ClinicalNoteRow note = clinicalRepository.clinicalNoteById(noteId)
                .orElseThrow(() -> new ResourceNotFoundException("ClinicalNote not found"));
        verifyNoteAccess(note, actor);

        List<ClinicalNoteVersionRow> rows = clinicalRepository.listVersionsByClinicalNoteId(noteId);
        List<ClinicalNoteVersionView> items = rows.stream().map(this::toVersionView).toList();
        return new ClinicalNoteVersionPage(items, null, false);
    }

    @Override
    @Transactional(readOnly = true)
    public ClinicalNoteVersionView getClinicalNoteVersion(UUID versionId, AuthenticatedAccount actor) {
        ClinicalNoteVersionRow version = clinicalRepository.clinicalNoteVersionById(versionId)
                .orElseThrow(() -> new ResourceNotFoundException("ClinicalNoteVersion not found"));
        ClinicalNoteRow note = clinicalRepository.clinicalNoteById(version.clinicalNoteId())
                .orElseThrow(() -> new ResourceNotFoundException("ClinicalNote not found"));
        verifyNoteAccess(note, actor);
        return toVersionView(version);
    }

    @Override
    public ClinicalNoteVersionView updateClinicalNoteDraft(
            UUID versionId,
            UpdateClinicalNoteDraftRequest request,
            long expectedVersion,
            AuthenticatedAccount actor,
            SchedulingAuditContext auditContext) {
        ClinicalNoteVersionRow version = clinicalRepository.clinicalNoteVersionByIdForUpdate(versionId)
                .orElseThrow(() -> new ResourceNotFoundException("ClinicalNoteVersion not found"));

        if (!"DRAFT".equalsIgnoreCase(version.status())) {
            throw new IllegalStateException("Only DRAFT clinical note versions can be updated. Current status: " + version.status());
        }

        ClinicalNoteRow note = clinicalRepository.clinicalNoteById(version.clinicalNoteId())
                .orElseThrow(() -> new ResourceNotFoundException("ClinicalNote not found"));
        verifyNoteAccess(note, actor);

        Instant now = clock.instant();
        String contentJson = toJson(request.content());
        String digest = computeDigest(contentJson);

        ClinicalNoteVersionRow updated = new ClinicalNoteVersionRow(
                version.id(), version.clinicalNoteId(), version.versionNumber(),
                version.status(), request.contentSchemaVersion() != null ? request.contentSchemaVersion() : version.contentSchemaVersion(),
                contentJson, digest, version.authorPractitionerRoleId(),
                version.finalizedByPractitionerRoleId(), version.finalizedAt(),
                version.amendedFromVersionId(), version.amendmentReason(), version.errorReason(),
                version.version(), version.createdAt(), now);

        clinicalRepository.updateClinicalNoteVersion(updated, expectedVersion);

        securityAudit.record(
                actor.accountId(), auditContext.permissionSnapshot(), note.patientId(),
                "encounter.write", "SUCCEEDED", "CLINICAL_NOTE_DRAFT_UPDATED", "ClinicalNoteVersion",
                versionId, version.version() + 1, auditContext.sessionId(), auditContext.requestId(), auditContext.correlationId());

        return toVersionView(clinicalRepository.clinicalNoteVersionById(versionId).orElseThrow());
    }

    @Override
    public ClinicalNoteVersionView finalizeClinicalNoteVersion(
            UUID versionId,
            long expectedVersion,
            AuthenticatedAccount actor,
            SchedulingAuditContext auditContext) {
        ClinicalNoteVersionRow version = clinicalRepository.clinicalNoteVersionByIdForUpdate(versionId)
                .orElseThrow(() -> new ResourceNotFoundException("ClinicalNoteVersion not found"));

        if (!"DRAFT".equalsIgnoreCase(version.status())) {
            throw new IllegalStateException("Only DRAFT clinical note versions can be finalized. Current status: " + version.status());
        }

        ClinicalNoteRow note = clinicalRepository.clinicalNoteByIdForUpdate(version.clinicalNoteId())
                .orElseThrow(() -> new ResourceNotFoundException("ClinicalNote not found"));
        verifyNoteAccess(note, actor);

        UUID finalizerRoleId = requirePractitionerRoleId(actor);
        Instant now = clock.instant();

        ClinicalNoteVersionRow finalizedVersion = new ClinicalNoteVersionRow(
                version.id(), version.clinicalNoteId(), version.versionNumber(),
                "FINALIZED", version.contentSchemaVersion(), version.contentJson(),
                version.digest(), version.authorPractitionerRoleId(), finalizerRoleId,
                now, version.amendedFromVersionId(), version.amendmentReason(), version.errorReason(),
                version.version(), version.createdAt(), now);

        clinicalRepository.updateClinicalNoteVersion(finalizedVersion, expectedVersion);

        // Update note to FINALIZED
        ClinicalNoteRow updatedNote = new ClinicalNoteRow(
                note.id(), note.encounterId(), note.patientId(), note.noteType(),
                "FINALIZED", versionId, note.version(), note.createdAt(), now);
        clinicalRepository.updateClinicalNote(updatedNote, note.version());

        securityAudit.record(
                actor.accountId(), auditContext.permissionSnapshot(), note.patientId(),
                "clinical.note.finalize", "SUCCEEDED", "CLINICAL_NOTE_FINALIZED", "ClinicalNoteVersion",
                versionId, version.version() + 1, auditContext.sessionId(), auditContext.requestId(), auditContext.correlationId());

        return toVersionView(clinicalRepository.clinicalNoteVersionById(versionId).orElseThrow());
    }

    @Override
    public ClinicalNoteVersionView amendClinicalNoteVersion(
            UUID versionId,
            String reason,
            long expectedVersion,
            AuthenticatedAccount actor,
            SchedulingAuditContext auditContext) {
        ClinicalNoteVersionRow existing = clinicalRepository.clinicalNoteVersionByIdForUpdate(versionId)
                .orElseThrow(() -> new ResourceNotFoundException("ClinicalNoteVersion not found"));

        if (!"FINALIZED".equalsIgnoreCase(existing.status())) {
            throw new IllegalStateException("Only FINALIZED clinical note versions can be amended. Current status: " + existing.status());
        }

        ClinicalNoteRow note = clinicalRepository.clinicalNoteByIdForUpdate(existing.clinicalNoteId())
                .orElseThrow(() -> new ResourceNotFoundException("ClinicalNote not found"));
        verifyNoteAccess(note, actor);

        UUID authorRoleId = requirePractitionerRoleId(actor);
        Instant now = clock.instant();
        UUID newVersionId = ids.next();
        int nextVersionNumber = clinicalRepository.nextVersionNumber(note.id());

        ClinicalNoteVersionRow newVersion = new ClinicalNoteVersionRow(
                newVersionId, note.id(), nextVersionNumber, "DRAFT",
                existing.contentSchemaVersion(), existing.contentJson(), existing.digest(),
                authorRoleId, null, null, versionId, reason, null,
                0L, now, now);
        clinicalRepository.insertClinicalNoteVersion(newVersion);

        // Update note to point to new draft version
        ClinicalNoteRow updatedNote = new ClinicalNoteRow(
                note.id(), note.encounterId(), note.patientId(), note.noteType(),
                "DRAFT", newVersionId, note.version(), note.createdAt(), now);
        clinicalRepository.updateClinicalNote(updatedNote, note.version());

        securityAudit.record(
                actor.accountId(), auditContext.permissionSnapshot(), note.patientId(),
                "clinical.version.amend", "SUCCEEDED", "CLINICAL_NOTE_AMENDED", "ClinicalNoteVersion",
                newVersionId, 0L, auditContext.sessionId(), auditContext.requestId(), auditContext.correlationId());

        return toVersionView(newVersion);
    }

    @Override
    public ClinicalNoteVersionView enterClinicalNoteVersionInError(
            UUID versionId,
            String reason,
            long expectedVersion,
            AuthenticatedAccount actor,
            SchedulingAuditContext auditContext) {
        ClinicalNoteVersionRow version = clinicalRepository.clinicalNoteVersionByIdForUpdate(versionId)
                .orElseThrow(() -> new ResourceNotFoundException("ClinicalNoteVersion not found"));

        ClinicalNoteRow note = clinicalRepository.clinicalNoteById(version.clinicalNoteId())
                .orElseThrow(() -> new ResourceNotFoundException("ClinicalNote not found"));
        verifyNoteAccess(note, actor);

        Instant now = clock.instant();
        ClinicalNoteVersionRow updated = new ClinicalNoteVersionRow(
                version.id(), version.clinicalNoteId(), version.versionNumber(),
                "ENTERED_IN_ERROR", version.contentSchemaVersion(), version.contentJson(),
                version.digest(), version.authorPractitionerRoleId(),
                version.finalizedByPractitionerRoleId(), version.finalizedAt(),
                version.amendedFromVersionId(), version.amendmentReason(), reason,
                version.version(), version.createdAt(), now);

        clinicalRepository.updateClinicalNoteVersion(updated, expectedVersion);

        securityAudit.record(
                actor.accountId(), auditContext.permissionSnapshot(), note.patientId(),
                "clinical.version.enter_in_error", "SUCCEEDED", "CLINICAL_NOTE_ENTERED_IN_ERROR", "ClinicalNoteVersion",
                versionId, version.version() + 1, auditContext.sessionId(), auditContext.requestId(), auditContext.correlationId());

        return toVersionView(clinicalRepository.clinicalNoteVersionById(versionId).orElseThrow());
    }

    private void verifyNoteAccess(ClinicalNoteRow note, AuthenticatedAccount actor) {
        if (actor.permissions().contains("account.provision") || actor.permissions().contains("audit.read")) {
            return;
        }
        EncounterRow encounter = receptionRepository.encounterById(note.encounterId())
                .orElseThrow(() -> new ResourceNotFoundException("Encounter not found"));
        verifyEncounterAccess(encounter, actor);
    }

    private void verifyEncounterAccess(EncounterRow encounter, AuthenticatedAccount actor) {
        if (actor.permissions().contains("account.provision") || actor.permissions().contains("audit.read")) {
            return;
        }
        UUID roleId = resolvePractitionerRoleId(actor);
        if (roleId == null || !receptionRepository.isPractitionerRoleParticipant(encounter.id(), roleId)) {
            throw new ResourceNotFoundException("Record not found or inaccessible");
        }
    }

    private UUID requirePractitionerRoleId(AuthenticatedAccount actor) {
        UUID roleId = resolvePractitionerRoleId(actor);
        if (roleId == null) {
            throw new IllegalStateException("Authenticated account has no active practitioner role");
        }
        return roleId;
    }

    private UUID resolvePractitionerRoleId(AuthenticatedAccount actor) {
        Optional<PractitionerView> practitionerOpt = catalogRepository.practitionerByAccountId(actor.accountId());
        if (practitionerOpt.isEmpty()) {
            return null;
        }
        List<PractitionerRoleView> roles = catalogRepository.listPractitionerRoles(
                practitionerOpt.get().id(), null, "ACTIVE", 10, 0);
        return roles.isEmpty() ? null : roles.getFirst().id();
    }

    private String computeDigest(String text) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(text.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Cannot serialize content to JSON", e);
        }
    }

    private Object fromJson(String json) {
        try {
            return objectMapper.readValue(json, MAP_TYPE);
        } catch (JsonProcessingException e) {
            return json;
        }
    }

    private ClinicalNoteView toClinicalNoteView(ClinicalNoteRow note, ClinicalNoteVersionRow version) {
        ClinicalNoteVersionView versionView = version != null ? toVersionView(version) : null;
        return new ClinicalNoteView(
                note.id(), note.version(), note.encounterId(), note.patientId(),
                note.noteType(), note.status(), note.currentVersionId(),
                versionView, note.createdAt(), note.updatedAt());
    }

    private ClinicalNoteVersionView toVersionView(ClinicalNoteVersionRow row) {
        return new ClinicalNoteVersionView(
                row.id(), row.version(), row.clinicalNoteId(), row.versionNumber(),
                row.status(), row.contentSchemaVersion(), fromJson(row.contentJson()),
                row.digest(), row.authorPractitionerRoleId(), null,
                row.finalizedByPractitionerRoleId(), null, row.finalizedAt(),
                row.amendedFromVersionId(), row.amendmentReason(), row.errorReason(),
                row.createdAt(), row.updatedAt());
    }
}
