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
        String cleanEmail = email != null && !email.isBlank() ? email.strip().toLowerCase(java.util.Locale.ROOT) : null;

        requireContact(cleanPhone, cleanEmail);
        PatientRow row = new PatientRow(id, fullName.strip(), dateOfBirth, cleanPhone, cleanEmail, declaredGender, address, toJson(emergencyContact), 0, now, now);
        store.insertPatient(row);
        audit.record(actorId, null, "patient.create", "SUCCEEDED", null, "Patient", id, 0L, null, ids.next().toString(), ids.next().toString());
        
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
    public PatientView createOwnPatient(String fullName, LocalDate dateOfBirth, String phone, String email, String declaredGender,
            String address, Map<String, Object> emergencyContact, UUID accountId) {
        PatientView patient = createPatient(fullName, dateOfBirth, phone, email, declaredGender, address, emergencyContact, accountId);
        Instant now = clock.instant();
        store.insertPatientAccountLink(new PatientAccountLinkRow(
                ids.next(), accountId, patient.id(), "OWN", "IDENTITY_VERIFIED", "{\"version\":1}", now, null,
                "ACTIVE", null, null, 0, now, now));
        audit.record(accountId, null, "patient.account_link.create", "SUCCEEDED", "OWN", "PatientAccountLink", patient.id(),
                0L, null, ids.next().toString(), ids.next().toString());
        return patient;
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
        
        CryptoService.NormalizedIdentifier normalized = crypto.normalize(identifierType, issuer, jurisdiction, value);
        String context = identifierContext(normalized);
        String protectedValue = crypto.encrypt(normalized.value(), context);
        String comparisonToken = crypto.comparisonToken(
                normalized.identifierType(), normalized.issuer(), normalized.jurisdiction(), normalized.value());
        String status = "SELF_DECLARED".equals(verificationSource) ? "SELF_DECLARED" : "STAFF_RECORDED";

        store.insertPatientIdentifier(new PatientIdentifierRow(
                id, patientId, normalized.identifierType(), normalized.issuer(), normalized.jurisdiction(), protectedValue,
                comparisonToken, normalized.displaySuffix(), status, verificationSource, actorId, now, null, now, null, null, 0));

        audit.record(actorId, null, "patient.identifier.create", "SUCCEEDED", null,
                "PatientIdentifier", id, 0L, null, ids.next().toString(), ids.next().toString());
        return store.patientIdentifierById(id).orElseThrow();
    }

    @Override
    public PatientIdentifierView verifyPatientIdentifierManually(UUID id, String evidenceReference, long version, UUID actorId) {
        PatientIdentifierView existing = store.patientIdentifierByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        if ("MANUALLY_VERIFIED".equals(existing.status())) {
            return existing;
        }
        
        Instant now = clock.instant();
        if (existing.version() != version) throw new vn.medicore.common.exception.StaleVersionException();
        if (!"SELF_DECLARED".equals(existing.status()) && !"STAFF_RECORDED".equals(existing.status())) {
            throw new IllegalStateException("Identifier cannot be manually verified from current state");
        }
        store.updatePatientIdentifier(new PatientIdentifierRow(
                id, existing.patientId(), existing.identifierType(), existing.issuer(), existing.jurisdiction(), null, null, null,
                "MANUALLY_VERIFIED", null, null, null, now, null, null, evidenceReference, version + 1), version);
        
        audit.record(actorId, null, "patient.identifier.verify", "SUCCEEDED", "evidence_reference_provided", "PatientIdentifier", id, version + 1, null, ids.next().toString(), ids.next().toString());
        
        return store.patientIdentifierById(id).orElseThrow();
    }

    @Override
    public PatientIdentifierView revokePatientIdentifier(UUID id, long version, UUID actorId) {
        PatientIdentifierView existing = store.patientIdentifierByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        Instant now = clock.instant();
        
        if (existing.version() != version) throw new vn.medicore.common.exception.StaleVersionException();
        if ("REVOKED".equals(existing.status()) || "ENTERED_IN_ERROR".equals(existing.status())) {
            throw new IllegalStateException("Identifier is already terminal");
        }
        store.updatePatientIdentifier(new PatientIdentifierRow(
                id, existing.patientId(), existing.identifierType(), existing.issuer(), existing.jurisdiction(), null, null, null,
                "REVOKED", null, null, null, null, null, now, existing.evidenceReference(), version + 1), version);
        
        audit.record(actorId, null, "patient.identifier.revoke", "SUCCEEDED", null, "PatientIdentifier", id, version + 1, null, ids.next().toString(), ids.next().toString());
        
        return store.patientIdentifierById(id).orElseThrow();
    }

    @Override
    public PatientIdentifierView enterPatientIdentifierInError(UUID id, String reason, long version, UUID actorId) {
        PatientIdentifierView existing = store.patientIdentifierByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        if (existing.version() != version) throw new vn.medicore.common.exception.StaleVersionException();
        if ("REVOKED".equals(existing.status()) || "ENTERED_IN_ERROR".equals(existing.status())) {
            throw new IllegalStateException("Identifier is already terminal");
        }
        store.updatePatientIdentifier(new PatientIdentifierRow(id, existing.patientId(), existing.identifierType(), existing.issuer(),
                existing.jurisdiction(), null, null, null, "ENTERED_IN_ERROR", null, null, null, null, null, null,
                existing.evidenceReference(), version + 1), version);
        audit.record(actorId, null, "patient.identifier.enter_in_error", "SUCCEEDED", "reason_provided", "PatientIdentifier",
                id, version + 1, null, ids.next().toString(), ids.next().toString());
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
        audit.record(actorId, null, "patient.account_link.create", "SUCCEEDED", relationship,
                "PatientAccountLink", id, 0L, null, ids.next().toString(), ids.next().toString());
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
        if (!"CONFIRMED".equals(status) && !"REJECTED".equals(status)) {
            throw new IllegalArgumentException("Review status must be CONFIRMED or REJECTED");
        }
        if (!"PENDING".equals(existing.status())) {
            throw new IllegalStateException("Only pending duplicate candidates may be reviewed");
        }
        if (existing.version() != version) throw new vn.medicore.common.exception.StaleVersionException();

        Instant now = clock.instant();
        store.updateDuplicateCandidate(new PatientDuplicateCandidateRow(id, existing.sourcePatientId(), existing.candidatePatientId(), null, null, null, null, status, actorId, now, reviewReason, version + 1, null, now), version);
        
        audit.record(actorId, null, "patient.duplicate.review", "SUCCEEDED", status + ": " + reviewReason, "PatientDuplicateCandidate", id, version + 1, null, ids.next().toString(), ids.next().toString());
        
        return store.duplicateCandidateById(id).orElseThrow();
    }
    
    @Override
    public PatientDuplicateCandidateView enterDuplicateCandidateInError(UUID id, String reason, long version, UUID actorId) {
        PatientDuplicateCandidateView existing = store.duplicateCandidateByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        if (existing.version() != version) throw new vn.medicore.common.exception.StaleVersionException();
        if (!"PENDING".equals(existing.status())) throw new IllegalStateException("Only pending candidate may enter error");
        Instant now = clock.instant();
        store.updateDuplicateCandidate(new PatientDuplicateCandidateRow(id, existing.sourcePatientId(), existing.candidatePatientId(),
                null, null, null, null, "ENTERED_IN_ERROR", null, null, null, version + 1, null, now), version);
        audit.record(actorId, null, "patient.duplicate.enter_in_error", "SUCCEEDED", "reason_provided",
                "PatientDuplicateCandidate", id, version + 1, null, ids.next().toString(), ids.next().toString());
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

    private static void requireContact(String phone, String email) {
        if (phone == null && email == null) throw new IllegalArgumentException("Patient requires phone or email contact");
    }

    private static String identifierContext(CryptoService.NormalizedIdentifier identifier) {
        return String.join("|", identifier.identifierType(), identifier.issuer(), identifier.jurisdiction());
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
