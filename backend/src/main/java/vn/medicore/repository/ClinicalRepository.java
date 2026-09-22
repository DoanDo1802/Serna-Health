package vn.medicore.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import vn.medicore.dto.ClinicalModels.ClinicalNoteRow;
import vn.medicore.dto.ClinicalModels.ClinicalNoteVersionRow;

public interface ClinicalRepository {

    void insertClinicalNote(ClinicalNoteRow row);

    void setInitialCurrentVersion(UUID noteId, UUID currentVersionId);

    Optional<ClinicalNoteRow> clinicalNoteById(UUID id);

    Optional<ClinicalNoteRow> clinicalNoteByIdForUpdate(UUID id);

    void updateClinicalNote(ClinicalNoteRow row, long expectedVersion);

    List<ClinicalNoteRow> listClinicalNotesByEncounter(UUID encounterId);

    List<ClinicalNoteRow> listClinicalNotesByPatient(UUID patientId, int limit, int offset);

    void insertClinicalNoteVersion(ClinicalNoteVersionRow row);

    Optional<ClinicalNoteVersionRow> clinicalNoteVersionById(UUID id);

    Optional<ClinicalNoteVersionRow> clinicalNoteVersionByIdForUpdate(UUID id);

    void updateClinicalNoteVersion(ClinicalNoteVersionRow row, long expectedVersion);

    List<ClinicalNoteVersionRow> listVersionsByClinicalNoteId(UUID clinicalNoteId);

    int nextVersionNumber(UUID clinicalNoteId);

    Optional<ClinicalNoteVersionRow> latestVersionByClinicalNoteId(UUID clinicalNoteId);
}
