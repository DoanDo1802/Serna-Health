package vn.medicore.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class PersonnelModels {

    private PersonnelModels() {
    }

    public record DoctorProfile(
            String phone,
            LocalDate dateOfBirth,
            String gender,
            String address,
            String professionalTitle,
            String academicDegree,
            String specialtyDesignation,
            String licenseNumber,
            String licensingAuthority,
            LocalDate licenseIssuedOn,
            LocalDate licenseExpiresOn,
            int yearsExperience,
            String biography,
            String avatarUrl,
            long version,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record PersonnelCommand(
            String type,
            String email,
            String initialPassword,
            String staffCode,
            String fullName,
            UUID departmentId,
            DoctorProfile doctorProfile) {
    }

    public record PersonnelView(
            UUID accountId,
            long accountVersion,
            String type,
            String displayEmail,
            String accountStatus,
            UUID practitionerId,
            Long practitionerVersion,
            String staffCode,
            String fullName,
            boolean active,
            UUID departmentId,
            UUID practitionerRoleId,
            UUID accountRoleAssignmentId,
            DoctorProfile doctorProfile,
            Instant deactivatedAt,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record PersonnelPage(List<PersonnelView> items, String nextCursor, boolean hasMore) {
    }
}
