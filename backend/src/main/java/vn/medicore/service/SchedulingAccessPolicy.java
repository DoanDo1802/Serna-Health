package vn.medicore.service;

import java.util.List;
import java.util.UUID;
import vn.medicore.dto.AuthenticatedAccount;

public interface SchedulingAccessPolicy {

    void requirePatientAccess(AuthenticatedAccount actor, UUID patientId, String permission);

    boolean isAuthorizedStaff(AuthenticatedAccount actor, String permission);

    List<UUID> getAccessiblePatientIds(AuthenticatedAccount actor);
}
