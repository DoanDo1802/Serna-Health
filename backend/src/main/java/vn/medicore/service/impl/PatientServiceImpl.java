package vn.medicore.service.impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.medicore.common.exception.ResourceNotFoundException;
import vn.medicore.common.exception.StaleVersionException;
import vn.medicore.common.utils.UuidV7Generator;
import vn.medicore.dto.PatientAuditContext;
import vn.medicore.dto.PatientModels.Page;
import vn.medicore.dto.PatientModels.PatientAccountLinkView;
import vn.medicore.dto.PatientModels.PatientDuplicateCandidateView;
import vn.medicore.dto.PatientModels.PatientIdentifierView;
import vn.medicore.dto.PatientModels.PatientView;
import vn.medicore.dto.SecurityAuditRecorder;
import vn.medicore.repository.PatientRepository;
import vn.medicore.repository.PatientRepository.PatientAccountLinkRow;
import vn.medicore.repository.PatientRepository.PatientDuplicateCandidateRow;
import vn.medicore.repository.PatientRepository.PatientIdentifierRow;
import vn.medicore.repository.PatientRepository.PatientRow;
import vn.medicore.service.CryptoService;
import vn.medicore.service.PatientService;

@Service
@Transactional
public class PatientServiceImpl implements PatientService {

    private static final Set<String> RELATIONSHIPS = Set.of("OWN", "SELF", "PARENT", "CHILD", "SPOUSE", "GUARDIAN", "REPRESENTATIVE");
    private static final Set<String> TIERS = Set.of("PENDING", "IDENTITY_VERIFIED", "REPRESENTATION_VERIFIED");
    private static final Set<String> EMERGENCY_CONTACT_FIELDS = Set.of("version", "fullName", "phone", "relationship");

    private final PatientRepository store;
    private final CryptoService crypto;
    private final SecurityAuditRecorder audit;
    private final Clock clock;
    private final UuidV7Generator ids;
    private final ObjectMapper mapper;

    public PatientServiceImpl(
            PatientRepository store,
            CryptoService crypto,
            SecurityAuditRecorder audit,
            Clock clock,
            UuidV7Generator ids,
            ObjectMapper mapper) {
        this.store = store;
        this.crypto = crypto;
        this.audit = audit;
        this.clock = clock;
        this.ids = ids;
        this.mapper = mapper;
    }

    @Override
    @Transactional(readOnly = true)
    public Page<PatientView> searchPatients(String query, String cursor, int limit) {
        int offset = offset(cursor);
        return page(store.listPatients(query, limit + 1, offset), limit, offset);
    }

    @Override
    @Transactional(readOnly = true)
    public PatientView getPatient(UUID id) {
        return store.patientById(id).orElseThrow(ResourceNotFoundException::new);
    }

    @Override
    public PatientView createPatient(
            String fullName,
            LocalDate dateOfBirth,
            String phone,
            String email,
            String declaredGender,
            String address,
            Map<String, Object> emergencyContact,
            PatientAuditContext context) {
        PatientRow row = newPatientRow(fullName, dateOfBirth, phone, email, declaredGender, address, emergencyContact);
        store.insertPatient(row);
        PatientView view = store.patientById(row.id()).orElseThrow();
        record(context, view.id(), "patient.create", "Patient", view.id(), view.version(), "created");
        createDuplicateCandidates(view, clock.instant());
        return view;
    }

    @Override
    public PatientView createOwnPatient(
            String fullName,
            LocalDate dateOfBirth,
            String phone,
            String email,
            String declaredGender,
            String address,
            Map<String, Object> emergencyContact,
            PatientAuditContext context) {
        PatientView patient = createPatient(fullName, dateOfBirth, phone, email, declaredGender, address, emergencyContact, context);
        Instant now = clock.instant();
        store.insertPatientAccountLink(new PatientAccountLinkRow(ids.next(), context.actorAccountId(), patient.id(), "OWN",
                "PENDING", "{\"version\":1}", now, null, "ACTIVE", null, null, 0, now, now));
        PatientAccountLinkView link = store.listAccountPatientLinks(context.actorAccountId()).stream()
                .filter(value -> value.patientId().equals(patient.id()) && "OWN".equals(value.relationship()))
                .findFirst().orElseThrow();
        record(context, patient.id(), "patient_account_link.create", "PatientAccountLink", link.id(), link.version(), "own_link_created");
        return patient;
    }

    @Override
    public PatientView updatePatient(
            UUID id,
            String fullName,
            LocalDate dateOfBirth,
            String phone,
            String email,
            String declaredGender,
            String address,
            Map<String, Object> emergencyContact,
            long version,
            PatientAuditContext context) {
        PatientView existing = store.patientByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        validateDemographics(fullName, dateOfBirth, emergencyContact);
        Instant now = clock.instant();
        store.updatePatient(new PatientRow(id, fullName.strip(), dateOfBirth, cleanPhone(phone), cleanEmail(email),
                declaredGender, cleanNullable(address), toJson(emergencyContact), version + 1, existing.createdAt(), now), version);
        PatientView view = store.patientById(id).orElseThrow();
        record(context, view.id(), "patient.update", "Patient", view.id(), view.version(), "updated");
        createDuplicateCandidates(view, now);
        return view;
    }

    @Override
    @Transactional(readOnly = true)
    public Page<PatientIdentifierView> listPatientIdentifiers(UUID patientId, String cursor, int limit) {
        int offset = offset(cursor);
        return page(store.listPatientIdentifiers(patientId, limit + 1, offset), limit, offset);
    }

    @Override
    public PatientIdentifierView addPatientIdentifier(
            UUID patientId,
            String identifierType,
            String issuer,
            String jurisdiction,
            String value,
            String verificationSource,
            PatientAuditContext context) {
        store.patientById(patientId).orElseThrow(ResourceNotFoundException::new);
        Instant now = clock.instant();
        CryptoService.NormalizedIdentifier normalized = crypto.normalize(identifierType, issuer, jurisdiction, value);
        String contextValue = identifierContext(normalized);
        UUID identifierId = ids.next();
        String status = "SELF_DECLARED".equals(verificationSource) ? "SELF_DECLARED" : "STAFF_RECORDED";
        store.insertPatientIdentifier(new PatientIdentifierRow(identifierId, patientId, normalized.identifierType(),
                normalized.issuer(), normalized.jurisdiction(), crypto.encrypt(normalized.value(), contextValue),
                crypto.comparisonToken(normalized.identifierType(), normalized.issuer(), normalized.jurisdiction(), normalized.value()),
                normalized.displaySuffix(), status, verificationSource, context.actorAccountId(), now, null, now,
                null, null, 0));
        PatientIdentifierView view = store.patientIdentifierById(identifierId).orElseThrow();
        record(context, patientId, "patient_identifier.create", "PatientIdentifier", view.id(), view.version(), "created");
        return view;
    }

    @Override
    public PatientIdentifierView verifyPatientIdentifierManually(
            UUID id, String evidenceReference, long version, PatientAuditContext context) {
        PatientIdentifierView existing = store.patientIdentifierByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        if (existing.version() != version) throw new StaleVersionException();
        if (!"SELF_DECLARED".equals(existing.status()) && !"STAFF_RECORDED".equals(existing.status())) {
            throw new IllegalStateException("Identifier cannot be manually verified from current state");
        }
        Instant now = clock.instant();
        store.updatePatientIdentifier(identifierRow(existing, "MANUALLY_VERIFIED", now, null, evidenceReference, version + 1), version);
        PatientIdentifierView view = store.patientIdentifierById(id).orElseThrow();
        record(context, view.patientId(), "patient_identifier.verify", "PatientIdentifier", view.id(), view.version(), "evidence_reference_provided");
        return view;
    }

    @Override
    public PatientIdentifierView revokePatientIdentifier(
            UUID id, String reason, long version, PatientAuditContext context) {
        PatientIdentifierView existing = store.patientIdentifierByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        if (existing.version() != version) throw new StaleVersionException();
        requireActiveIdentifier(existing);
        Instant now = clock.instant();
        store.updatePatientIdentifier(identifierRow(existing, "REVOKED", null, now, existing.evidenceReference(), version + 1), version);
        PatientIdentifierView view = store.patientIdentifierById(id).orElseThrow();
        record(context, view.patientId(), "patient_identifier.revoke", "PatientIdentifier", view.id(), view.version(), "reason_provided");
        return view;
    }

    @Override
    public PatientIdentifierView enterPatientIdentifierInError(
            UUID id, String reason, long version, PatientAuditContext context) {
        PatientIdentifierView existing = store.patientIdentifierByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        if (existing.version() != version) throw new StaleVersionException();
        requireActiveIdentifier(existing);
        store.updatePatientIdentifier(identifierRow(existing, "ENTERED_IN_ERROR", null, null,
                existing.evidenceReference(), version + 1), version);
        PatientIdentifierView view = store.patientIdentifierById(id).orElseThrow();
        record(context, view.patientId(), "patient_identifier.enter_in_error", "PatientIdentifier", view.id(), view.version(), "reason_provided");
        return view;
    }

    @Override
    @Transactional(readOnly = true)
    public Page<PatientAccountLinkView> listPatientAccountLinks(UUID patientId, String cursor, int limit) {
        int offset = offset(cursor);
        return page(store.listPatientAccountLinks(patientId, limit + 1, offset), limit, offset);
    }

    @Override
    @Transactional(readOnly = true)
    public List<PatientAccountLinkView> listAccountPatientLinks(UUID accountId) {
        return store.listAccountPatientLinks(accountId);
    }

    @Override
    public PatientAccountLinkView linkPatientAccount(
            UUID accountId,
            UUID patientId,
            String relationship,
            String verificationTier,
            Map<String, Object> permissionScope,
            Instant validFrom,
            Instant validTo,
            PatientAuditContext context) {
        store.patientById(patientId).orElseThrow(ResourceNotFoundException::new);
        if (validTo != null && !validTo.isAfter(validFrom)) throw new IllegalArgumentException("valid_to must be after valid_from");
        if (!RELATIONSHIPS.contains(relationship) || !TIERS.contains(verificationTier)) {
            throw new IllegalArgumentException("Patient account link relationship or verification tier is invalid");
        }
        validatePermissionScope(permissionScope);
        if ("OWN".equals(relationship) && "REPRESENTATION_VERIFIED".equals(verificationTier)) {
            throw new IllegalArgumentException("OWN link may not assert representation verification");
        }
        Instant now = clock.instant();
        UUID id = ids.next();
        store.insertPatientAccountLink(new PatientAccountLinkRow(id, accountId, patientId, relationship, verificationTier,
                toJson(permissionScope), validFrom, validTo, "ACTIVE", null, null, 0, now, now));
        PatientAccountLinkView view = store.patientAccountLinkById(id).orElseThrow();
        record(context, patientId, "patient_account_link.create", "PatientAccountLink", view.id(), view.version(), "created");
        return view;
    }

    @Override
    @Transactional(readOnly = true)
    public Page<PatientDuplicateCandidateView> listDuplicateCandidates(String status, String cursor, int limit) {
        int offset = offset(cursor);
        return page(store.listDuplicateCandidates(status, limit + 1, offset), limit, offset);
    }

    @Override
    @Transactional(readOnly = true)
    public PatientDuplicateCandidateView getDuplicateCandidate(UUID id) {
        return store.duplicateCandidateById(id).orElseThrow(ResourceNotFoundException::new);
    }

    @Override
    public PatientDuplicateCandidateView reviewDuplicateCandidate(
            UUID id, String status, String reviewReason, long version, PatientAuditContext context) {
        PatientDuplicateCandidateView existing = store.duplicateCandidateByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        if (existing.version() != version) throw new StaleVersionException();
        if (!"PENDING".equals(existing.status()) || !("CONFIRMED".equals(status) || "REJECTED".equals(status))) {
            throw new IllegalStateException("Only pending duplicate candidates may be confirmed or rejected");
        }
        Instant now = clock.instant();
        store.updateDuplicateCandidate(new PatientDuplicateCandidateRow(id, existing.sourcePatientId(), existing.candidatePatientId(),
                null, null, null, null, status, context.actorAccountId(), now, reviewReason.strip(), version + 1,
                null, now), version);
        PatientDuplicateCandidateView view = store.duplicateCandidateById(id).orElseThrow();
        record(context, view.sourcePatientId(), "patient_duplicate.review", "PatientDuplicateCandidate", view.id(), view.version(), "reviewed");
        return view;
    }

    @Override
    public PatientDuplicateCandidateView enterDuplicateCandidateInError(
            UUID id, String reason, long version, PatientAuditContext context) {
        PatientDuplicateCandidateView existing = store.duplicateCandidateByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        if (existing.version() != version) throw new StaleVersionException();
        if (!"PENDING".equals(existing.status())) throw new IllegalStateException("Only pending candidate may enter error");
        Instant now = clock.instant();
        store.updateDuplicateCandidate(new PatientDuplicateCandidateRow(id, existing.sourcePatientId(), existing.candidatePatientId(),
                null, null, null, null, "ENTERED_IN_ERROR", null, null, null, version + 1, null, now), version);
        PatientDuplicateCandidateView view = store.duplicateCandidateById(id).orElseThrow();
        record(context, view.sourcePatientId(), "patient_duplicate.enter_in_error", "PatientDuplicateCandidate", view.id(), view.version(), "reason_provided");
        return view;
    }

    private PatientRow newPatientRow(
            String fullName, LocalDate dateOfBirth, String phone, String email, String declaredGender,
            String address, Map<String, Object> emergencyContact) {
        validateDemographics(fullName, dateOfBirth, emergencyContact);
        Instant now = clock.instant();
        return new PatientRow(ids.next(), fullName.strip(), dateOfBirth, cleanPhone(phone), cleanEmail(email), declaredGender,
                cleanNullable(address), toJson(emergencyContact), 0, now, now);
    }

    private void createDuplicateCandidates(PatientView patient, Instant now) {
        for (PatientView candidate : store.findDuplicatePatients(patient.phone(), patient.email(), patient.fullName(), patient.dateOfBirth())) {
            if (candidate.id().equals(patient.id())) continue;
            boolean samePhone = patient.phone() != null && patient.phone().equals(candidate.phone());
            boolean sameEmail = patient.email() != null && patient.email().equalsIgnoreCase(candidate.email());
            boolean sameNameDateOfBirth = patient.fullName().equalsIgnoreCase(candidate.fullName())
                    && patient.dateOfBirth().equals(candidate.dateOfBirth());
            if (!(samePhone || sameEmail || sameNameDateOfBirth)) continue;
            UUID low = patient.id().compareTo(candidate.id()) < 0 ? patient.id() : candidate.id();
            UUID high = patient.id().compareTo(candidate.id()) < 0 ? candidate.id() : patient.id();
            BigDecimal score = BigDecimal.valueOf(samePhone && sameNameDateOfBirth ? 0.95
                    : sameEmail && sameNameDateOfBirth ? 0.90 : samePhone || sameEmail ? 0.80 : 0.70);
            Map<String, Object> reasons = Map.of("phone", samePhone, "email", sameEmail, "nameDateOfBirth", sameNameDateOfBirth);
            store.insertDuplicateCandidate(new PatientDuplicateCandidateRow(ids.next(), patient.id(), candidate.id(), low, high,
                    toJson(reasons), score, "PENDING", null, null, null, 0, now, now));
        }
    }

    private static PatientIdentifierRow identifierRow(
            PatientIdentifierView existing, String status, Instant verifiedAt, Instant revokedAt,
            String evidenceReference, long version) {
        return new PatientIdentifierRow(existing.id(), existing.patientId(), existing.identifierType(), existing.issuer(),
                existing.jurisdiction(), null, null, null, status, existing.verificationSource(), null, null, verifiedAt,
                existing.effectiveFrom(), revokedAt, evidenceReference, version);
    }

    private static void requireActiveIdentifier(PatientIdentifierView value) {
        if ("REVOKED".equals(value.status()) || "ENTERED_IN_ERROR".equals(value.status())) {
            throw new IllegalStateException("Identifier is already terminal");
        }
    }

    private void record(PatientAuditContext context, UUID patientId, String action, String resourceType,
                        UUID resourceId, long version, String reason) {
        audit.record(context.actorAccountId(), context.permissionSnapshot(), patientId, action, "SUCCEEDED", reason,
                resourceType, resourceId, version, context.sessionId(), context.requestId(), context.correlationId());
    }

    private void validateDemographics(String fullName, LocalDate dateOfBirth, Map<String, Object> emergencyContact) {
        if (fullName == null || fullName.isBlank()) throw new IllegalArgumentException("Patient full name is required");
        if (dateOfBirth == null || dateOfBirth.isAfter(LocalDate.now(clock))) throw new IllegalArgumentException("Patient date of birth is invalid");
        if (emergencyContact == null) return;
        if (!emergencyContact.keySet().stream().allMatch(EMERGENCY_CONTACT_FIELDS::contains)
                || !Integer.valueOf(1).equals(emergencyContact.get("version"))) {
            throw new IllegalArgumentException("Emergency contact is invalid");
        }
    }

    private static void validatePermissionScope(Map<String, Object> scope) {
        if (scope == null || !Integer.valueOf(1).equals(scope.get("version"))
                || !scope.keySet().stream().allMatch(key -> "version".equals(key) || "patient.read".equals(key))
                || (scope.containsKey("patient.read") && !(scope.get("patient.read") instanceof Boolean))) {
            throw new IllegalArgumentException("Patient permission scope is invalid");
        }
    }

    private static String cleanPhone(String value) { return value == null || value.isBlank() ? null : value.strip(); }
    private static String cleanEmail(String value) { return value == null || value.isBlank() ? null : value.strip().toLowerCase(Locale.ROOT); }
    private static String cleanNullable(String value) { return value == null || value.isBlank() ? null : value.strip(); }
    private static String identifierContext(CryptoService.NormalizedIdentifier identifier) {
        return String.join("|", identifier.identifierType(), identifier.issuer(), identifier.jurisdiction());
    }

    private String toJson(Map<String, Object> value) {
        if (value == null) return null;
        try {
            return mapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Patient JSON is invalid", exception);
        }
    }

    private static int offset(String cursor) {
        if (cursor == null || cursor.isBlank()) return 0;
        try {
            int value = Integer.parseInt(new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8));
            if (value < 0) throw new IllegalArgumentException("Cursor is invalid");
            return value;
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("Cursor is invalid");
        }
    }

    private static <T> Page<T> page(List<T> values, int limit, int offset) {
        boolean hasMore = values.size() > limit;
        List<T> items = hasMore ? values.subList(0, limit) : values;
        String next = hasMore ? Base64.getUrlEncoder().withoutPadding()
                .encodeToString(Integer.toString(offset + items.size()).getBytes(StandardCharsets.UTF_8)) : null;
        return new Page<>(List.copyOf(items), next, hasMore);
    }
}
