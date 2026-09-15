package vn.medicore.service;

import java.util.UUID;
import vn.medicore.dto.AuthenticatedAccount;
import vn.medicore.dto.ClinicalModels.ClinicalNotePage;
import vn.medicore.dto.ClinicalModels.ClinicalNoteVersionPage;
import vn.medicore.dto.ClinicalModels.ClinicalNoteVersionView;
import vn.medicore.dto.ClinicalModels.ClinicalNoteView;
import vn.medicore.dto.ClinicalModels.CreateClinicalNoteRequest;
import vn.medicore.dto.ClinicalModels.UpdateClinicalNoteDraftRequest;
import vn.medicore.dto.SchedulingAuditContext;

public interface ClinicalCareService {

    ClinicalNoteView createClinicalNote(
            UUID encounterId,
            CreateClinicalNoteRequest request,
            AuthenticatedAccount actor,
            SchedulingAuditContext auditContext);

    ClinicalNoteView getClinicalNote(UUID noteId, AuthenticatedAccount actor);

    ClinicalNotePage listEncounterClinicalNotes(UUID encounterId, AuthenticatedAccount actor);

    ClinicalNotePage listPatientClinicalNotes(UUID patientId, int limit, int offset, AuthenticatedAccount actor);

    ClinicalNoteVersionPage listClinicalNoteVersions(UUID noteId, AuthenticatedAccount actor);

    ClinicalNoteVersionView getClinicalNoteVersion(UUID versionId, AuthenticatedAccount actor);

    ClinicalNoteVersionView updateClinicalNoteDraft(
            UUID versionId,
            UpdateClinicalNoteDraftRequest request,
            long expectedVersion,
            AuthenticatedAccount actor,
            SchedulingAuditContext auditContext);

    ClinicalNoteVersionView finalizeClinicalNoteVersion(
            UUID versionId,
            long expectedVersion,
            AuthenticatedAccount actor,
            SchedulingAuditContext auditContext);

    ClinicalNoteVersionView amendClinicalNoteVersion(
            UUID versionId,
            String reason,
            long expectedVersion,
            AuthenticatedAccount actor,
            SchedulingAuditContext auditContext);

    ClinicalNoteVersionView enterClinicalNoteVersionInError(
            UUID versionId,
            String reason,
            long expectedVersion,
            AuthenticatedAccount actor,
            SchedulingAuditContext auditContext);
}
