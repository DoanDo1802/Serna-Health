package vn.medicore.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class FacilityLayoutModels {

    private FacilityLayoutModels() {
    }

    public record FacilityFloorView(
            UUID id,
            long version,
            String code,
            String name,
            int level,
            String description,
            int gridColumns,
            int gridRows,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record FacilityFloorElementView(
            UUID id,
            UUID floorId,
            UUID roomId,
            long version,
            String elementType,
            String label,
            int gridX,
            int gridY,
            int gridWidth,
            int gridHeight,
            int zIndex,
            String doorSide,
            String notes,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record FacilityFloorSymbolView(
            UUID id,
            UUID floorId,
            long version,
            String symbolType,
            String label,
            JsonNode geometry,
            int zIndex,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record Page<T>(List<T> items, String nextCursor, boolean hasMore) {
    }
}
