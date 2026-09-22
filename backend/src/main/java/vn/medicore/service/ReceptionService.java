package vn.medicore.service;

import java.time.LocalDate;
import java.util.UUID;
import vn.medicore.dto.AuthenticatedAccount;
import vn.medicore.dto.ReceptionModels.CheckInAppointmentRequest;
import vn.medicore.dto.ReceptionModels.CheckInView;
import vn.medicore.dto.ReceptionModels.EncounterPage;
import vn.medicore.dto.ReceptionModels.EncounterView;
import vn.medicore.dto.ReceptionModels.VisitPage;
import vn.medicore.dto.ReceptionModels.VisitView;
import vn.medicore.dto.SchedulingAuditContext;

public interface ReceptionService {

    CheckInView checkInAppointment(
            UUID appointmentId,
            CheckInAppointmentRequest request,
            AuthenticatedAccount actor,
            SchedulingAuditContext auditContext);

    CheckInView getCheckIn(UUID checkInId, AuthenticatedAccount actor);

    VisitView getVisit(UUID visitId, AuthenticatedAccount actor);

    VisitPage listVisits(UUID patientId, String status, int limit, int offset, AuthenticatedAccount actor);

    VisitView completeVisit(UUID visitId, long expectedVersion, AuthenticatedAccount actor, SchedulingAuditContext auditContext);

    EncounterPage listVisitEncounters(UUID visitId, AuthenticatedAccount actor);

    EncounterView getEncounter(UUID encounterId, AuthenticatedAccount actor);

    EncounterView startEncounter(UUID encounterId, long expectedVersion, AuthenticatedAccount actor, SchedulingAuditContext auditContext);

    EncounterView completeEncounter(UUID encounterId, long expectedVersion, AuthenticatedAccount actor, SchedulingAuditContext auditContext);

    EncounterPage searchDoctorEncounters(LocalDate date, String status, int limit, int offset, AuthenticatedAccount actor);
}
