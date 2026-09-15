package vn.medicore.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import vn.medicore.dto.ReceptionModels.CheckInRow;
import vn.medicore.dto.ReceptionModels.EncounterParticipantRow;
import vn.medicore.dto.ReceptionModels.EncounterParticipantView;
import vn.medicore.dto.ReceptionModels.EncounterRow;
import vn.medicore.dto.ReceptionModels.VisitRow;

public interface ReceptionRepository {

    void insertVisit(VisitRow row);

    Optional<VisitRow> visitById(UUID id);

    Optional<VisitRow> visitByIdForUpdate(UUID id);

    Optional<VisitRow> visitByAppointmentId(UUID appointmentId);

    void updateVisit(VisitRow row, long expectedVersion);

    List<VisitRow> searchVisits(UUID patientId, String status, int limit, int offset);

    void insertCheckIn(CheckInRow row);

    Optional<CheckInRow> checkInById(UUID id);

    Optional<CheckInRow> checkInByAppointmentId(UUID appointmentId);

    void insertEncounter(EncounterRow row);

    Optional<EncounterRow> encounterById(UUID id);

    Optional<EncounterRow> encounterByIdForUpdate(UUID id);

    List<EncounterRow> encountersByVisitId(UUID visitId);

    void updateEncounter(EncounterRow row, long expectedVersion);

    void insertEncounterParticipant(EncounterParticipantRow row);

    List<EncounterParticipantView> participantsByEncounterId(UUID encounterId);

    boolean isPractitionerRoleParticipant(UUID encounterId, UUID practitionerRoleId);

    List<EncounterRow> searchDoctorEncounters(UUID practitionerRoleId, LocalDate date, String status, int limit, int offset);

    List<EncounterRow> searchEncountersByPatient(UUID patientId, int limit, int offset);
}
