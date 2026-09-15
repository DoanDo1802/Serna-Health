package vn.medicore.repository.impl;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import vn.medicore.common.exception.StaleVersionException;
import vn.medicore.dto.ClinicalModels.ClinicalNoteRow;
import vn.medicore.dto.ClinicalModels.ClinicalNoteVersionRow;
import vn.medicore.repository.ClinicalRepository;

@Repository
public class ClinicalJdbcRepositoryImpl implements ClinicalRepository {

    private final NamedParameterJdbcTemplate jdbc;

    private final RowMapper<ClinicalNoteRow> noteMapper = this::mapNote;
    private final RowMapper<ClinicalNoteVersionRow> versionMapper = this::mapVersion;

    public ClinicalJdbcRepositoryImpl(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void insertClinicalNote(ClinicalNoteRow row) {
        String sql = """
            insert into clinical_note (id, encounter_id, patient_id, note_type, status, current_version_id, version, created_at, updated_at)
            values (:id, :encounterId, :patientId, :noteType, :status, :currentVersionId, :version, :createdAt, :updatedAt)
            """;
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("id", row.id())
                .addValue("encounterId", row.encounterId())
                .addValue("patientId", row.patientId())
                .addValue("noteType", row.noteType())
                .addValue("status", row.status())
                .addValue("currentVersionId", row.currentVersionId())
                .addValue("version", row.version())
                .addValue("createdAt", Timestamp.from(row.createdAt()))
                .addValue("updatedAt", Timestamp.from(row.updatedAt()));
        jdbc.update(sql, params);
    }

    @Override
    public void setInitialCurrentVersion(UUID noteId, UUID currentVersionId) {
        String sql = "update clinical_note set current_version_id = :currentVersionId where id = :id";
        jdbc.update(sql, new MapSqlParameterSource()
                .addValue("id", noteId)
                .addValue("currentVersionId", currentVersionId));
    }

    @Override
    public Optional<ClinicalNoteRow> clinicalNoteById(UUID id) {
        String sql = "select * from clinical_note where id = :id";
        return querySingle(sql, new MapSqlParameterSource("id", id), noteMapper);
    }

    @Override
    public Optional<ClinicalNoteRow> clinicalNoteByIdForUpdate(UUID id) {
        String sql = "select * from clinical_note where id = :id for update";
        return querySingle(sql, new MapSqlParameterSource("id", id), noteMapper);
    }

    @Override
    public void updateClinicalNote(ClinicalNoteRow row, long expectedVersion) {
        String sql = """
            update clinical_note
            set status = :status, current_version_id = :currentVersionId, version = version + 1, updated_at = :updatedAt
            where id = :id and version = :expectedVersion
            """;
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("id", row.id())
                .addValue("status", row.status())
                .addValue("currentVersionId", row.currentVersionId())
                .addValue("updatedAt", Timestamp.from(row.updatedAt()))
                .addValue("expectedVersion", expectedVersion);
        int rows = jdbc.update(sql, params);
        if (rows == 0) {
            throw new StaleVersionException();
        }
    }

    @Override
    public List<ClinicalNoteRow> listClinicalNotesByEncounter(UUID encounterId) {
        String sql = "select * from clinical_note where encounter_id = :encounterId order by created_at asc";
        return jdbc.query(sql, new MapSqlParameterSource("encounterId", encounterId), noteMapper);
    }

    @Override
    public List<ClinicalNoteRow> listClinicalNotesByPatient(UUID patientId, int limit, int offset) {
        String sql = """
            select * from clinical_note
            where patient_id = :patientId
            order by created_at desc
            limit :limit offset :offset
            """;
        return jdbc.query(sql, new MapSqlParameterSource()
                .addValue("patientId", patientId)
                .addValue("limit", limit)
                .addValue("offset", offset), noteMapper);
    }

    @Override
    public void insertClinicalNoteVersion(ClinicalNoteVersionRow row) {
        String sql = """
            insert into clinical_note_version (
                id, clinical_note_id, version_number, status, content_schema_version,
                content, digest, author_practitioner_role_id, finalized_by_practitioner_role_id,
                finalized_at, amended_from_version_id, amendment_reason, error_reason,
                version, created_at, updated_at
            ) values (
                :id, :clinicalNoteId, :versionNumber, :status, :contentSchemaVersion,
                :contentJson::jsonb, :digest, :authorRoleId, :finalizedByRoleId,
                :finalizedAt, :amendedFromId, :amendmentReason, :errorReason,
                :version, :createdAt, :updatedAt
            )
            """;
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("id", row.id())
                .addValue("clinicalNoteId", row.clinicalNoteId())
                .addValue("versionNumber", row.versionNumber())
                .addValue("status", row.status())
                .addValue("contentSchemaVersion", row.contentSchemaVersion())
                .addValue("contentJson", row.contentJson())
                .addValue("digest", row.digest())
                .addValue("authorRoleId", row.authorPractitionerRoleId())
                .addValue("finalizedByRoleId", row.finalizedByPractitionerRoleId())
                .addValue("finalizedAt", row.finalizedAt() != null ? Timestamp.from(row.finalizedAt()) : null)
                .addValue("amendedFromId", row.amendedFromVersionId())
                .addValue("amendmentReason", row.amendmentReason())
                .addValue("errorReason", row.errorReason())
                .addValue("version", row.version())
                .addValue("createdAt", Timestamp.from(row.createdAt()))
                .addValue("updatedAt", Timestamp.from(row.updatedAt()));
        jdbc.update(sql, params);
    }

    @Override
    public Optional<ClinicalNoteVersionRow> clinicalNoteVersionById(UUID id) {
        String sql = "select * from clinical_note_version where id = :id";
        return querySingle(sql, new MapSqlParameterSource("id", id), versionMapper);
    }

    @Override
    public Optional<ClinicalNoteVersionRow> clinicalNoteVersionByIdForUpdate(UUID id) {
        String sql = "select * from clinical_note_version where id = :id for update";
        return querySingle(sql, new MapSqlParameterSource("id", id), versionMapper);
    }

    @Override
    public void updateClinicalNoteVersion(ClinicalNoteVersionRow row, long expectedVersion) {
        String sql = """
            update clinical_note_version
            set status = :status, content = :contentJson::jsonb, digest = :digest,
                finalized_by_practitioner_role_id = :finalizedByRoleId, finalized_at = :finalizedAt,
                amendment_reason = :amendmentReason, error_reason = :errorReason,
                version = version + 1, updated_at = :updatedAt
            where id = :id and version = :expectedVersion
            """;
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("id", row.id())
                .addValue("status", row.status())
                .addValue("contentJson", row.contentJson())
                .addValue("digest", row.digest())
                .addValue("finalizedByRoleId", row.finalizedByPractitionerRoleId())
                .addValue("finalizedAt", row.finalizedAt() != null ? Timestamp.from(row.finalizedAt()) : null)
                .addValue("amendmentReason", row.amendmentReason())
                .addValue("errorReason", row.errorReason())
                .addValue("updatedAt", Timestamp.from(row.updatedAt()))
                .addValue("expectedVersion", expectedVersion);
        int rows = jdbc.update(sql, params);
        if (rows == 0) {
            throw new StaleVersionException();
        }
    }

    @Override
    public List<ClinicalNoteVersionRow> listVersionsByClinicalNoteId(UUID clinicalNoteId) {
        String sql = "select * from clinical_note_version where clinical_note_id = :clinicalNoteId order by version_number asc";
        return jdbc.query(sql, new MapSqlParameterSource("clinicalNoteId", clinicalNoteId), versionMapper);
    }

    @Override
    public int nextVersionNumber(UUID clinicalNoteId) {
        String sql = "select coalesce(max(version_number), 0) + 1 from clinical_note_version where clinical_note_id = :clinicalNoteId";
        Integer next = jdbc.queryForObject(sql, new MapSqlParameterSource("clinicalNoteId", clinicalNoteId), Integer.class);
        return next != null ? next : 1;
    }

    @Override
    public Optional<ClinicalNoteVersionRow> latestVersionByClinicalNoteId(UUID clinicalNoteId) {
        String sql = """
            select * from clinical_note_version
            where clinical_note_id = :clinicalNoteId
            order by version_number desc
            limit 1
            """;
        return querySingle(sql, new MapSqlParameterSource("clinicalNoteId", clinicalNoteId), versionMapper);
    }

    private <T> Optional<T> querySingle(String sql, MapSqlParameterSource params, RowMapper<T> mapper) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(sql, params, mapper));
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    private ClinicalNoteRow mapNote(ResultSet rs, int rowNum) throws SQLException {
        String currentVersionIdStr = rs.getString("current_version_id");
        return new ClinicalNoteRow(
                UUID.fromString(rs.getString("id")),
                UUID.fromString(rs.getString("encounter_id")),
                UUID.fromString(rs.getString("patient_id")),
                rs.getString("note_type"),
                rs.getString("status"),
                currentVersionIdStr != null ? UUID.fromString(currentVersionIdStr) : null,
                rs.getLong("version"),
                rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("updated_at").toInstant());
    }

    private ClinicalNoteVersionRow mapVersion(ResultSet rs, int rowNum) throws SQLException {
        String finalizedByStr = rs.getString("finalized_by_practitioner_role_id");
        Timestamp finalizedAtTs = rs.getTimestamp("finalized_at");
        String amendedFromStr = rs.getString("amended_from_version_id");

        return new ClinicalNoteVersionRow(
                UUID.fromString(rs.getString("id")),
                UUID.fromString(rs.getString("clinical_note_id")),
                rs.getInt("version_number"),
                rs.getString("status"),
                rs.getString("content_schema_version"),
                rs.getString("content"),
                rs.getString("digest"),
                UUID.fromString(rs.getString("author_practitioner_role_id")),
                finalizedByStr != null ? UUID.fromString(finalizedByStr) : null,
                finalizedAtTs != null ? finalizedAtTs.toInstant() : null,
                amendedFromStr != null ? UUID.fromString(amendedFromStr) : null,
                rs.getString("amendment_reason"),
                rs.getString("error_reason"),
                rs.getLong("version"),
                rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("updated_at").toInstant());
    }
}
