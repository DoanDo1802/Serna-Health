package vn.medicore.service;

import java.util.UUID;
import vn.medicore.dto.IdentityAuditContext;
import vn.medicore.dto.PersonnelModels.PersonnelCommand;
import vn.medicore.dto.PersonnelModels.PersonnelPage;
import vn.medicore.dto.PersonnelModels.PersonnelView;

public interface PersonnelProvisioningService {

    PersonnelView provision(PersonnelCommand command, IdentityAuditContext audit);

    PersonnelPage list(String type, Boolean active, String cursor, int limit);

    PersonnelView get(UUID accountId);

    PersonnelView update(UUID accountId, PersonnelCommand command, long accountVersion, IdentityAuditContext audit);

    PersonnelView deactivate(UUID accountId, String reason, long accountVersion, IdentityAuditContext audit);
}
