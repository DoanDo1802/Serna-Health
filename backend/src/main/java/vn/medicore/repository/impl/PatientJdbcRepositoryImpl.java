package vn.medicore.repository.impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import vn.medicore.common.exception.StaleVersionException;
import vn.medicore.dto.PatientModels.PatientAccountLinkView;
import vn.medicore.dto.PatientModels.PatientDuplicateCandidateView;
import vn.medicore.dto.PatientModels.PatientIdentifierView;
import vn.medicore.dto.PatientModels.PatientView;
import vn.medicore.repository.PatientRepository;

@Repository
public class PatientJdbcRepositoryImpl implements PatientRepository {

    private final NamedParameterJdbcTemplate jdbc;
    private final ObjectMapper mapper;
    
    private final RowMapper<PatientView> patientMapper = this::mapPatient;
    private final RowMapper<PatientIdentifierView> identifierMapper = this::mapIdentifier;
    private final RowMapper<PatientAccountLinkView> accountLinkMapper = this::mapAccountLink;
    private final RowMapper<PatientDuplicateCandidateView> duplicateCandidateMapper = this::mapDuplicateCandidate;

    public PatientJdbcRepositoryImpl(NamedParameterJdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    // ===========================================================
    // Patient
    // ===========================================================

    @Override
    public List<PatientView> listPatients(String query, int limit, int offset) {
        StringBuilder sql = new StringBuilder("SELECT * FROM patient");
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("limit", limit)
                .addValue("offset", offset);
                
        if (query != null && !query.isBlank()) {
            sql.append(" WHERE full_name ILIKE :query OR phone = :exactQuery");
            params.addValue("query", "%" + query.trim() + "%");
            params.addValue("exactQuery", query.trim());
        }
        
        sql.append(" ORDER BY created_at DESC LIMIT :limit OFFSET :offset");
        return jdbc.query(sql.toString(), params, patientMapper);
    }

    @Override
    public Optional<PatientView> patientById(UUID id) {
        return queryOne("SELECT * FROM patient WHERE id = :id",
                new MapSqlParameterSource("id", id), patientMapper);
    }

    @Override
    public Optional<PatientView> patientByIdForUpdate(UUID id) {
        return queryOne("SELECT * FROM patient WHERE id = :id FOR UPDATE",
                new MapSqlParameterSource("id", id), patientMapper);
    }

    @Override
    public void insertPatient(PatientRow row) {
        jdbc.update("INSERT INTO patient (id, full_name, date_of_birth, phone, email, declared_gender, address, emergency_contact, version, created_at, updated_at) " +
                        "VALUES (:id, :fullName, :dob, :phone, :email, :gender, :address, :emergencyContact::jsonb, :version, :createdAt, :updatedAt)",
                new MapSqlParameterSource()
                        .addValue("id", row.id())
                        .addValue("fullName", row.fullName())
                        .addValue("dob", row.dateOfBirth())
                        .addValue("phone", row.phone())
                        .addValue("email", row.email())
                        .addValue("gender", row.declaredGender())
                        .addValue("address", row.address())
                        .addValue("emergencyContact", row.emergencyContactJson())
                        .addValue("version", row.version())
                        .addValue("createdAt", ts(row.createdAt()))
                        .addValue("updatedAt", ts(row.updatedAt())));
    }

    @Override
    public void updatePatient(PatientRow row, long expectedVersion) {
        int rows = jdbc.update("UPDATE patient SET full_name = :fullName, date_of_birth = :dob, phone = :phone, email = :email, " +
                        "declared_gender = :gender, address = :address, emergency_contact = :emergencyContact::jsonb, " +
                        "version = :newVersion, updated_at = :updatedAt " +
                        "WHERE id = :id AND version = :expectedVersion",
                new MapSqlParameterSource()
                        .addValue("id", row.id())
                        .addValue("fullName", row.fullName())
                        .addValue("dob", row.dateOfBirth())
                        .addValue("phone", row.phone())
                        .addValue("email", row.email())
                        .addValue("gender", row.declaredGender())
                        .addValue("address", row.address())
                        .addValue("emergencyContact", row.emergencyContactJson())
                        .addValue("newVersion", row.version())
                        .addValue("updatedAt", ts(row.updatedAt()))
                        .addValue("expectedVersion", expectedVersion));
        if (rows == 0) throw new StaleVersionException();
    }

    // ===========================================================
    // PatientIdentifier
    // ===========================================================

    @Override
    public List<PatientIdentifierView> listPatientIdentifiers(UUID patientId) {
        return jdbc.query("SELECT * FROM patient_identifier WHERE patient_id = :patientId ORDER BY effective_from DESC",
                new MapSqlParameterSource("patientId", patientId), identifierMapper);
    }

    @Override
    public Optional<PatientIdentifierView> patientIdentifierById(UUID id) {
        return queryOne("SELECT * FROM patient_identifier WHERE id = :id",
                new MapSqlParameterSource("id", id), identifierMapper);
    }

    @Override
    public Optional<PatientIdentifierView> patientIdentifierByIdForUpdate(UUID id) {
        return queryOne("SELECT * FROM patient_identifier WHERE id = :id FOR UPDATE",
                new MapSqlParameterSource("id", id), identifierMapper);
    }

    @Override
    public void insertPatientIdentifier(PatientIdentifierRow row) {
        jdbc.update("INSERT INTO patient_identifier (id, patient_id, identifier_type, issuer, jurisdiction, protected_value, comparison_token, display_suffix, status, verification_source, collected_by_account_id, collected_at, verified_at, effective_from, revoked_at, evidence_reference, version) " +
                        "VALUES (:id, :patientId, :type, :issuer, :jurisdiction, :protectedValue, :comparisonToken, :displaySuffix, :status, :source, :collectedBy, :collectedAt, :verifiedAt, :effectiveFrom, :revokedAt, :evidence, :version)",
                new MapSqlParameterSource()
                        .addValue("id", row.id())
                        .addValue("patientId", row.patientId())
                        .addValue("type", row.identifierType())
                        .addValue("issuer", row.issuer())
                        .addValue("jurisdiction", row.jurisdiction())
                        .addValue("protectedValue", row.protectedValue())
                        .addValue("comparisonToken", row.comparisonToken())
                        .addValue("displaySuffix", row.displaySuffix())
                        .addValue("status", row.status())
                        .addValue("source", row.verificationSource())
                        .addValue("collectedBy", row.collectedByAccountId())
                        .addValue("collectedAt", ts(row.collectedAt()))
                        .addValue("verifiedAt", ts(row.verifiedAt()))
                        .addValue("effectiveFrom", ts(row.effectiveFrom()))
                        .addValue("revokedAt", ts(row.revokedAt()))
                        .addValue("evidence", row.evidenceReference())
                        .addValue("version", row.version()));
    }

    @Override
    public void updatePatientIdentifier(PatientIdentifierRow row, long expectedVersion) {
        int rows = jdbc.update("UPDATE patient_identifier SET status = :status, verified_at = :verifiedAt, revoked_at = :revokedAt, evidence_reference = :evidence, version = :newVersion " +
                        "WHERE id = :id AND version = :expectedVersion",
                new MapSqlParameterSource()
                        .addValue("id", row.id())
                        .addValue("status", row.status())
                        .addValue("verifiedAt", ts(row.verifiedAt()))
                        .addValue("revokedAt", ts(row.revokedAt()))
                        .addValue("evidence", row.evidenceReference())
                        .addValue("newVersion", row.version())
                        .addValue("expectedVersion", expectedVersion));
        if (rows == 0) throw new StaleVersionException();
    }

    // ===========================================================
    // PatientAccountLink
    // ===========================================================

    @Override
    public List<PatientAccountLinkView> listPatientAccountLinks(UUID patientId) {
        return jdbc.query("SELECT * FROM patient_account_link WHERE patient_id = :patientId ORDER BY valid_from DESC",
                new MapSqlParameterSource("patientId", patientId), accountLinkMapper);
    }

    @Override
    public List<PatientAccountLinkView> listAccountPatientLinks(UUID accountId) {
        return jdbc.query("SELECT * FROM patient_account_link WHERE account_id = :accountId ORDER BY valid_from DESC",
                new MapSqlParameterSource("accountId", accountId), accountLinkMapper);
    }

    @Override
    public Optional<PatientAccountLinkView> patientAccountLinkById(UUID id) {
        return queryOne("SELECT * FROM patient_account_link WHERE id = :id",
                new MapSqlParameterSource("id", id), accountLinkMapper);
    }

    @Override
    public Optional<PatientAccountLinkView> patientAccountLinkByIdForUpdate(UUID id) {
        return queryOne("SELECT * FROM patient_account_link WHERE id = :id FOR UPDATE",
                new MapSqlParameterSource("id", id), accountLinkMapper);
    }

    @Override
    public void insertPatientAccountLink(PatientAccountLinkRow row) {
        jdbc.update("INSERT INTO patient_account_link (id, account_id, patient_id, relationship, verification_tier, permission_scope, valid_from, valid_to, status, revoked_at, revoke_reason, version, created_at, updated_at) " +
                        "VALUES (:id, :accountId, :patientId, :relationship, :tier, :scope::jsonb, :validFrom, :validTo, :status, :revokedAt, :revokeReason, :version, :createdAt, :updatedAt)",
                new MapSqlParameterSource()
                        .addValue("id", row.id())
                        .addValue("accountId", row.accountId())
                        .addValue("patientId", row.patientId())
                        .addValue("relationship", row.relationship())
                        .addValue("tier", row.verificationTier())
                        .addValue("scope", row.permissionScopeJson())
                        .addValue("validFrom", ts(row.validFrom()))
                        .addValue("validTo", ts(row.validTo()))
                        .addValue("status", row.status())
                        .addValue("revokedAt", ts(row.revokedAt()))
                        .addValue("revokeReason", row.revokeReason())
                        .addValue("version", row.version())
                        .addValue("createdAt", ts(row.createdAt()))
                        .addValue("updatedAt", ts(row.updatedAt())));
    }

    @Override
    public void updatePatientAccountLink(PatientAccountLinkRow row, long expectedVersion) {
        int rows = jdbc.update("UPDATE patient_account_link SET status = :status, valid_to = :validTo, revoked_at = :revokedAt, revoke_reason = :revokeReason, version = :newVersion, updated_at = :updatedAt " +
                        "WHERE id = :id AND version = :expectedVersion",
                new MapSqlParameterSource()
                        .addValue("id", row.id())
                        .addValue("status", row.status())
                        .addValue("validTo", ts(row.validTo()))
                        .addValue("revokedAt", ts(row.revokedAt()))
                        .addValue("revokeReason", row.revokeReason())
                        .addValue("newVersion", row.version())
                        .addValue("updatedAt", ts(row.updatedAt()))
                        .addValue("expectedVersion", expectedVersion));
        if (rows == 0) throw new StaleVersionException();
    }

    // ===========================================================
    // PatientDuplicateCandidate
    // ===========================================================

    @Override
    public List<PatientDuplicateCandidateView> listDuplicateCandidates(String status, int limit, int offset) {
        StringBuilder sql = new StringBuilder("SELECT * FROM patient_duplicate_candidate");
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("limit", limit)
                .addValue("offset", offset);
                
        if (status != null && !status.isBlank()) {
            sql.append(" WHERE status = :status");
            params.addValue("status", status);
        }
        
        sql.append(" ORDER BY created_at ASC LIMIT :limit OFFSET :offset");
        return jdbc.query(sql.toString(), params, duplicateCandidateMapper);
    }

    @Override
    public Optional<PatientDuplicateCandidateView> duplicateCandidateById(UUID id) {
        return queryOne("SELECT * FROM patient_duplicate_candidate WHERE id = :id",
                new MapSqlParameterSource("id", id), duplicateCandidateMapper);
    }

    @Override
    public Optional<PatientDuplicateCandidateView> duplicateCandidateByIdForUpdate(UUID id) {
        return queryOne("SELECT * FROM patient_duplicate_candidate WHERE id = :id FOR UPDATE",
                new MapSqlParameterSource("id", id), duplicateCandidateMapper);
    }

    @Override
    public void insertDuplicateCandidate(PatientDuplicateCandidateRow row) {
        jdbc.update("INSERT INTO patient_duplicate_candidate (id, source_patient_id, candidate_patient_id, ordered_patient_low_id, ordered_patient_high_id, match_reasons, score, status, reviewer_account_id, reviewed_at, review_reason, version, created_at, updated_at) " +
                        "VALUES (:id, :sourceId, :candidateId, :lowId, :highId, :matchReasons::jsonb, :score, :status, :reviewerId, :reviewedAt, :reviewReason, :version, :createdAt, :updatedAt)",
                new MapSqlParameterSource()
                        .addValue("id", row.id())
                        .addValue("sourceId", row.sourcePatientId())
                        .addValue("candidateId", row.candidatePatientId())
                        .addValue("lowId", row.orderedPatientLowId())
                        .addValue("highId", row.orderedPatientHighId())
                        .addValue("matchReasons", row.matchReasonsJson())
                        .addValue("score", row.score())
                        .addValue("status", row.status())
                        .addValue("reviewerId", row.reviewerAccountId())
                        .addValue("reviewedAt", ts(row.reviewedAt()))
                        .addValue("reviewReason", row.reviewReason())
                        .addValue("version", row.version())
                        .addValue("createdAt", ts(row.createdAt()))
                        .addValue("updatedAt", ts(row.updatedAt())));
    }

    @Override
    public void updateDuplicateCandidate(PatientDuplicateCandidateRow row, long expectedVersion) {
        int rows = jdbc.update("UPDATE patient_duplicate_candidate SET status = :status, reviewer_account_id = :reviewerId, reviewed_at = :reviewedAt, review_reason = :reviewReason, version = :newVersion, updated_at = :updatedAt " +
                        "WHERE id = :id AND version = :expectedVersion",
                new MapSqlParameterSource()
                        .addValue("id", row.id())
                        .addValue("status", row.status())
                        .addValue("reviewerId", row.reviewerAccountId())
                        .addValue("reviewedAt", ts(row.reviewedAt()))
                        .addValue("reviewReason", row.reviewReason())
                        .addValue("newVersion", row.version())
                        .addValue("updatedAt", ts(row.updatedAt()))
                        .addValue("expectedVersion", expectedVersion));
        if (rows == 0) throw new StaleVersionException();
    }

    @Override
    public List<PatientDuplicateCandidateView> findPendingCandidatesBySourceOrCandidate(UUID patientId) {
        return jdbc.query("SELECT * FROM patient_duplicate_candidate WHERE status = 'PENDING' AND (source_patient_id = :id OR candidate_patient_id = :id)",
                new MapSqlParameterSource("id", patientId), duplicateCandidateMapper);
    }

    // ===========================================================
    // Mappers & Utilities
    // ===========================================================

    private <T> Optional<T> queryOne(String sql, MapSqlParameterSource params, RowMapper<T> mapper) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(sql, params, mapper));
        } catch (DataAccessException e) {
            return Optional.empty();
        }
    }

    private PatientView mapPatient(ResultSet rs, int rowNum) throws SQLException {
        return new PatientView(
                rs.getObject("id", UUID.class),
                rs.getLong("version"),
                rs.getString("full_name"),
                rs.getObject("date_of_birth", LocalDate.class),
                rs.getString("phone"),
                rs.getString("email"),
                rs.getString("declared_gender"),
                rs.getString("address"),
                parseJsonMap(rs.getString("emergency_contact")),
                instant(rs, "created_at"),
                instant(rs, "updated_at")
        );
    }

    private PatientIdentifierView mapIdentifier(ResultSet rs, int rowNum) throws SQLException {
        return new PatientIdentifierView(
                rs.getObject("id", UUID.class),
                rs.getLong("version"),
                rs.getObject("patient_id", UUID.class),
                rs.getString("identifier_type"),
                rs.getString("issuer"),
                rs.getString("jurisdiction"),
                rs.getString("display_suffix"),
                rs.getString("status"),
                rs.getString("verification_source"),
                rs.getObject("collected_by_account_id", UUID.class),
                instantNullable(rs, "collected_at"),
                instantNullable(rs, "verified_at"),
                instantNullable(rs, "effective_from"),
                instantNullable(rs, "revoked_at"),
                rs.getString("evidence_reference")
        );
    }

    private PatientAccountLinkView mapAccountLink(ResultSet rs, int rowNum) throws SQLException {
        return new PatientAccountLinkView(
                rs.getObject("id", UUID.class),
                rs.getLong("version"),
                rs.getObject("account_id", UUID.class),
                rs.getObject("patient_id", UUID.class),
                rs.getString("relationship"),
                rs.getString("verification_tier"),
                parseJsonMap(rs.getString("permission_scope")),
                instant(rs, "valid_from"),
                instantNullable(rs, "valid_to"),
                rs.getString("status"),
                instantNullable(rs, "revoked_at"),
                rs.getString("revoke_reason"),
                instant(rs, "created_at"),
                instant(rs, "updated_at")
        );
    }

    private PatientDuplicateCandidateView mapDuplicateCandidate(ResultSet rs, int rowNum) throws SQLException {
        return new PatientDuplicateCandidateView(
                rs.getObject("id", UUID.class),
                rs.getLong("version"),
                rs.getObject("source_patient_id", UUID.class),
                rs.getObject("candidate_patient_id", UUID.class),
                parseJsonMap(rs.getString("match_reasons")),
                rs.getBigDecimal("score"),
                rs.getString("status"),
                rs.getObject("reviewer_account_id", UUID.class),
                instantNullable(rs, "reviewed_at"),
                rs.getString("review_reason"),
                instant(rs, "created_at"),
                instant(rs, "updated_at")
        );
    }

    private Map<String, Object> parseJsonMap(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return mapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (JsonProcessingException e) {
            return Map.of(); // fallback or logging in real prod
        }
    }
    
    private static Timestamp ts(Instant instant) {
        return instant == null ? null : Timestamp.from(instant);
    }

    private static Instant instant(ResultSet rs, String col) throws SQLException {
        Timestamp ts = rs.getTimestamp(col);
        return ts == null ? null : ts.toInstant();
    }

    private static Instant instantNullable(ResultSet rs, String col) throws SQLException {
        Timestamp ts = rs.getTimestamp(col);
        return ts == null ? null : ts.toInstant();
    }
}
