package vn.medicore.repository.impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import vn.medicore.common.exception.StaleVersionException;
import vn.medicore.dto.FacilityLayoutModels.FacilityFloorElementView;
import vn.medicore.dto.FacilityLayoutModels.FacilityFloorSymbolView;
import vn.medicore.dto.FacilityLayoutModels.FacilityFloorView;
import vn.medicore.dto.FacilityLayoutModels.RoomPlacementView;
import vn.medicore.repository.FacilityLayoutRepository;

@Repository
public class FacilityLayoutJdbcRepositoryImpl implements FacilityLayoutRepository {

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public FacilityLayoutJdbcRepositoryImpl(JdbcTemplate jdbc, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
    }

    @Override
    public void insertFloor(FloorRow row) {
        jdbc.update("""
                insert into facility_floor(id, code, name, level, description, grid_columns, grid_rows, version, created_at, updated_at)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, row.id(), row.code(), row.name(), row.level(), row.description(), row.gridColumns(), row.gridRows(),
                row.version(), timestamp(row.createdAt()), timestamp(row.updatedAt()));
    }

    @Override
    public Optional<FacilityFloorView> floorById(UUID id) {
        return one("select * from facility_floor where id = ?", this::floor, id);
    }

    @Override
    public Optional<FacilityFloorView> floorByIdForUpdate(UUID id) {
        return one("select * from facility_floor where id = ? for update", this::floor, id);
    }

    @Override
    public List<FacilityFloorView> listFloors(int limit, int offset) {
        return jdbc.query("select * from facility_floor order by level, id limit ? offset ?", this::floor, limit, offset);
    }

    @Override
    public void updateFloor(FloorRow row, long expectedVersion) {
        int updated = jdbc.update("""
                update facility_floor set code = ?, name = ?, level = ?, description = ?, grid_columns = ?, grid_rows = ?,
                    version = version + 1, updated_at = ? where id = ? and version = ?
                """, row.code(), row.name(), row.level(), row.description(), row.gridColumns(), row.gridRows(),
                timestamp(row.updatedAt()), row.id(), expectedVersion);
        if (updated != 1) throw new StaleVersionException();
    }

    @Override
    public void deleteFloor(UUID id, long expectedVersion) {
        int deleted = jdbc.update("delete from facility_floor where id = ? and version = ?", id, expectedVersion);
        if (deleted != 1) throw new StaleVersionException();
    }

    @Override
    public boolean floorHasElements(UUID floorId) {
        Integer count = jdbc.queryForObject("select count(*) from facility_floor_element where floor_id = ?", Integer.class, floorId);
        return count != null && count > 0;
    }

    @Override
    public boolean floorHasSymbols(UUID floorId) {
        Integer count = jdbc.queryForObject("select count(*) from facility_floor_symbol where floor_id = ?", Integer.class, floorId);
        return count != null && count > 0;
    }

    @Override
    public boolean hasElementsOutOfBounds(UUID floorId, int gridColumns, int gridRows) {
        Integer count = jdbc.queryForObject("""
                select count(*) from facility_floor_element
                where floor_id = ? and (grid_x + grid_width > ? or grid_y + grid_height > ?)
                """, Integer.class, floorId, gridColumns, gridRows);
        return count != null && count > 0;
    }

    @Override
    public void insertElement(ElementRow row) {
        jdbc.update("""
                insert into facility_floor_element(id, floor_id, room_id, element_type, label, grid_x, grid_y, grid_width,
                    grid_height, z_index, door_side, notes, version, created_at, updated_at)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, row.id(), row.floorId(), row.roomId(), row.elementType(), row.label(), row.gridX(), row.gridY(),
                row.gridWidth(), row.gridHeight(), row.zIndex(), row.doorSide(), row.notes(), row.version(),
                timestamp(row.createdAt()), timestamp(row.updatedAt()));
    }

    @Override
    public Optional<FacilityFloorElementView> elementById(UUID id) {
        return one("select * from facility_floor_element where id = ?", this::element, id);
    }

    @Override
    public Optional<FacilityFloorElementView> elementByIdForUpdate(UUID id) {
        return one("select * from facility_floor_element where id = ? for update", this::element, id);
    }

    @Override
    public List<FacilityFloorElementView> listElements(UUID floorId, int limit, int offset) {
        return jdbc.query("""
                select * from facility_floor_element where floor_id = ?
                order by z_index, grid_y, grid_x, id limit ? offset ?
                """, this::element, floorId, limit, offset);
    }

    @Override
    public List<FacilityFloorElementView> allElementsForFloor(UUID floorId) {
        return jdbc.query("""
                select * from facility_floor_element where floor_id = ?
                order by z_index, grid_y, grid_x, id
                """, this::element, floorId);
    }

    @Override
    public void updateElement(ElementRow row, long expectedVersion) {
        int updated = jdbc.update("""
                update facility_floor_element set floor_id = ?, room_id = ?, element_type = ?, label = ?, grid_x = ?, grid_y = ?,
                    grid_width = ?, grid_height = ?, z_index = ?, door_side = ?, notes = ?, version = version + 1, updated_at = ?
                where id = ? and version = ?
                """, row.floorId(), row.roomId(), row.elementType(), row.label(), row.gridX(), row.gridY(), row.gridWidth(),
                row.gridHeight(), row.zIndex(), row.doorSide(), row.notes(), timestamp(row.updatedAt()), row.id(), expectedVersion);
        if (updated != 1) throw new StaleVersionException();
    }

    @Override
    public void deleteElement(UUID id, long expectedVersion) {
        int deleted = jdbc.update("delete from facility_floor_element where id = ? and version = ?", id, expectedVersion);
        if (deleted != 1) throw new StaleVersionException();
    }

    @Override
    public List<RoomPlacementView> allRoomPlacements() {
        return jdbc.query("""
                select room_id, floor_id, id from facility_floor_element
                where room_id is not null
                order by floor_id, room_id
                """, (rs, rowNum) -> new RoomPlacementView(
                        (UUID) rs.getObject("room_id"),
                        (UUID) rs.getObject("floor_id"),
                        (UUID) rs.getObject("id")));
    }

    @Override
    public void insertSymbol(SymbolRow row) {
        jdbc.update("""
                insert into facility_floor_symbol(id, floor_id, symbol_type, label, geometry, z_index, version, created_at, updated_at)
                values (?, ?, ?, ?, cast(? as jsonb), ?, ?, ?, ?)
                """, row.id(), row.floorId(), row.symbolType(), row.label(), json(row.geometry()), row.zIndex(), row.version(),
                timestamp(row.createdAt()), timestamp(row.updatedAt()));
    }

    @Override
    public Optional<FacilityFloorSymbolView> symbolById(UUID id) {
        return one("select * from facility_floor_symbol where id = ?", this::symbol, id);
    }

    @Override
    public Optional<FacilityFloorSymbolView> symbolByIdForUpdate(UUID id) {
        return one("select * from facility_floor_symbol where id = ? for update", this::symbol, id);
    }

    @Override
    public List<FacilityFloorSymbolView> listSymbols(UUID floorId, int limit, int offset) {
        return jdbc.query("""
                select * from facility_floor_symbol where floor_id = ?
                order by z_index, id limit ? offset ?
                """, this::symbol, floorId, limit, offset);
    }

    @Override
    public List<FacilityFloorSymbolView> allSymbolsForFloor(UUID floorId) {
        return jdbc.query("""
                select * from facility_floor_symbol where floor_id = ?
                order by z_index, id
                """, this::symbol, floorId);
    }

    @Override
    public void updateSymbol(SymbolRow row, long expectedVersion) {
        int updated = jdbc.update("""
                update facility_floor_symbol set symbol_type = ?, label = ?, geometry = cast(? as jsonb), z_index = ?,
                    version = version + 1, updated_at = ? where id = ? and version = ?
                """, row.symbolType(), row.label(), json(row.geometry()), row.zIndex(), timestamp(row.updatedAt()), row.id(), expectedVersion);
        if (updated != 1) throw new StaleVersionException();
    }

    @Override
    public void deleteSymbol(UUID id, long expectedVersion) {
        int deleted = jdbc.update("delete from facility_floor_symbol where id = ? and version = ?", id, expectedVersion);
        if (deleted != 1) throw new StaleVersionException();
    }

    @Override
    public boolean roomIsActive(UUID roomId) {
        try {
            Boolean active = jdbc.queryForObject("select active from room where id = ?", Boolean.class, roomId);
            return Boolean.TRUE.equals(active);
        } catch (EmptyResultDataAccessException exception) {
            return false;
        }
    }

    @Override
    public boolean roomIsPlacedElsewhere(UUID roomId, UUID excludedElementId) {
        Integer count = excludedElementId == null
                ? jdbc.queryForObject("select count(*) from facility_floor_element where room_id = ?", Integer.class, roomId)
                : jdbc.queryForObject("select count(*) from facility_floor_element where room_id = ? and id <> ?",
                        Integer.class, roomId, excludedElementId);
        return count != null && count > 0;
    }

    @Override
    public boolean hasIntersectingElement(UUID floorId, int gridX, int gridY, int gridWidth, int gridHeight, UUID excludedElementId) {
        Integer count = excludedElementId == null
                ? jdbc.queryForObject("""
                        select count(*) from facility_floor_element
                        where floor_id = ? and grid_x < ? and grid_x + grid_width > ?
                          and grid_y < ? and grid_y + grid_height > ?
                        """, Integer.class, floorId, gridX + gridWidth, gridX, gridY + gridHeight, gridY)
                : jdbc.queryForObject("""
                        select count(*) from facility_floor_element
                        where floor_id = ? and id <> ? and grid_x < ? and grid_x + grid_width > ?
                          and grid_y < ? and grid_y + grid_height > ?
                        """, Integer.class, floorId, excludedElementId, gridX + gridWidth, gridX,
                        gridY + gridHeight, gridY);
        return count != null && count > 0;
    }

    private <T> Optional<T> one(String sql, org.springframework.jdbc.core.RowMapper<T> mapper, Object... values) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(sql, mapper, values));
        } catch (EmptyResultDataAccessException exception) {
            return Optional.empty();
        }
    }

    private FacilityFloorView floor(ResultSet rs, int rowNum) throws SQLException {
        return new FacilityFloorView(rs.getObject("id", UUID.class), rs.getLong("version"), rs.getString("code"),
                rs.getString("name"), rs.getInt("level"), rs.getString("description"), rs.getInt("grid_columns"),
                rs.getInt("grid_rows"), instant(rs, "created_at"), instant(rs, "updated_at"));
    }

    private FacilityFloorElementView element(ResultSet rs, int rowNum) throws SQLException {
        return new FacilityFloorElementView(rs.getObject("id", UUID.class), rs.getObject("floor_id", UUID.class),
                rs.getObject("room_id", UUID.class), rs.getLong("version"), rs.getString("element_type"),
                rs.getString("label"), rs.getInt("grid_x"), rs.getInt("grid_y"), rs.getInt("grid_width"),
                rs.getInt("grid_height"), rs.getInt("z_index"), rs.getString("door_side"), rs.getString("notes"),
                instant(rs, "created_at"), instant(rs, "updated_at"));
    }

    private FacilityFloorSymbolView symbol(ResultSet rs, int rowNum) throws SQLException {
        return new FacilityFloorSymbolView(rs.getObject("id", UUID.class), rs.getObject("floor_id", UUID.class),
                rs.getLong("version"), rs.getString("symbol_type"), rs.getString("label"), jsonNode(rs.getString("geometry")),
                rs.getInt("z_index"), instant(rs, "created_at"), instant(rs, "updated_at"));
    }

    private String json(JsonNode value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("geometry is invalid", exception);
        }
    }

    private JsonNode jsonNode(String value) {
        try {
            return objectMapper.readTree(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Stored symbol geometry is invalid", exception);
        }
    }

    private static Instant instant(ResultSet rs, String column) throws SQLException {
        Timestamp value = rs.getTimestamp(column);
        return value.toInstant();
    }

    private static Timestamp timestamp(Instant value) {
        return Timestamp.from(value);
    }
}
