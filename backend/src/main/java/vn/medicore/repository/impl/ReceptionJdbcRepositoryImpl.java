package vn.medicore.repository.impl;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import vn.medicore.common.exception.StaleVersionException;
import vn.medicore.dto.ReceptionModels.CheckInRow;
import vn.medicore.dto.ReceptionModels.EncounterParticipantRow;
import vn.medicore.dto.ReceptionModels.EncounterParticipantView;
import vn.medicore.dto.ReceptionModels.EncounterRow;
import vn.medicore.dto.ReceptionModels.VisitRow;
import vn.medicore.repository.ReceptionRepository;

@Repository
public class ReceptionJdbcRepositoryImpl implements ReceptionRepository {

    private final NamedParameterJdbcTemplate jdbc;

    private final RowMapper<VisitRow> visitMapper = this::mapVisit;
    private final RowMapper<CheckInRow> checkInMapper = this::mapCheckIn;
    private final RowMapper<EncounterRow> encounterMapper = this::mapEncounter;
    private final RowMapper<EncounterParticipantView> participantViewMapper = this::mapParticipantView;

    public ReceptionJdbcRepositoryImpl(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void insertVisit(VisitRow row) {
        String sql = """
            insert into visit (id, patient_id, appointment_id, status, version, created_at, updated_at)
            values (:id, :patientId, :appointmentId, :status, :version, :createdAt, :updatedAt)
            """;
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("id", row.id())
                .addValue("patientId", row.patientId())
                .addValue("appointmentId", row.appointmentId())
                .addValue("status", row.status())
                .addValue("version", row.version())
                .addValue("createdAt", Timestamp.from(row.createdAt()))
                .addValue("updatedAt", Timestamp.from(row.updatedAt()));
        jdbc.update(sql, params);
    }

    @Override
    public Optional<VisitRow> visitById(UUID id) {
        String sql = "select * from visit where id = :id";
        return querySingle(sql, new MapSqlParameterSource("id", id), visitMapper);
    }

    @Override
    public Optional<VisitRow> visitByIdForUpdate(UUID id) {
        String sql = "select * from visit where id = :id for update";
        return querySingle(sql, new MapSqlParameterSource("id", id), visitMapper);
    }

    @Override
    public Optional<VisitRow> visitByAppointmentId(UUID appointmentId) {
        String sql = "select * from visit where appointment_id = :appointmentId";
        return querySingle(sql, new MapSqlParameterSource("appointmentId", appointmentId), visitMapper);
    }

    @Override
    public void updateVisit(VisitRow row, long expectedVersion) {
        String sql = """
            update visit
            set status = :status, version = version + 1, updated_at = :updatedAt
            where id = :id and version = :expectedVersion
            """;
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("id", row.id())
                .addValue("status", row.status())
                .addValue("updatedAt", Timestamp.from(row.updatedAt()))
                .addValue("expectedVersion", expectedVersion);
        int rows = jdbc.update(sql, params);
        if (rows == 0) {
            throw new StaleVersionException();
        }
    }

    @Override
    public List<VisitRow> searchVisits(UUID patientId, String status, int limit, int offset) {
        StringBuilder sql = new StringBuilder("select * from visit where 1=1");
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("limit", limit)
                .addValue("offset", offset);
        if (patientId != null) {
            sql.append(" and patient_id = :patientId");
            params.addValue("patientId", patientId);
        }
        if (status != null && !status.isBlank()) {
            sql.append(" and status = :status");
            params.addValue("status", status);
        }
        sql.append(" order by created_at desc limit :limit offset :offset");
        return jdbc.query(sql.toString(), params, visitMapper);
    }

    @Override
    public void insertCheckIn(CheckInRow row) {
        String sql = """
            insert into check_in (id, appointment_id, visit_id, checked_in_at, checked_in_by_account_id, notes, version, created_at)
            values (:id, :appointmentId, :visitId, :checkedInAt, :checkedInByAccountId, :notes, :version, :createdAt)
            """;
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("id", row.id())
                .addValue("appointmentId", row.appointmentId())
                .addValue("visitId", row.visitId())
                .addValue("checkedInAt", Timestamp.from(row.checkedInAt()))
                .addValue("checkedInByAccountId", row.checkedInByAccountId())
                .addValue("notes", row.notes())
                .addValue("version", row.version())
                .addValue("createdAt", Timestamp.from(row.createdAt()));
        jdbc.update(sql, params);
    }

    @Override
    public Optional<CheckInRow> checkInById(UUID id) {
        String sql = "select * from check_in where id = :id";
        return querySingle(sql, new MapSqlParameterSource("id", id), checkInMapper);
    }

    @Override
    public Optional<CheckInRow> checkInByAppointmentId(UUID appointmentId) {
        String sql = "select * from check_in where appointment_id = :appointmentId";
        return querySingle(sql, new MapSqlParameterSource("appointmentId", appointmentId), checkInMapper);
    }

    @Override
    public void insertEncounter(EncounterRow row) {
        String sql = """
            insert into encounter (id, visit_id, patient_id, department_id, status, start_at, end_at, version, created_at, updated_at)
            values (:id, :visitId, :patientId, :departmentId, :status, :startAt, :endAt, :version, :createdAt, :updatedAt)
            """;
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("id", row.id())
                .addValue("visitId", row.visitId())
                .addValue("patientId", row.patientId())
                .addValue("departmentId", row.departmentId())
                .addValue("status", row.status())
                .addValue("startAt", row.startAt() != null ? Timestamp.from(row.startAt()) : null)
                .addValue("endAt", row.endAt() != null ? Timestamp.from(row.endAt()) : null)
                .addValue("version", row.version())
                .addValue("createdAt", Timestamp.from(row.createdAt()))
                .addValue("updatedAt", Timestamp.from(row.updatedAt()));
        jdbc.update(sql, params);
    }

    @Override
    public Optional<EncounterRow> encounterById(UUID id) {
        String sql = "select * from encounter where id = :id";
        return querySingle(sql, new MapSqlParameterSource("id", id), encounterMapper);
    }

    @Override
    public Optional<EncounterRow> encounterByIdForUpdate(UUID id) {
        String sql = "select * from encounter where id = :id for update";
        return querySingle(sql, new MapSqlParameterSource("id", id), encounterMapper);
    }

    @Override
    public List<EncounterRow> encountersByVisitId(UUID visitId) {
        String sql = "select * from encounter where visit_id = :visitId order by created_at asc";
        return jdbc.query(sql, new MapSqlParameterSource("visitId", visitId), encounterMapper);
    }

    @Override
    public void updateEncounter(EncounterRow row, long expectedVersion) {
        String sql = """
            update encounter
            set status = :status, start_at = :startAt, end_at = :endAt, version = version + 1, updated_at = :updatedAt
            where id = :id and version = :expectedVersion
            """;
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("id", row.id())
                .addValue("status", row.status())
                .addValue("startAt", row.startAt() != null ? Timestamp.from(row.startAt()) : null)
                .addValue("endAt", row.endAt() != null ? Timestamp.from(row.endAt()) : null)
                .addValue("updatedAt", Timestamp.from(row.updatedAt()))
                .addValue("expectedVersion", expectedVersion);
        int rows = jdbc.update(sql, params);
        if (rows == 0) {
            throw new StaleVersionException();
        }
    }

    @Override
    public void insertEncounterParticipant(EncounterParticipantRow row) {
        String sql = """
            insert into encounter_participant (id, encounter_id, practitioner_role_id, role_type, status, created_at)
            values (:id, :encounterId, :practitionerRoleId, :roleType, :status, :createdAt)
            """;
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("id", row.id())
                .addValue("encounterId", row.encounterId())
                .addValue("practitionerRoleId", row.practitionerRoleId())
                .addValue("roleType", row.roleType())
                .addValue("status", row.status())
                .addValue("createdAt", Timestamp.from(row.createdAt()));
        jdbc.update(sql, params);
    }

    @Override
    public List<EncounterParticipantView> participantsByEncounterId(UUID encounterId) {
        String sql = """
            select ep.*, p.full_name as practitioner_name, pr.role_code as practitioner_role_code
            from encounter_participant ep
            join practitioner_role pr on ep.practitioner_role_id = pr.id
            join practitioner p on pr.practitioner_id = p.id
            where ep.encounter_id = :encounterId
            order by ep.created_at asc
            """;
        return jdbc.query(sql, new MapSqlParameterSource("encounterId", encounterId), participantViewMapper);
    }

    @Override
    public boolean isPractitionerRoleParticipant(UUID encounterId, UUID practitionerRoleId) {
        String sql = """
            select count(1) from encounter_participant
            where encounter_id = :encounterId and practitioner_role_id = :practitionerRoleId and status = 'ACTIVE'
            """;
        Integer count = jdbc.queryForObject(sql, new MapSqlParameterSource()
                .addValue("encounterId", encounterId)
                .addValue("practitionerRoleId", practitionerRoleId), Integer.class);
        return count != null && count > 0;
    }

    @Override
    public List<EncounterRow> searchDoctorEncounters(UUID practitionerRoleId, LocalDate date, String status, int limit, int offset) {
        StringBuilder sql = new StringBuilder("""
            select e.* from encounter e
            join encounter_participant ep on e.id = ep.encounter_id
            where ep.practitioner_role_id = :practitionerRoleId
              and ep.status = 'ACTIVE'
            """);
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("practitionerRoleId", practitionerRoleId)
                .addValue("limit", limit)
                .addValue("offset", offset);
        if (date != null) {
            sql.append(" and date(timezone('UTC', e.created_at)) = :date");
            params.addValue("date", date);
        }
        if (status != null && !status.isBlank()) {
            sql.append(" and e.status = :status");
            params.addValue("status", status);
        }
        sql.append(" order by e.created_at desc limit :limit offset :offset");
        return jdbc.query(sql.toString(), params, encounterMapper);
    }

    @Override
    public List<EncounterRow> searchEncountersByPatient(UUID patientId, int limit, int offset) {
        String sql = """
            select * from encounter
            where patient_id = :patientId
            order by created_at desc
            limit :limit offset :offset
            """;
        return jdbc.query(sql, new MapSqlParameterSource()
                .addValue("patientId", patientId)
                .addValue("limit", limit)
                .addValue("offset", offset), encounterMapper);
    }

    private <T> Optional<T> querySingle(String sql, MapSqlParameterSource params, RowMapper<T> mapper) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(sql, params, mapper));
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    private VisitRow mapVisit(ResultSet rs, int rowNum) throws SQLException {
        return new VisitRow(
                UUID.fromString(rs.getString("id")),
                UUID.fromString(rs.getString("patient_id")),
                UUID.fromString(rs.getString("appointment_id")),
                rs.getString("status"),
                rs.getLong("version"),
                rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("updated_at").toInstant());
    }

    private CheckInRow mapCheckIn(ResultSet rs, int rowNum) throws SQLException {
        String accountIdStr = rs.getString("checked_in_by_account_id");
        return new CheckInRow(
                UUID.fromString(rs.getString("id")),
                UUID.fromString(rs.getString("appointment_id")),
                UUID.fromString(rs.getString("visit_id")),
                rs.getTimestamp("checked_in_at").toInstant(),
                accountIdStr != null ? UUID.fromString(accountIdStr) : null,
                rs.getString("notes"),
                rs.getLong("version"),
                rs.getTimestamp("created_at").toInstant());
    }

    private EncounterRow mapEncounter(ResultSet rs, int rowNum) throws SQLException {
        Timestamp start = rs.getTimestamp("start_at");
        Timestamp end = rs.getTimestamp("end_at");
        return new EncounterRow(
                UUID.fromString(rs.getString("id")),
                UUID.fromString(rs.getString("visit_id")),
                UUID.fromString(rs.getString("patient_id")),
                UUID.fromString(rs.getString("department_id")),
                rs.getString("status"),
                start != null ? start.toInstant() : null,
                end != null ? end.toInstant() : null,
                rs.getLong("version"),
                rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("updated_at").toInstant());
    }

    private EncounterParticipantView mapParticipantView(ResultSet rs, int rowNum) throws SQLException {
        return new EncounterParticipantView(
                UUID.fromString(rs.getString("id")),
                UUID.fromString(rs.getString("encounter_id")),
                UUID.fromString(rs.getString("practitioner_role_id")),
                rs.getString("practitioner_name"),
                rs.getString("practitioner_role_code"),
                rs.getString("role_type"),
                rs.getString("status"),
                rs.getTimestamp("created_at").toInstant());
    }
}
