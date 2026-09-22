package vn.medicore.service;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.UUID;
import vn.medicore.dto.FacilityLayoutAuditContext;
import vn.medicore.dto.FacilityLayoutModels.FacilityFloorElementView;
import vn.medicore.dto.FacilityLayoutModels.FacilityFloorSymbolView;
import vn.medicore.dto.FacilityLayoutModels.FacilityFloorView;
import vn.medicore.dto.FacilityLayoutModels.FacilityLayoutSnapshot;
import vn.medicore.dto.FacilityLayoutModels.LayoutChangesCommand;
import vn.medicore.dto.FacilityLayoutModels.Page;
import vn.medicore.dto.FacilityLayoutModels.RoomPlacementView;
import java.util.List;

public interface FacilityLayoutService {

    Page<FacilityFloorView> listFloors(String cursor, int limit);

    FacilityFloorView getFloor(UUID id);

    FacilityLayoutSnapshot getLayoutSnapshot(UUID floorId);

    List<RoomPlacementView> getRoomPlacements();

    FacilityLayoutSnapshot applyLayoutChanges(UUID floorId, LayoutChangesCommand command, FacilityLayoutAuditContext audit);

    FacilityFloorView createFloor(FloorCommand command, FacilityLayoutAuditContext audit);

    FacilityFloorView updateFloor(UUID id, FloorCommand command, long version, FacilityLayoutAuditContext audit);

    void deleteFloor(UUID id, long version, FacilityLayoutAuditContext audit);

    Page<FacilityFloorElementView> listElements(UUID floorId, String cursor, int limit);

    FacilityFloorElementView getElement(UUID id);

    FacilityFloorElementView createElement(UUID floorId, ElementCommand command, FacilityLayoutAuditContext audit);

    FacilityFloorElementView updateElement(UUID id, ElementCommand command, long version, FacilityLayoutAuditContext audit);

    void deleteElement(UUID id, long version, FacilityLayoutAuditContext audit);

    Page<FacilityFloorSymbolView> listSymbols(UUID floorId, String cursor, int limit);

    FacilityFloorSymbolView getSymbol(UUID id);

    FacilityFloorSymbolView createSymbol(UUID floorId, SymbolCommand command, FacilityLayoutAuditContext audit);

    FacilityFloorSymbolView updateSymbol(UUID id, SymbolCommand command, long version, FacilityLayoutAuditContext audit);

    void deleteSymbol(UUID id, long version, FacilityLayoutAuditContext audit);

    record FloorCommand(String code, String name, int level, String description, int gridColumns, int gridRows) {
    }

    record ElementCommand(UUID roomId, String elementType, String label, int gridX, int gridY, int gridWidth,
                          int gridHeight, int zIndex, String doorSide, String notes) {
    }

    record SymbolCommand(String symbolType, String label, JsonNode geometry, int zIndex) {
    }
}
