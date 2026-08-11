package vn.medicore.service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import vn.medicore.dto.PatientAuditContext;
import vn.medicore.dto.PatientModels.Page;
import vn.medicore.dto.PatientModels.PatientAccountLinkView;
import vn.medicore.dto.PatientModels.PatientDuplicateCandidateView;
import vn.medicore.dto.PatientModels.PatientIdentifierView;
import vn.medicore.dto.PatientModels.PatientView;

public interface PatientService {

    Page<PatientView> searchPatients(String query, String cursor, int limit);
    PatientView getPatient(UUID id);
    PatientView createPatient(String fullName, LocalDate dateOfBirth, String phone, String email,
                              String declaredGender, String address, Map<String, Object> emergencyContact,
                              PatientAuditContext context);
    PatientView createOwnPatient(String fullName, LocalDate dateOfBirth, String phone, String email,
                                 String declaredGender, String address, Map<String, Object> emergencyContact,
                                 PatientAuditContext context);
    PatientView updatePatient(UUID id, String fullName, LocalDate dateOfBirth, String phone, String email,
                              String declaredGender, String address, Map<String, Object> emergencyContact,
                              long version, PatientAuditContext context);

    Page<PatientIdentifierView> listPatientIdentifiers(UUID patientId, String cursor, int limit);
    PatientIdentifierView addPatientIdentifier(UUID patientId, String identifierType, String issuer,
                                               String jurisdiction, String value, String verificationSource,
                                               PatientAuditContext context);
    PatientIdentifierView verifyPatientIdentifierManually(UUID id, String evidenceReference, long version,
                                                          PatientAuditContext context);
    PatientIdentifierView revokePatientIdentifier(UUID id, String reason, long version, PatientAuditContext context);
    PatientIdentifierView enterPatientIdentifierInError(UUID id, String reason, long version,
                                                        PatientAuditContext context);

    Page<PatientAccountLinkView> listPatientAccountLinks(UUID patientId, String cursor, int limit);
    List<PatientAccountLinkView> listAccountPatientLinks(UUID accountId);
    PatientAccountLinkView linkPatientAccount(UUID accountId, UUID patientId, String relationship,
                                              String verificationTier, Map<String, Object> permissionScope,
                                              Instant validFrom, Instant validTo, PatientAuditContext context);

    Page<PatientDuplicateCandidateView> listDuplicateCandidates(String status, String cursor, int limit);
    PatientDuplicateCandidateView getDuplicateCandidate(UUID id);
    PatientDuplicateCandidateView reviewDuplicateCandidate(UUID id, String status, String reviewReason,
                                                           long version, PatientAuditContext context);
    PatientDuplicateCandidateView enterDuplicateCandidateInError(UUID id, String reason, long version,
                                                                  PatientAuditContext context);
}
