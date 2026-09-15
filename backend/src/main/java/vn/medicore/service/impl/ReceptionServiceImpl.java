package vn.medicore.service.impl;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.medicore.common.exception.ResourceNotFoundException;
import vn.medicore.common.utils.UuidV7Generator;
import vn.medicore.dto.AuthenticatedAccount;
import vn.medicore.dto.CatalogModels.PractitionerRoleView;
import vn.medicore.dto.CatalogModels.PractitionerView;
import vn.medicore.dto.ClinicalModels.ClinicalNoteRow;
import vn.medicore.dto.ReceptionModels.CheckInAppointmentRequest;
import vn.medicore.dto.ReceptionModels.CheckInRow;
import vn.medicore.dto.ReceptionModels.CheckInView;
import vn.medicore.dto.ReceptionModels.EncounterPage;
import vn.medicore.dto.ReceptionModels.EncounterParticipantRow;
import vn.medicore.dto.ReceptionModels.EncounterParticipantView;
import vn.medicore.dto.ReceptionModels.EncounterRow;
import vn.medicore.dto.ReceptionModels.EncounterView;
import vn.medicore.dto.ReceptionModels.VisitPage;
import vn.medicore.dto.ReceptionModels.VisitRow;
import vn.medicore.dto.ReceptionModels.VisitView;
import vn.medicore.dto.SchedulingAuditContext;
import vn.medicore.dto.SchedulingModels.AppointmentRow;
import vn.medicore.dto.SchedulingModels.AppointmentSlotRow;
import vn.medicore.dto.SecurityAuditRecorder;
import vn.medicore.repository.CatalogRepository;
import vn.medicore.repository.ClinicalRepository;
import vn.medicore.repository.ReceptionRepository;
import vn.medicore.repository.SchedulingRepository;
import vn.medicore.service.ReceptionService;

@Service
@Transactional
public class ReceptionServiceImpl implements ReceptionService {

    private final ReceptionRepository receptionRepository;
    private final SchedulingRepository schedulingRepository;
    private final CatalogRepository catalogRepository;
    private final ClinicalRepository clinicalRepository;
    private final SecurityAuditRecorder securityAudit;
    private final UuidV7Generator ids;
    private final Clock clock;

    public ReceptionServiceImpl(
            ReceptionRepository receptionRepository,
            SchedulingRepository schedulingRepository,
            CatalogRepository catalogRepository,
            ClinicalRepository clinicalRepository,
            SecurityAuditRecorder securityAudit,
            UuidV7Generator ids,
            Clock clock) {
        this.receptionRepository = receptionRepository;
        this.schedulingRepository = schedulingRepository;
        this.catalogRepository = catalogRepository;
        this.clinicalRepository = clinicalRepository;
        this.securityAudit = securityAudit;
        this.ids = ids;
        this.clock = clock;
    }

    @Override
    public CheckInView checkInAppointment(
            UUID appointmentId,
            CheckInAppointmentRequest request,
            AuthenticatedAccount actor,
            SchedulingAuditContext auditContext) {
        Instant now = clock.instant();

        // Lock appointment
        AppointmentRow appointment = schedulingRepository.appointmentByIdForUpdate(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment not found"));

        if (!"CONFIRMED".equalsIgnoreCase(appointment.status())) {
            throw new IllegalStateException("Only CONFIRMED appointments can be checked in. Current status: " + appointment.status());
        }

        // Check if already checked in
        Optional<CheckInRow> existing = receptionRepository.checkInByAppointmentId(appointmentId);
        if (existing.isPresent()) {
            return toCheckInView(existing.get());
        }

        AppointmentSlotRow slot = schedulingRepository.appointmentSlotById(appointment.slotId())
                .orElseThrow(() -> new IllegalStateException("Associated appointment slot not found"));

        UUID visitId = ids.next();
        UUID checkInId = ids.next();
        UUID encounterId = ids.next();
        UUID participantId = ids.next();

        VisitRow visit = new VisitRow(visitId, appointment.patientId(), appointmentId, "ARRIVED", 0L, now, now);
        receptionRepository.insertVisit(visit);

        CheckInRow checkIn = new CheckInRow(
                checkInId, appointmentId, visitId, now, actor.accountId(),
                request != null ? request.notes() : null, 0L, now);
        receptionRepository.insertCheckIn(checkIn);

        EncounterRow encounter = new EncounterRow(
                encounterId, visitId, appointment.patientId(), slot.departmentId(),
                "PLANNED", null, null, 0L, now, now);
        receptionRepository.insertEncounter(encounter);

        EncounterParticipantRow participant = new EncounterParticipantRow(
                participantId, encounterId, slot.practitionerRoleId(), "PRIMARY_PERFORMER", "ACTIVE", now);
        receptionRepository.insertEncounterParticipant(participant);

        securityAudit.record(
                actor.accountId(), auditContext.permissionSnapshot(), appointment.patientId(),
                "checkin.execute", "SUCCEEDED", "CHECK_IN_EXECUTED", "CheckIn",
                checkInId, 0L, auditContext.sessionId(), auditContext.requestId(), auditContext.correlationId());

        return toCheckInView(checkIn);
    }

    @Override
    @Transactional(readOnly = true)
    public CheckInView getCheckIn(UUID checkInId, AuthenticatedAccount actor) {
        CheckInRow row = receptionRepository.checkInById(checkInId)
                .orElseThrow(() -> new ResourceNotFoundException("CheckIn not found"));
        return toCheckInView(row);
    }

    @Override
    @Transactional(readOnly = true)
    public VisitView getVisit(UUID visitId, AuthenticatedAccount actor) {
        VisitRow row = receptionRepository.visitById(visitId)
                .orElseThrow(() -> new ResourceNotFoundException("Visit not found"));
        return toVisitView(row);
    }

    @Override
    @Transactional(readOnly = true)
    public VisitPage listVisits(UUID patientId, String status, int limit, int offset, AuthenticatedAccount actor) {
        List<VisitRow> rows = receptionRepository.searchVisits(patientId, status, limit + 1, offset);
        boolean hasMore = rows.size() > limit;
        List<VisitView> items = rows.stream().limit(limit).map(this::toVisitView).toList();
        return new VisitPage(items, null, hasMore);
    }

    @Override
    public VisitView completeVisit(UUID visitId, long expectedVersion, AuthenticatedAccount actor, SchedulingAuditContext auditContext) {
        VisitRow visit = receptionRepository.visitByIdForUpdate(visitId)
                .orElseThrow(() -> new ResourceNotFoundException("Visit not found"));

        VisitRow updated = new VisitRow(
                visit.id(), visit.patientId(), visit.appointmentId(), "COMPLETED",
                visit.version(), visit.createdAt(), clock.instant());
        receptionRepository.updateVisit(updated, expectedVersion);

        securityAudit.record(
                actor.accountId(), auditContext.permissionSnapshot(), visit.patientId(),
                "visit.complete", "SUCCEEDED", "VISIT_COMPLETED", "Visit",
                visitId, visit.version() + 1, auditContext.sessionId(), auditContext.requestId(), auditContext.correlationId());

        return toVisitView(receptionRepository.visitById(visitId).orElseThrow());
    }

    @Override
    @Transactional(readOnly = true)
    public EncounterPage listVisitEncounters(UUID visitId, AuthenticatedAccount actor) {
        receptionRepository.visitById(visitId)
                .orElseThrow(() -> new ResourceNotFoundException("Visit not found"));
        List<EncounterRow> encounters = receptionRepository.encountersByVisitId(visitId);
        List<EncounterView> items = encounters.stream().map(this::toEncounterView).toList();
        return new EncounterPage(items, null, false);
    }

    @Override
    @Transactional(readOnly = true)
    public EncounterView getEncounter(UUID encounterId, AuthenticatedAccount actor) {
        EncounterRow encounter = receptionRepository.encounterById(encounterId)
                .orElseThrow(() -> new ResourceNotFoundException("Encounter not found"));
        verifyDoctorAccess(encounter, actor);
        return toEncounterView(encounter);
    }

    @Override
    public EncounterView startEncounter(UUID encounterId, long expectedVersion, AuthenticatedAccount actor, SchedulingAuditContext auditContext) {
        EncounterRow encounter = receptionRepository.encounterByIdForUpdate(encounterId)
                .orElseThrow(() -> new ResourceNotFoundException("Encounter not found"));

        verifyDoctorAccess(encounter, actor);

        if (!"PLANNED".equalsIgnoreCase(encounter.status())) {
            throw new IllegalStateException("Only PLANNED encounters can be started. Current status: " + encounter.status());
        }

        Instant now = clock.instant();
        EncounterRow updated = new EncounterRow(
                encounter.id(), encounter.visitId(), encounter.patientId(), encounter.departmentId(),
                "IN_PROGRESS", now, encounter.endAt(), encounter.version(), encounter.createdAt(), now);
        receptionRepository.updateEncounter(updated, expectedVersion);

        // Also transition Visit to IN_PROGRESS if it is currently ARRIVED
        receptionRepository.visitByIdForUpdate(encounter.visitId()).ifPresent(visit -> {
            if ("ARRIVED".equalsIgnoreCase(visit.status())) {
                receptionRepository.updateVisit(new VisitRow(
                        visit.id(), visit.patientId(), visit.appointmentId(), "IN_PROGRESS",
                        visit.version(), visit.createdAt(), now), visit.version());
            }
        });

        securityAudit.record(
                actor.accountId(), auditContext.permissionSnapshot(), encounter.patientId(),
                "encounter.start", "SUCCEEDED", "ENCOUNTER_STARTED", "Encounter",
                encounterId, encounter.version() + 1, auditContext.sessionId(), auditContext.requestId(), auditContext.correlationId());

        return toEncounterView(receptionRepository.encounterById(encounterId).orElseThrow());
    }

    @Override
    public EncounterView completeEncounter(UUID encounterId, long expectedVersion, AuthenticatedAccount actor, SchedulingAuditContext auditContext) {
        EncounterRow encounter = receptionRepository.encounterByIdForUpdate(encounterId)
                .orElseThrow(() -> new ResourceNotFoundException("Encounter not found"));

        verifyDoctorAccess(encounter, actor);

        if (!"IN_PROGRESS".equalsIgnoreCase(encounter.status())) {
            throw new IllegalStateException("Only IN_PROGRESS encounters can be completed. Current status: " + encounter.status());
        }

        // Canonical constraint: Required Examination ClinicalNote must be FINALIZED
        List<ClinicalNoteRow> notes = clinicalRepository.listClinicalNotesByEncounter(encounterId);
        boolean hasFinalizedExam = notes.stream().anyMatch(n ->
                "EXAMINATION".equalsIgnoreCase(n.noteType()) && "FINALIZED".equalsIgnoreCase(n.status()));
        if (!hasFinalizedExam) {
            throw new IllegalStateException("Examination clinical note must be FINALIZED before completing encounter");
        }

        Instant now = clock.instant();
        EncounterRow updated = new EncounterRow(
                encounter.id(), encounter.visitId(), encounter.patientId(), encounter.departmentId(),
                "COMPLETED", encounter.startAt(), now, encounter.version(), encounter.createdAt(), now);
        receptionRepository.updateEncounter(updated, expectedVersion);

        // Check if all encounters for this visit are completed
        List<EncounterRow> visitEncounters = receptionRepository.encountersByVisitId(encounter.visitId());
        boolean allCompleted = visitEncounters.stream().allMatch(e ->
                e.id().equals(encounterId) || "COMPLETED".equalsIgnoreCase(e.status()) || "CANCELLED".equalsIgnoreCase(e.status()));
        if (allCompleted) {
            receptionRepository.visitByIdForUpdate(encounter.visitId()).ifPresent(visit -> {
                if (!"COMPLETED".equalsIgnoreCase(visit.status())) {
                    receptionRepository.updateVisit(new VisitRow(
                            visit.id(), visit.patientId(), visit.appointmentId(), "COMPLETED",
                            visit.version(), visit.createdAt(), now), visit.version());
                }
            });
        }

        securityAudit.record(
                actor.accountId(), auditContext.permissionSnapshot(), encounter.patientId(),
                "encounter.complete", "SUCCEEDED", "ENCOUNTER_COMPLETED", "Encounter",
                encounterId, encounter.version() + 1, auditContext.sessionId(), auditContext.requestId(), auditContext.correlationId());

        return toEncounterView(receptionRepository.encounterById(encounterId).orElseThrow());
    }

    @Override
    @Transactional(readOnly = true)
    public EncounterPage searchDoctorEncounters(LocalDate date, String status, int limit, int offset, AuthenticatedAccount actor) {
        UUID practitionerRoleId = resolvePractitionerRoleId(actor);
        if (practitionerRoleId == null) {
            return new EncounterPage(List.of(), null, false);
        }
        List<EncounterRow> rows = receptionRepository.searchDoctorEncounters(practitionerRoleId, date, status, limit + 1, offset);
        boolean hasMore = rows.size() > limit;
        List<EncounterView> items = rows.stream().limit(limit).map(this::toEncounterView).toList();
        return new EncounterPage(items, null, hasMore);
    }

    private void verifyDoctorAccess(EncounterRow encounter, AuthenticatedAccount actor) {
        if (actor.permissions().contains("account.provision") || actor.permissions().contains("audit.read")) {
            return; // Admin / Auditor access
        }
        UUID roleId = resolvePractitionerRoleId(actor);
        if (roleId == null || !receptionRepository.isPractitionerRoleParticipant(encounter.id(), roleId)) {
            throw new ResourceNotFoundException("Encounter not found or inaccessible");
        }
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

    private CheckInView toCheckInView(CheckInRow row) {
        return new CheckInView(
                row.id(), row.version(), row.appointmentId(), row.visitId(),
                row.checkedInAt(), row.checkedInByAccountId(), row.notes(), row.createdAt());
    }

    private VisitView toVisitView(VisitRow row) {
        return new VisitView(
                row.id(), row.version(), row.patientId(), row.appointmentId(),
                row.status(), row.createdAt(), row.updatedAt());
    }

    private EncounterView toEncounterView(EncounterRow row) {
        List<EncounterParticipantView> participants = receptionRepository.participantsByEncounterId(row.id());
        return new EncounterView(
                row.id(), row.version(), row.visitId(), row.patientId(), row.departmentId(),
                row.status(), row.startAt(), row.endAt(), participants, row.createdAt(), row.updatedAt());
    }
}
