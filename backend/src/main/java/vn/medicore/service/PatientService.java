package vn.medicore.service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import vn.medicore.dto.PatientModels.PatientAccountLinkView;
import vn.medicore.dto.PatientModels.PatientDuplicateCandidateView;
import vn.medicore.dto.PatientModels.PatientIdentifierView;
import vn.medicore.dto.PatientModels.PatientView;

public interface PatientService {

    // ---- Patient ----
    List<PatientView> searchPatients(String query, int limit, int offset);
    PatientView getPatient(UUID id);
    PatientView createPatient(String fullName, LocalDate dateOfBirth, String phone, String email, String declaredGender, String address, Map<String, Object> emergencyContact, UUID actorId);
    PatientView updatePatient(UUID id, String fullName, LocalDate dateOfBirth, String phone, String email, String declaredGender, String address, Map<String, Object> emergencyContact, long version, UUID actorId);

    // ---- PatientIdentifier ----
    List<PatientIdentifierView> listPatientIdentifiers(UUID patientId);
    PatientIdentifierView addPatientIdentifier(UUID patientId, String identifierType, String issuer, String jurisdiction, String value, String displaySuffix, String verificationSource, UUID actorId);
    PatientIdentifierView verifyPatientIdentifierManually(UUID id, String evidenceReference, long version, UUID actorId);
    PatientIdentifierView revokePatientIdentifier(UUID id, long version, UUID actorId);

    // ---- PatientAccountLink ----
    List<PatientAccountLinkView> listPatientAccountLinks(UUID patientId);
    List<PatientAccountLinkView> listAccountPatientLinks(UUID accountId);
    PatientAccountLinkView linkPatientAccount(UUID accountId, UUID patientId, String relationship, String verificationTier, Map<String, Object> permissionScope, Instant validFrom, Instant validTo, UUID actorId);

    // ---- PatientDuplicateCandidate ----
    List<PatientDuplicateCandidateView> listDuplicateCandidates(String status, int limit, int offset);
    PatientDuplicateCandidateView getDuplicateCandidate(UUID id);
    PatientDuplicateCandidateView reviewDuplicateCandidate(UUID id, String status, String reviewReason, long version, UUID actorId);
}
