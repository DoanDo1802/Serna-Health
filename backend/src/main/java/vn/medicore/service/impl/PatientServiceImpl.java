package vn.medicore.service.impl;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.medicore.common.exception.ResourceNotFoundException;
import vn.medicore.common.utils.UuidV7Generator;
import vn.medicore.dto.PatientModels.PatientAccountLinkView;
import vn.medicore.dto.PatientModels.PatientDuplicateCandidateView;
import vn.medicore.dto.PatientModels.PatientIdentifierView;
import vn.medicore.dto.PatientModels.PatientView;
import vn.medicore.repository.PatientRepository;
import vn.medicore.repository.PatientRepository.PatientAccountLinkRow;
import vn.medicore.repository.PatientRepository.PatientDuplicateCandidateRow;
import vn.medicore.repository.PatientRepository.PatientIdentifierRow;
import vn.medicore.repository.PatientRepository.PatientRow;
import vn.medicore.service.CryptoService;
import vn.medicore.service.PatientService;
import vn.medicore.dto.SecurityAuditRecorder;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
@Transactional
public class PatientServiceImpl implements PatientService {

    private final PatientRepository store;
    private final CryptoService crypto;
    private final SecurityAuditRecorder audit;
    private final Clock clock;
    private final UuidV7Generator ids;
    private final ObjectMapper mapper;

    public PatientServiceImpl(PatientRepository store, CryptoService crypto, SecurityAuditRecorder audit, Clock clock, UuidV7Generator ids, ObjectMapper mapper) {
        this.store = store;
        this.crypto = crypto;
        this.audit = audit;
        this.clock = clock;
        this.ids = ids;
        this.mapper = mapper;
    }

    // ===========================================================
    // Patient
    // ===========================================================

    @Override
    @Transactional(readOnly = true)
    public List<PatientView> searchPatients(String query, int limit, int offset) {
        return store.listPatients(query, limit, offset);
    }

    @Override
    @Transactional(readOnly = true)
    public PatientView getPatient(UUID id) {
        return store.patientById(id).orElseThrow(ResourceNotFoundException::new);
    }

    @Override
    public PatientView createPatient(String fullName, LocalDate dateOfBirth, String phone, String email, String declaredGender, String address, Map<String, Object> emergencyContact, UUID actorId) {
        Instant now = clock.instant();
        UUID id = ids.next();
        
        String cleanPhone = phone != null && !phone.isBlank() ? phone.strip() : null;
        String cleanEmail = email != null && !email.isBlank() ? email.strip().toLowerCase() : null;
        
        PatientRow row = new PatientRow(id, fullName.strip(), dateOfBirth, cleanPhone, cleanEmail, declaredGender, address, toJson(emergencyContact), 0, now, now);
        store.insertPatient(row);
        
        // MVP Duplicate Check Logic: find by phone or exactly matching name
        List<PatientView> potentialDuplicates = store.listPatients(cleanPhone != null ? cleanPhone : fullName.strip(), 5, 0);
        for (PatientView pd : potentialDuplicates) {
            if (pd.id().equals(id)) continue;
            
            boolean samePhone = cleanPhone != null && cleanPhone.equals(pd.phone());
            boolean sameNameAndDob = fullName.strip().equalsIgnoreCase(pd.fullName()) && dateOfBirth.equals(pd.dateOfBirth());
            
            if (samePhone || sameNameAndDob) {
                createDuplicateCandidate(id, pd.id(), samePhone, sameNameAndDob, now);
            }
        }
        
        return store.patientById(id).orElseThrow();
    }

    @Override
    public PatientView updatePatient(UUID id, String fullName, LocalDate dateOfBirth, String phone, String email, String declaredGender, String address, Map<String, Object> emergencyContact, long version, UUID actorId) {
        PatientView existing = store.patientByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        Instant now = clock.instant();
        
        String cleanPhone = phone != null && !phone.isBlank() ? phone.strip() : null;
        String cleanEmail = email != null && !email.isBlank() ? email.strip().toLowerCase() : null;
        
        store.updatePatient(new PatientRow(id, fullName.strip(), dateOfBirth, cleanPhone, cleanEmail, declaredGender, address, toJson(emergencyContact), version + 1, existing.createdAt(), now), version);
        
        audit.record(actorId, null, "patient.update", "SUCCEEDED", null, "Patient", id, version + 1, null, ids.next().toString(), ids.next().toString());
        
        return store.patientById(id).orElseThrow();
    }

    // ===========================================================
    // PatientIdentifier
    // ===========================================================

    @Override
    @Transactional(readOnly = true)
    public List<PatientIdentifierView> listPatientIdentifiers(UUID patientId) {
        return store.listPatientIdentifiers(patientId);
    }

    @Override
    public PatientIdentifierView addPatientIdentifier(UUID patientId, String identifierType, String issuer, String jurisdiction, String value, String displaySuffix, String verificationSource, UUID actorId) {
        store.patientById(patientId).orElseThrow(ResourceNotFoundException::new);
        
        Instant now = clock.instant();
        UUID id = ids.next();
        
        String protectedValue = crypto.encrypt(value);
        String comparisonToken = crypto.hashForComparison(value);
        String status = "SELF_DECLARED".equals(verificationSource) ? "SELF_DECLARED" : "STAFF_RECORDED";
        
        store.insertPatientIdentifier(new PatientIdentifierRow(id, patientId, identifierType, issuer, jurisdiction, protectedValue, comparisonToken, displaySuffix, status, verificationSource, actorId, now, null, now, null, null, 0));
        
        return store.patientIdentifierById(id).orElseThrow();
    }

    @Override
    public PatientIdentifierView verifyPatientIdentifierManually(UUID id, String evidenceReference, long version, UUID actorId) {
        PatientIdentifierView existing = store.patientIdentifierByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        if ("MANUALLY_VERIFIED".equals(existing.status())) {
            return existing;
        }
        
        Instant now = clock.instant();
        store.updatePatientIdentifier(new PatientIdentifierRow(id, existing.patientId(), existing.identifierType(), existing.issuer(), existing.jurisdiction(), null, null, null, "MANUALLY_VERIFIED", null, null, null, now, null, null, existing.evidenceReference(), version + 1), version);
        
        audit.record(actorId, null, "patient.identifier.verify", "SUCCEEDED", evidenceReference, "PatientIdentifier", id, version + 1, null, ids.next().toString(), ids.next().toString());
        
        return store.patientIdentifierById(id).orElseThrow();
    }

    @Override
    public PatientIdentifierView revokePatientIdentifier(UUID id, long version, UUID actorId) {
        PatientIdentifierView existing = store.patientIdentifierByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        Instant now = clock.instant();
        
        store.updatePatientIdentifier(new PatientIdentifierRow(id, existing.patientId(), existing.identifierType(), existing.issuer(), existing.jurisdiction(), null, null, null, "REVOKED", null, null, null, existing.verifiedAt(), null, now, existing.evidenceReference(), version + 1), version);
        
        audit.record(actorId, null, "patient.identifier.revoke", "SUCCEEDED", null, "PatientIdentifier", id, version + 1, null, ids.next().toString(), ids.next().toString());
        
        return store.patientIdentifierById(id).orElseThrow();
    }

    // ===========================================================
    // PatientAccountLink
    // ===========================================================

    @Override
    @Transactional(readOnly = true)
    public List<PatientAccountLinkView> listPatientAccountLinks(UUID patientId) {
        return store.listPatientAccountLinks(patientId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<PatientAccountLinkView> listAccountPatientLinks(UUID accountId) {
        return store.listAccountPatientLinks(accountId);
    }

    @Override
    public PatientAccountLinkView linkPatientAccount(UUID accountId, UUID patientId, String relationship, String verificationTier, Map<String, Object> permissionScope, Instant validFrom, Instant validTo, UUID actorId) {
        store.patientById(patientId).orElseThrow(ResourceNotFoundException::new);
        Instant now = clock.instant();
        UUID id = ids.next();
        
        if (validTo != null && !validTo.isAfter(validFrom)) {
            throw new IllegalArgumentException("valid_to must be after valid_from");
        }
        
        store.insertPatientAccountLink(new PatientAccountLinkRow(id, accountId, patientId, relationship, verificationTier, toJson(permissionScope), validFrom, validTo, "ACTIVE", null, null, 0, now, now));
        
        return store.patientAccountLinkById(id).orElseThrow();
    }

    // ===========================================================
    // PatientDuplicateCandidate
    // ===========================================================

    @Override
    @Transactional(readOnly = true)
    public List<PatientDuplicateCandidateView> listDuplicateCandidates(String status, int limit, int offset) {
        return store.listDuplicateCandidates(status, limit, offset);
    }

    @Override
    @Transactional(readOnly = true)
    public PatientDuplicateCandidateView getDuplicateCandidate(UUID id) {
        return store.duplicateCandidateById(id).orElseThrow(ResourceNotFoundException::new);
    }

    @Override
    public PatientDuplicateCandidateView reviewDuplicateCandidate(UUID id, String status, String reviewReason, long version, UUID actorId) {
        PatientDuplicateCandidateView existing = store.duplicateCandidateByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        if (!"CONFIRMED".equals(status) && !"REJECTED".equals(status) && !"ENTERED_IN_ERROR".equals(status)) {
            throw new IllegalArgumentException("Invalid review status");
        }
        
        Instant now = clock.instant();
        store.updateDuplicateCandidate(new PatientDuplicateCandidateRow(id, existing.sourcePatientId(), existing.candidatePatientId(), null, null, null, null, status, actorId, now, reviewReason, version + 1, null, now), version);
        
        audit.record(actorId, null, "patient.duplicate.review", "SUCCEEDED", status + ": " + reviewReason, "PatientDuplicateCandidate", id, version + 1, null, ids.next().toString(), ids.next().toString());
        
        return store.duplicateCandidateById(id).orElseThrow();
    }
    
    // ===========================================================
    // Helpers
    // ===========================================================

    private void createDuplicateCandidate(UUID p1, UUID p2, boolean samePhone, boolean sameNameDob, Instant now) {
        UUID low = p1.compareTo(p2) < 0 ? p1 : p2;
        UUID high = p1.compareTo(p2) > 0 ? p1 : p2;
        
        // Skip if already a pending candidate exists between them
        List<PatientDuplicateCandidateView> existing = store.findPendingCandidatesBySourceOrCandidate(p1);
        for (PatientDuplicateCandidateView view : existing) {
            if (view.sourcePatientId().equals(p2) || view.candidatePatientId().equals(p2)) return;
        }
        
        UUID id = ids.next();
        BigDecimal score = BigDecimal.valueOf(samePhone && sameNameDob ? 0.95 : (samePhone ? 0.8 : 0.7));
        Map<String, Object> reasons = Map.of("samePhone", samePhone, "sameNameDob", sameNameDob);
        
        store.insertDuplicateCandidate(new PatientDuplicateCandidateRow(id, p1, p2, low, high, toJson(reasons), score, "PENDING", null, null, null, 0, now, now));
    }

    private String toJson(Map<String, Object> map) {
        if (map == null) return null;
        try {
            return mapper.writeValueAsString(map);
        } catch (JsonProcessingException e) {
            throw new RuntimeException(e);
        }
    }
}
