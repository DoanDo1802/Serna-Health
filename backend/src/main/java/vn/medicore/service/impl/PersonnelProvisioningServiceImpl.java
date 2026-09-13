package vn.medicore.service.impl;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.medicore.common.exception.ResourceNotFoundException;
import vn.medicore.common.exception.StaleVersionException;
import vn.medicore.common.utils.UuidV7Generator;
import vn.medicore.dto.IdentityAuditContext;
import vn.medicore.dto.IdentityModels.AccountView;
import vn.medicore.dto.IdentityModels.AssignmentView;
import vn.medicore.dto.PersonnelModels.DoctorProfile;
import vn.medicore.dto.PersonnelModels.PersonnelCommand;
import vn.medicore.dto.PersonnelModels.PersonnelPage;
import vn.medicore.dto.PersonnelModels.PersonnelView;
import vn.medicore.dto.SecurityAuditRecorder;
import vn.medicore.entity.AccountStatus;
import vn.medicore.entity.EmailAddress;
import vn.medicore.repository.CatalogRepository;
import vn.medicore.repository.CatalogRepository.PersonnelMemberRow;
import vn.medicore.repository.CatalogRepository.PractitionerProfileRow;
import vn.medicore.repository.CatalogRepository.PractitionerRoleRow;
import vn.medicore.repository.CatalogRepository.PractitionerRow;
import vn.medicore.repository.IdentityRepository;
import vn.medicore.repository.IdentityRepository.AccountRow;
import vn.medicore.service.PersonnelProvisioningService;
import org.springframework.security.crypto.password.PasswordEncoder;

@Service
@Transactional
public class PersonnelProvisioningServiceImpl implements PersonnelProvisioningService {

    private static final String DOCTOR = "DOCTOR";
    private static final String STAFF = "STAFF";
    private static final String RECEPTIONIST = "RECEPTIONIST";

    private final IdentityRepository identities;
    private final CatalogRepository catalog;
    private final PasswordPolicy passwordPolicy;
    private final PasswordEncoder passwordEncoder;
    private final SecurityAuditRecorder auditRecorder;
    private final Clock clock;
    private final UuidV7Generator ids;

    public PersonnelProvisioningServiceImpl(
            IdentityRepository identities,
            CatalogRepository catalog,
            PasswordPolicy passwordPolicy,
            PasswordEncoder passwordEncoder,
            SecurityAuditRecorder auditRecorder,
            Clock clock,
            UuidV7Generator ids) {
        this.identities = identities;
        this.catalog = catalog;
        this.passwordPolicy = passwordPolicy;
        this.passwordEncoder = passwordEncoder;
        this.auditRecorder = auditRecorder;
        this.clock = clock;
        this.ids = ids;
    }

    @Override
    public PersonnelView provision(PersonnelCommand command, IdentityAuditContext audit) {
        validate(command, true);
        passwordPolicy.validate(command.initialPassword());
        EmailAddress email = EmailAddress.of(command.email());
        Instant now = clock.instant();
        identities.lockScope("personnel-email:" + email.normalized());
        identities.lockScope("personnel-staff-code:" + command.staffCode().strip());
        if (DOCTOR.equals(command.type())) {
            identities.lockScope("personnel-license:" + command.doctorProfile().licenseNumber().strip());
        }
        if (identities.findAccountByEmailForUpdate(email.normalized()).isPresent()
                || staffCodeInUseByAnotherAccount(command.staffCode().strip(), null)) {
            throw new IllegalStateException("Personnel account or staff code already exists");
        }

        UUID accountId = ids.next();
        identities.insertAccount(new AccountRow(accountId, email.normalized(), email.display(), null,
                AccountStatus.ACTIVE.name(), 0, null, null, 0, now, now));
        identities.insertCredential(ids.next(), accountId, passwordEncoder.encode(command.initialPassword()), now);

        String roleCode = DOCTOR.equals(command.type()) ? DOCTOR : RECEPTIONIST;
        UUID roleId = identities.activeRoleByCode(roleCode).orElseThrow(ResourceNotFoundException::new).id();
        UUID assignmentId = ids.next();
        identities.insertAssignment(new AssignmentView(assignmentId, accountId, roleId,
                command.departmentId(), now, null, "ACTIVE", audit.actorAccountId(), "Personnel provisioned", 0));

        UUID practitionerId = null;
        UUID practitionerRoleId = null;
        if (DOCTOR.equals(command.type())) {
            catalog.departmentByIdForUpdate(command.departmentId()).filter(value -> value.active())
                    .orElseThrow(ResourceNotFoundException::new);
            practitionerId = ids.next();
            catalog.insertPractitioner(new PractitionerRow(practitionerId, accountId, command.staffCode().strip(),
                    command.fullName().strip(), true, 0, now, now));
            catalog.insertPractitionerProfile(profileRow(practitionerId, command.doctorProfile(), 0, now, now));
            practitionerRoleId = ids.next();
            catalog.insertPractitionerRole(new PractitionerRoleRow(practitionerRoleId, practitionerId,
                    command.departmentId(), DOCTOR, now, null, "ACTIVE", 0, now, now));
        } else {
            catalog.insertPersonnelMember(new PersonnelMemberRow(accountId, command.staffCode().strip(),
                    command.fullName().strip(), true, 0, now, now));
        }

        PersonnelView view = view(accountId, assignmentId, practitionerId, practitionerRoleId, now);
        record(audit, "personnel.provision", "Personnel", accountId, view.accountVersion(), "provisioned");
        return view;
    }

    @Override
    @Transactional(readOnly = true)
    public PersonnelPage list(String type, Boolean active, String cursor, int limit) {
        if (type != null && !DOCTOR.equals(type) && !STAFF.equals(type)) {
            throw new IllegalArgumentException("Personnel type is invalid");
        }
        int offset = offset(cursor);
        List<UUID> accountIds = catalog.listPersonnelAccountIds(type, active, limit + 1, offset);
        boolean hasMore = accountIds.size() > limit;
        List<UUID> pageAccountIds = hasMore ? accountIds.subList(0, limit) : accountIds;
        List<PersonnelView> items = pageAccountIds.stream()
                .map(accountId -> identities.findAccountById(accountId).flatMap(account -> maybeView(account.toView(), clock.instant())))
                .flatMap(Optional::stream)
                .toList();
        String next = hasMore ? encodeOffset(offset + pageAccountIds.size()) : null;
        return new PersonnelPage(List.copyOf(items), next, hasMore);
    }

    @Override
    @Transactional(readOnly = true)
    public PersonnelView get(UUID accountId) {
        AccountView account = identities.findAccountById(accountId).orElseThrow(ResourceNotFoundException::new).toView();
        return maybeView(account, clock.instant()).orElseThrow(ResourceNotFoundException::new);
    }

    @Override
    public PersonnelView update(UUID accountId, PersonnelCommand command, long accountVersion, IdentityAuditContext audit) {
        validate(command, false);
        AccountRow account = identities.findAccountByIdForUpdate(accountId).orElseThrow(ResourceNotFoundException::new);
        if (account.version() != accountVersion) throw new StaleVersionException();
        if (!AccountStatus.ACTIVE.name().equals(account.status())) {
            throw new IllegalStateException("Personnel account is not active");
        }
        PersonnelView existing = get(accountId);
        if (!existing.type().equals(command.type())) throw new IllegalArgumentException("Personnel type cannot change");
        Instant now = clock.instant();
        identities.lockScope("personnel-staff-code:" + command.staffCode().strip());
        if (DOCTOR.equals(command.type())) {
            identities.lockScope("personnel-license:" + command.doctorProfile().licenseNumber().strip());
            if (staffCodeInUseByAnotherAccount(command.staffCode().strip(), accountId)) {
                throw new IllegalStateException("Personnel staff code already exists");
            }
            var practitioner = catalog.practitionerByAccountId(accountId).orElseThrow(ResourceNotFoundException::new);
            catalog.departmentByIdForUpdate(command.departmentId()).filter(value -> value.active())
                    .orElseThrow(ResourceNotFoundException::new);
            catalog.updatePractitioner(new PractitionerRow(practitioner.id(), accountId, command.staffCode().strip(),
                    command.fullName().strip(), practitioner.active(), practitioner.version() + 1,
                    practitioner.createdAt(), now), practitioner.version());
            var profile = catalog.practitionerProfileByPractitionerId(practitioner.id()).orElseThrow(ResourceNotFoundException::new);
            catalog.updatePractitionerProfile(profileRow(practitioner.id(), command.doctorProfile(), profile.version() + 1,
                    profile.createdAt(), now), profile.version());
            var practitionerRole = currentDoctorRole(practitioner.id(), now)
                    .orElseThrow(ResourceNotFoundException::new);
            catalog.updatePractitionerRole(new PractitionerRoleRow(practitionerRole.id(), practitioner.id(), command.departmentId(),
                    DOCTOR, practitionerRole.effectiveFrom(), practitionerRole.effectiveTo(), practitionerRole.status(),
                    practitionerRole.version() + 1, practitionerRole.createdAt(), now), practitionerRole.version());
            var doctorAssignment = assignment(accountId, DOCTOR);
            identities.updateAssignmentDepartment(doctorAssignment.id(), command.departmentId(), doctorAssignment.version());
        } else {
            if (staffCodeInUseByAnotherAccount(command.staffCode().strip(), accountId)) {
                throw new IllegalStateException("Personnel staff code already exists");
            }
            var staff = catalog.personnelMemberByAccountId(accountId).orElseThrow(ResourceNotFoundException::new);
            catalog.updatePersonnelMember(new PersonnelMemberRow(accountId, command.staffCode().strip(), command.fullName().strip(),
                    staff.active(), staff.version() + 1, staff.createdAt(), now), staff.version());
        }
        AccountRow changed = new AccountRow(account.id(), account.normalizedEmail(), account.displayEmail(),
                account.emailVerifiedAt(), account.status(), account.failedLoginCount(), account.lockedUntil(),
                account.lastAuthenticatedAt(), account.version() + 1, account.createdAt(), now);
        if (identities.updateAccount(changed, account.version()) != 1) throw new StaleVersionException();
        PersonnelView view = get(accountId);
        record(audit, "personnel.update", "Personnel", accountId, view.accountVersion(), "updated");
        return view;
    }

    @Override
    public PersonnelView deactivate(UUID accountId, String reason, long accountVersion, IdentityAuditContext audit) {
        AccountRow account = identities.findAccountByIdForUpdate(accountId).orElseThrow(ResourceNotFoundException::new);
        if (account.version() != accountVersion) throw new StaleVersionException();
        if (!AccountStatus.ACTIVE.name().equals(account.status())) {
            throw new IllegalStateException("Personnel account is not active");
        }
        PersonnelView existing = get(accountId);
        Instant now = clock.instant();
        AccountRow disabled = new AccountRow(account.id(), account.normalizedEmail(), account.displayEmail(),
                account.emailVerifiedAt(), AccountStatus.DISABLED.name(), account.failedLoginCount(), null,
                account.lastAuthenticatedAt(), account.version() + 1, account.createdAt(), now);
        if (identities.updateAccount(disabled, account.version()) != 1) throw new StaleVersionException();
        identities.revokeCredentials(accountId, now, reason.strip());
        identities.revokeAllPendingTokens(accountId, now);
        identities.revokeAllSessions(accountId, now, reason.strip());
        identities.revokeActiveAssignments(accountId, audit.actorAccountId(), now, reason.strip());
        if (existing.practitionerId() != null) {
            var practitioner = catalog.practitionerByIdForUpdate(existing.practitionerId()).orElseThrow(ResourceNotFoundException::new);
            catalog.updatePractitioner(new PractitionerRow(practitioner.id(), practitioner.userAccountId(), practitioner.staffCode(),
                    practitioner.fullName(), false, practitioner.version() + 1, practitioner.createdAt(), now), practitioner.version());
            catalog.revokeActivePractitionerRoles(practitioner.id(), audit.actorAccountId(), now, reason.strip());
        } else {
            var staff = catalog.personnelMemberByAccountId(accountId).orElseThrow(ResourceNotFoundException::new);
            catalog.updatePersonnelMember(new PersonnelMemberRow(accountId, staff.staffCode(), staff.fullName(), false,
                    staff.version() + 1, staff.createdAt(), now), staff.version());
        }
        PersonnelView view = new PersonnelView(accountId, disabled.version(), existing.type(), disabled.displayEmail(),
                disabled.status(), existing.practitionerId(), existing.practitionerVersion(), existing.staffCode(),
                existing.fullName(), false, existing.departmentId(), existing.practitionerRoleId(),
                existing.accountRoleAssignmentId(), existing.doctorProfile(), now, existing.createdAt(), now);
        record(audit, "personnel.deactivate", "Personnel", accountId, view.accountVersion(), reason.strip());
        return view;
    }

    private Optional<PersonnelView> maybeView(AccountView account, Instant at) {
        var practitioner = catalog.practitionerByAccountId(account.id());
        if (practitioner.isPresent()) {
            var profile = catalog.practitionerProfileByPractitionerId(practitioner.get().id());
            if (profile.isEmpty()) return Optional.empty();
            boolean accountActive = AccountStatus.ACTIVE.name().equals(account.status());
            var role = accountActive
                    ? currentDoctorRole(practitioner.get().id(), at).orElse(null)
                    : latestDoctorRole(practitioner.get().id());
            var assignment = assignment(account.id(), DOCTOR, accountActive, at);
            if (role == null || assignment == null) return Optional.empty();
            return Optional.of(new PersonnelView(account.id(), account.version(), DOCTOR, account.displayEmail(), account.status(),
                    practitioner.get().id(), practitioner.get().version(), practitioner.get().staffCode(), practitioner.get().fullName(),
                    practitioner.get().active() && AccountStatus.ACTIVE.name().equals(account.status()), role.departmentId(), role.id(),
                    assignment.id(), profileView(profile.get()), deactivatedAt(account), account.createdAt(), account.updatedAt()));
        }
        var assignment = assignment(account.id(), RECEPTIONIST, AccountStatus.ACTIVE.name().equals(account.status()), at);
        var staff = catalog.personnelMemberByAccountId(account.id());
        if (assignment == null || staff.isEmpty()) return Optional.empty();
        return Optional.of(new PersonnelView(account.id(), account.version(), STAFF, account.displayEmail(), account.status(),
                null, null, staff.get().staffCode(), staff.get().fullName(),
                staff.get().active() && AccountStatus.ACTIVE.name().equals(account.status()), assignment.departmentId(), null,
                assignment.id(), null, deactivatedAt(account), account.createdAt(), account.updatedAt()));
    }

    private PersonnelView view(UUID accountId, UUID assignmentId, UUID practitionerId, UUID practitionerRoleId, Instant at) {
        AccountRow account = identities.findAccountById(accountId).orElseThrow();
        if (practitionerId != null) {
            var practitioner = catalog.practitionerById(practitionerId).orElseThrow();
            var role = catalog.practitionerRoleById(practitionerRoleId).orElseThrow();
            var profile = catalog.practitionerProfileByPractitionerId(practitionerId).orElseThrow();
            return new PersonnelView(accountId, account.version(), DOCTOR, account.displayEmail(), account.status(), practitionerId,
                    practitioner.version(), practitioner.staffCode(), practitioner.fullName(), practitioner.active(), role.departmentId(),
                    practitionerRoleId, assignmentId, profileView(profile), null, account.createdAt(), account.updatedAt());
        }
        var staff = catalog.personnelMemberByAccountId(accountId).orElseThrow();
        return new PersonnelView(accountId, account.version(), STAFF, account.displayEmail(), account.status(), null, null,
                staff.staffCode(), staff.fullName(), staff.active(), null, null, assignmentId, null, null,
                account.createdAt(), account.updatedAt());
    }

    private AssignmentView assignment(UUID accountId, String roleCode) {
        return assignment(accountId, roleCode, true, clock.instant());
    }

    private AssignmentView assignment(UUID accountId, String roleCode, boolean activeOnly, Instant at) {
        UUID roleId = identities.activeRoleByCode(roleCode).orElseThrow(ResourceNotFoundException::new).id();
        return identities.listAssignments(accountId, activeOnly ? "ACTIVE" : null, activeOnly ? at : null, 100, 0).stream()
                .filter(value -> value.roleId().equals(roleId))
                .max(java.util.Comparator.comparing(AssignmentView::effectiveFrom).thenComparing(AssignmentView::id))
                .orElse(null);
    }

    private Optional<vn.medicore.dto.CatalogModels.PractitionerRoleView> currentDoctorRole(UUID practitionerId, Instant at) {
        return catalog.listPractitionerRoles(practitionerId, null, "ACTIVE", 100, 0).stream()
                .filter(value -> DOCTOR.equals(value.roleCode()))
                .filter(value -> !at.isBefore(value.effectiveFrom()))
                .filter(value -> value.effectiveTo() == null || at.isBefore(value.effectiveTo()))
                .max(java.util.Comparator.comparing(vn.medicore.dto.CatalogModels.PractitionerRoleView::effectiveFrom)
                        .thenComparing(vn.medicore.dto.CatalogModels.PractitionerRoleView::id));
    }

    private vn.medicore.dto.CatalogModels.PractitionerRoleView latestDoctorRole(UUID practitionerId) {
        return catalog.listPractitionerRoles(practitionerId, null, null, 100, 0).stream()
                .filter(value -> DOCTOR.equals(value.roleCode()))
                .max(java.util.Comparator.comparing(vn.medicore.dto.CatalogModels.PractitionerRoleView::effectiveFrom)
                        .thenComparing(vn.medicore.dto.CatalogModels.PractitionerRoleView::id))
                .orElse(null);
    }

    private static PractitionerProfileRow profileRow(UUID practitionerId, DoctorProfile profile, long version, Instant createdAt, Instant updatedAt) {
        return new PractitionerProfileRow(practitionerId, profile.phone().strip(), profile.dateOfBirth(), profile.gender(),
                profile.address().strip(), profile.professionalTitle().strip(), profile.academicDegree().strip(),
                profile.specialtyDesignation().strip(), profile.licenseNumber().strip(), profile.licensingAuthority().strip(),
                profile.licenseIssuedOn(), profile.licenseExpiresOn(), profile.yearsExperience(), blankToNull(profile.biography()),
                blankToNull(profile.avatarUrl()), version, createdAt, updatedAt);
    }

    private static DoctorProfile profileView(PractitionerProfileRow value) {
        return new DoctorProfile(value.phone(), value.dateOfBirth(), value.gender(), value.address(), value.professionalTitle(),
                value.academicDegree(), value.specialtyDesignation(), value.licenseNumber(), value.licensingAuthority(),
                value.licenseIssuedOn(), value.licenseExpiresOn(), value.yearsExperience(), value.biography(), value.avatarUrl(),
                value.version(), value.createdAt(), value.updatedAt());
    }

    private static void validate(PersonnelCommand command, boolean creating) {
        if (command == null || (!DOCTOR.equals(command.type()) && !STAFF.equals(command.type()))) {
            throw new IllegalArgumentException("Personnel type is invalid");
        }
        if (creating && (command.email() == null || command.email().isBlank())) {
            throw new IllegalArgumentException("Email is required");
        }
        if (command.staffCode() == null || command.staffCode().isBlank() || command.fullName() == null || command.fullName().isBlank()) {
            throw new IllegalArgumentException("Staff code and full name are required");
        }
        if (creating && (command.initialPassword() == null || command.initialPassword().isBlank())) {
            throw new IllegalArgumentException("Initial password is required");
        }
        if (DOCTOR.equals(command.type())) {
            if (command.departmentId() == null || command.doctorProfile() == null) {
                throw new IllegalArgumentException("Doctor department and professional profile are required");
            }
            DoctorProfile profile = command.doctorProfile();
            if (profile.phone() == null || !profile.phone().matches("^\\+[1-9]\\d{7,14}$")
                    || profile.dateOfBirth() == null || !isGender(profile.gender())
                    || isBlank(profile.address()) || isBlank(profile.professionalTitle()) || isBlank(profile.academicDegree())
                    || isBlank(profile.specialtyDesignation()) || isBlank(profile.licenseNumber())
                    || isBlank(profile.licensingAuthority()) || profile.licenseIssuedOn() == null
                    || profile.yearsExperience() < 0 || profile.yearsExperience() > 80) {
                throw new IllegalArgumentException("Doctor professional profile is invalid");
            }
            if (profile.licenseExpiresOn() != null && !profile.licenseExpiresOn().isAfter(profile.licenseIssuedOn())) {
                throw new IllegalArgumentException("License expiry must be after issue date");
            }
        }
    }

    private static boolean isGender(String value) {
        return "MALE".equals(value) || "FEMALE".equals(value) || "OTHER".equals(value) || "UNSPECIFIED".equals(value);
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private boolean staffCodeInUseByAnotherAccount(String staffCode, UUID accountId) {
        boolean practitionerMatch = catalog.practitionerByStaffCode(staffCode)
                .map(value -> value.userAccountId() == null || !Objects.equals(value.userAccountId(), accountId))
                .orElse(false);
        boolean staffMatch = catalog.personnelMemberByStaffCode(staffCode)
                .map(value -> !Objects.equals(value.accountId(), accountId))
                .orElse(false);
        return practitionerMatch || staffMatch;
    }

    private static Instant deactivatedAt(AccountView account) {
        return AccountStatus.DISABLED.name().equals(account.status()) ? account.updatedAt() : null;
    }

    private void record(IdentityAuditContext audit, String action, String resourceType, UUID resourceId, long version, String reason) {
        auditRecorder.record(audit.actorAccountId(), audit.effectiveRoleSnapshot(), action, "SUCCEEDED", reason,
                resourceType, resourceId, version, audit.sessionId(), audit.requestId(), audit.correlationId());
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }

    private static int offset(String cursor) {
        if (cursor == null || cursor.isBlank()) return 0;
        try { return Integer.parseInt(new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8)); }
        catch (IllegalArgumentException exception) { throw new IllegalArgumentException("Cursor is invalid"); }
    }

    private static String encodeOffset(int offset) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(Integer.toString(offset).getBytes(StandardCharsets.UTF_8));
    }
}
