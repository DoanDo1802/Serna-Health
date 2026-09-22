package vn.medicore.service.impl;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import vn.medicore.dto.AuthenticatedAccount;
import vn.medicore.service.PatientService;
import vn.medicore.service.SchedulingAccessPolicy;

@Service
public class SchedulingAccessPolicyImpl implements SchedulingAccessPolicy {

    private final PatientService patientService;
    private final Clock clock;

    public SchedulingAccessPolicyImpl(PatientService patientService, Clock clock) {
        this.patientService = patientService;
        this.clock = clock;
    }

    @Override
    public void requirePatientAccess(AuthenticatedAccount actor, UUID patientId, String permission) {
        if (actor == null || patientId == null || !hasPatientAccess(actor, patientId, permission)) {
            throw new AccessDeniedException("Patient access is not granted");
        }
    }

    private boolean hasPatientAccess(AuthenticatedAccount actor, UUID patientId, String permission) {
        Instant now = clock.instant();
        return patientService.listAccountPatientLinks(actor.accountId()).stream()
                .anyMatch(link -> link.patientId().equals(patientId) && hasPatientAccess(link, permission, now));
    }

    private boolean hasPatientAccess(
            vn.medicore.dto.PatientModels.PatientAccountLinkView link, String permission, Instant now) {
        if (!"ACTIVE".equals(link.status())
                || now.isBefore(link.validFrom())
                || (link.validTo() != null && !now.isBefore(link.validTo()))) {
            return false;
        }
        if ("OWN".equals(link.relationship()) || "SELF".equals(link.relationship())) {
            return true;
        }
        boolean verified = "IDENTITY_VERIFIED".equals(link.verificationTier())
                || "REPRESENTATION_VERIFIED".equals(link.verificationTier());
        return verified && (Boolean.TRUE.equals(link.permissionScope().get(permission))
                || Boolean.TRUE.equals(link.permissionScope().get("patient.read")));
    }

    @Override
    public boolean isAuthorizedStaff(AuthenticatedAccount actor, String permission) {
        if (actor == null) {
            return false;
        }
        return actor.permissions().contains(permission)
                && (actor.permissions().contains("appointment_slot.update")
                || actor.permissions().contains("appointment_slot.create")
                || actor.permissions().contains("appointment_slot.cancel")
                || actor.permissions().contains("practitioner.read"));
    }

    @Override
    public List<UUID> getAccessiblePatientIds(AuthenticatedAccount actor) {
        if (actor == null) {
            return List.of();
        }
        Instant now = clock.instant();
        return patientService.listAccountPatientLinks(actor.accountId()).stream()
                .filter(link -> hasPatientAccess(link, "patient.read", now))
                .map(link -> link.patientId())
                .distinct()
                .toList();
    }
}
