package vn.medicore.repository;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import vn.medicore.dto.FacilityLayoutModels.FacilityFloorElementView;
import vn.medicore.dto.FacilityLayoutModels.FacilityFloorSymbolView;
import vn.medicore.dto.FacilityLayoutModels.FacilityFloorView;
import vn.medicore.dto.FacilityLayoutModels.RoomPlacementView;

public interface FacilityLayoutRepository {

    void insertFloor(FloorRow row);

    Optional<FacilityFloorView> floorById(UUID id);

    Optional<FacilityFloorView> floorByIdForUpdate(UUID id);

    List<FacilityFloorView> listFloors(int limit, int offset);

    void updateFloor(FloorRow row, long expectedVersion);

    void deleteFloor(UUID id, long expectedVersion);

    boolean floorHasElements(UUID floorId);

    boolean floorHasSymbols(UUID floorId);

    boolean hasElementsOutOfBounds(UUID floorId, int gridColumns, int gridRows);

    void insertElement(ElementRow row);

    Optional<FacilityFloorElementView> elementById(UUID id);

    Optional<FacilityFloorElementView> elementByIdForUpdate(UUID id);

    List<FacilityFloorElementView> listElements(UUID floorId, int limit, int offset);

    List<FacilityFloorElementView> allElementsForFloor(UUID floorId);

    void updateElement(ElementRow row, long expectedVersion);

    void deleteElement(UUID id, long expectedVersion);

    boolean roomIsActive(UUID roomId);

    boolean roomIsPlacedElsewhere(UUID roomId, UUID excludedElementId);

    boolean hasIntersectingElement(UUID floorId, int gridX, int gridY, int gridWidth, int gridHeight, UUID excludedElementId);

    List<RoomPlacementView> allRoomPlacements();

    void insertSymbol(SymbolRow row);

    Optional<FacilityFloorSymbolView> symbolById(UUID id);

    Optional<FacilityFloorSymbolView> symbolByIdForUpdate(UUID id);

    List<FacilityFloorSymbolView> listSymbols(UUID floorId, int limit, int offset);

    List<FacilityFloorSymbolView> allSymbolsForFloor(UUID floorId);

    void updateSymbol(SymbolRow row, long expectedVersion);

    void deleteSymbol(UUID id, long expectedVersion);

    record FloorRow(
            UUID id,
            String code,
            String name,
            int level,
            String description,
            int gridColumns,
            int gridRows,
            long version,
            Instant createdAt,
            Instant updatedAt) {
    }

    record SymbolRow(
            UUID id,
            UUID floorId,
            String symbolType,
            String label,
            JsonNode geometry,
            int zIndex,
            long version,
            Instant createdAt,
            Instant updatedAt) {
    }

    record ElementRow(
            UUID id,
            UUID floorId,
            UUID roomId,
            String elementType,
            String label,
            int gridX,
            int gridY,
            int gridWidth,
            int gridHeight,
            int zIndex,
            String doorSide,
            String notes,
            long version,
            Instant createdAt,
            Instant updatedAt) {
    }
}
