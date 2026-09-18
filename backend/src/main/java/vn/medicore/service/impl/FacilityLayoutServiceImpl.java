package vn.medicore.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.medicore.common.exception.ResourceNotFoundException;
import vn.medicore.common.utils.UuidV7Generator;
import vn.medicore.dto.FacilityLayoutAuditContext;
import vn.medicore.dto.FacilityLayoutModels.FacilityFloorElementView;
import vn.medicore.dto.FacilityLayoutModels.FacilityFloorSymbolView;
import vn.medicore.dto.FacilityLayoutModels.FacilityFloorView;
import vn.medicore.dto.FacilityLayoutModels.Page;
import vn.medicore.dto.SecurityAuditRecorder;
import vn.medicore.repository.FacilityLayoutRepository;
import vn.medicore.repository.FacilityLayoutRepository.ElementRow;
import vn.medicore.repository.FacilityLayoutRepository.FloorRow;
import vn.medicore.service.FacilityLayoutService;

@Service
@Transactional
public class FacilityLayoutServiceImpl implements FacilityLayoutService {

    private static final Set<String> ELEMENT_TYPES = Set.of("ROOM", "WALKWAY", "ELEVATOR", "STAIRS", "WC", "RECEPTION",
            "EQUIPMENT", "WAITING_AREA", "EMERGENCY_EXIT", "OTHER");
    private static final Set<String> DOOR_SIDES = Set.of("NORTH", "EAST", "SOUTH", "WEST");
    private static final Set<String> SYMBOL_TYPES = Set.of("WALL_STRAIGHT", "WALL_CURVED", "PARTITION", "DOOR",
            "STAIRS", "ELEVATOR", "WC", "SKYWELL");
    private static final Set<Integer> ROTATIONS = Set.of(0, 90, 180, 270);

    private final FacilityLayoutRepository store;
    private final SecurityAuditRecorder audit;
    private final Clock clock;
    private final UuidV7Generator ids;

    public FacilityLayoutServiceImpl(
            FacilityLayoutRepository store, SecurityAuditRecorder audit, Clock clock, UuidV7Generator ids) {
        this.store = store;
        this.audit = audit;
        this.clock = clock;
        this.ids = ids;
    }

    @Override
    @Transactional(readOnly = true)
    public Page<FacilityFloorView> listFloors(String cursor, int limit) {
        int offset = offset(cursor);
        return page(store.listFloors(limit + 1, offset), limit, offset);
    }

    @Override
    @Transactional(readOnly = true)
    public FacilityFloorView getFloor(UUID id) {
        return store.floorById(id).orElseThrow(ResourceNotFoundException::new);
    }

    @Override
    public FacilityFloorView createFloor(FloorCommand command, FacilityLayoutAuditContext context) {
        validateFloor(command);
        Instant now = clock.instant();
        UUID id = ids.next();
        store.insertFloor(new FloorRow(id, command.code().strip(), command.name().strip(), command.level(), nullable(command.description()),
                command.gridColumns(), command.gridRows(), 0, now, now));
        FacilityFloorView view = getFloor(id);
        record(context, "floorplan.floor.create", "FacilityFloor", id, view.version(), "created");
        return view;
    }

    @Override
    public FacilityFloorView updateFloor(UUID id, FloorCommand command, long version, FacilityLayoutAuditContext context) {
        FacilityFloorView floor = store.floorByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        validateFloor(command);
        int offset = 0;
        List<FacilityFloorElementView> elements;
        do {
            elements = store.listElements(id, 100, offset);
            for (FacilityFloorElementView element : elements) {
                ensureWithinBounds(command.gridColumns(), command.gridRows(), element.gridX(), element.gridY(),
                        element.gridWidth(), element.gridHeight());
            }
            offset += elements.size();
        } while (elements.size() == 100);
        Instant now = clock.instant();
        store.updateFloor(new FloorRow(id, command.code().strip(), command.name().strip(), command.level(), nullable(command.description()),
                command.gridColumns(), command.gridRows(), version + 1, floor.createdAt(), now), version);
        FacilityFloorView view = getFloor(id);
        record(context, "floorplan.floor.update", "FacilityFloor", id, view.version(), "updated");
        return view;
    }

    @Override
    public void deleteFloor(UUID id, long version, FacilityLayoutAuditContext context) {
        store.floorByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        if (store.floorHasElements(id) || store.floorHasSymbols(id)) throw new IllegalStateException("Không thể xóa tầng còn phần tử mặt bằng.");
        store.deleteFloor(id, version);
        record(context, "floorplan.floor.delete", "FacilityFloor", id, version, "deleted");
    }

    @Override
    @Transactional(readOnly = true)
    public Page<FacilityFloorElementView> listElements(UUID floorId, String cursor, int limit) {
        getFloor(floorId);
        int offset = offset(cursor);
        return page(store.listElements(floorId, limit + 1, offset), limit, offset);
    }

    @Override
    @Transactional(readOnly = true)
    public FacilityFloorElementView getElement(UUID id) {
        return store.elementById(id).orElseThrow(ResourceNotFoundException::new);
    }

    @Override
    public FacilityFloorElementView createElement(UUID floorId, ElementCommand command, FacilityLayoutAuditContext context) {
        FacilityFloorView floor = store.floorByIdForUpdate(floorId).orElseThrow(ResourceNotFoundException::new);
        validateElement(command, floor, null);
        Instant now = clock.instant();
        UUID id = ids.next();
        store.insertElement(new ElementRow(id, floorId, command.roomId(), command.elementType(), command.label().strip(),
                command.gridX(), command.gridY(), command.gridWidth(), command.gridHeight(), command.zIndex(),
                nullable(command.doorSide()), nullable(command.notes()), 0, now, now));
        FacilityFloorElementView view = getElement(id);
        record(context, "floorplan.element.create", "FacilityFloorElement", id, view.version(), "created");
        return view;
    }

    @Override
    public FacilityFloorElementView updateElement(UUID id, ElementCommand command, long version, FacilityLayoutAuditContext context) {
        FacilityFloorElementView element = store.elementByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        FacilityFloorView floor = store.floorByIdForUpdate(element.floorId()).orElseThrow(ResourceNotFoundException::new);
        validateElement(command, floor, id);
        Instant now = clock.instant();
        store.updateElement(new ElementRow(id, floor.id(), command.roomId(), command.elementType(), command.label().strip(),
                command.gridX(), command.gridY(), command.gridWidth(), command.gridHeight(), command.zIndex(),
                nullable(command.doorSide()), nullable(command.notes()), version + 1, element.createdAt(), now), version);
        FacilityFloorElementView view = getElement(id);
        record(context, "floorplan.element.update", "FacilityFloorElement", id, view.version(), "updated");
        return view;
    }

    @Override
    public void deleteElement(UUID id, long version, FacilityLayoutAuditContext context) {
        store.elementByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        store.deleteElement(id, version);
        record(context, "floorplan.element.delete", "FacilityFloorElement", id, version, "removed from floor plan");
    }

    @Override
    @Transactional(readOnly = true)
    public Page<FacilityFloorSymbolView> listSymbols(UUID floorId, String cursor, int limit) {
        getFloor(floorId);
        int offset = offset(cursor);
        return page(store.listSymbols(floorId, limit + 1, offset), limit, offset);
    }

    @Override
    @Transactional(readOnly = true)
    public FacilityFloorSymbolView getSymbol(UUID id) {
        return store.symbolById(id).orElseThrow(ResourceNotFoundException::new);
    }

    @Override
    public FacilityFloorSymbolView createSymbol(UUID floorId, SymbolCommand command, FacilityLayoutAuditContext context) {
        FacilityFloorView floor = store.floorByIdForUpdate(floorId).orElseThrow(ResourceNotFoundException::new);
        validateSymbol(command, floor);
        Instant now = clock.instant();
        UUID id = ids.next();
        store.insertSymbol(new FacilityLayoutRepository.SymbolRow(id, floorId, command.symbolType(), command.label().strip(),
                command.geometry(), command.zIndex(), 0, now, now));
        FacilityFloorSymbolView view = getSymbol(id);
        record(context, "floorplan.symbol.create", "FacilityFloorSymbol", id, view.version(), "created");
        return view;
    }

    @Override
    public FacilityFloorSymbolView updateSymbol(UUID id, SymbolCommand command, long version, FacilityLayoutAuditContext context) {
        FacilityFloorSymbolView symbol = store.symbolByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        FacilityFloorView floor = store.floorByIdForUpdate(symbol.floorId()).orElseThrow(ResourceNotFoundException::new);
        validateSymbol(command, floor);
        Instant now = clock.instant();
        store.updateSymbol(new FacilityLayoutRepository.SymbolRow(id, floor.id(), command.symbolType(), command.label().strip(),
                command.geometry(), command.zIndex(), version + 1, symbol.createdAt(), now), version);
        FacilityFloorSymbolView view = getSymbol(id);
        record(context, "floorplan.symbol.update", "FacilityFloorSymbol", id, view.version(), "updated");
        return view;
    }

    @Override
    public void deleteSymbol(UUID id, long version, FacilityLayoutAuditContext context) {
        store.symbolByIdForUpdate(id).orElseThrow(ResourceNotFoundException::new);
        store.deleteSymbol(id, version);
        record(context, "floorplan.symbol.delete", "FacilityFloorSymbol", id, version, "deleted");
    }

    private void validateSymbol(SymbolCommand command, FacilityFloorView floor) {
        if (command.symbolType() == null || !SYMBOL_TYPES.contains(command.symbolType())) throw new IllegalArgumentException("symbolType is invalid");
        if (command.label() == null || command.label().isBlank()) throw new IllegalArgumentException("label must not be blank");
        JsonNode geometry = command.geometry();
        if (geometry == null || !geometry.isObject()) throw new IllegalArgumentException("geometry must be an object");
        if ("WALL_STRAIGHT".equals(command.symbolType()) || "PARTITION".equals(command.symbolType())) {
            point(geometry, "start", floor); point(geometry, "end", floor);
            if (geometry.path("start").equals(geometry.path("end"))) throw new IllegalArgumentException("wall endpoints must differ");
            positive(geometry, "thickness");
        } else if ("WALL_CURVED".equals(command.symbolType())) {
            point(geometry, "center", floor); positive(geometry, "radius"); angle(geometry, "startAngle"); nonZeroAngle(geometry, "sweepAngle");
        } else if ("DOOR".equals(command.symbolType())) {
            point(geometry, "hinge", floor); positive(geometry, "radius"); angle(geometry, "startAngle");
            if (geometry.path("sweepAngle").asInt(Integer.MIN_VALUE) != 90 && geometry.path("sweepAngle").asInt(Integer.MIN_VALUE) != -90) throw new IllegalArgumentException("door sweepAngle must be 90 or -90");
            String direction = geometry.path("openingDirection").asText();
            if (!"CLOCKWISE".equals(direction) && !"COUNTERCLOCKWISE".equals(direction)) throw new IllegalArgumentException("openingDirection is invalid");
        } else {
            int x = integer(geometry, "x"); int y = integer(geometry, "y"); int width = positive(geometry, "width"); int height = positive(geometry, "height");
            int rotation = integer(geometry, "rotation");
            if (!ROTATIONS.contains(rotation) || x < 0 || y < 0 || x + width > floor.gridColumns() || y + height > floor.gridRows()) throw new IllegalArgumentException("symbol geometry exceeds floor grid bounds");
        }
    }

    private static void point(JsonNode geometry, String key, FacilityFloorView floor) {
        JsonNode point = geometry.path(key);
        int x = integer(point, "x"); int y = integer(point, "y");
        if (x < 0 || y < 0 || x > floor.gridColumns() || y > floor.gridRows()) throw new IllegalArgumentException("point exceeds floor grid bounds");
    }

    private static int positive(JsonNode geometry, String key) {
        int value = integer(geometry, key);
        if (value < 1) throw new IllegalArgumentException(key + " must be positive");
        return value;
    }

    private static void angle(JsonNode geometry, String key) {
        int value = integer(geometry, key);
        if (value < -360 || value > 360) throw new IllegalArgumentException(key + " is invalid");
    }

    private static void nonZeroAngle(JsonNode geometry, String key) {
        angle(geometry, key);
        if (integer(geometry, key) == 0) throw new IllegalArgumentException(key + " must not be zero");
    }

    private static int integer(JsonNode geometry, String key) {
        JsonNode value = geometry.path(key);
        if (!value.isInt()) throw new IllegalArgumentException(key + " must be an integer");
        return value.intValue();
    }

    private void validateElement(ElementCommand command, FacilityFloorView floor, UUID excludedElementId) {
        if (command.elementType() == null || !ELEMENT_TYPES.contains(command.elementType())) {
            throw new IllegalArgumentException("elementType is invalid");
        }
        if (command.label() == null || command.label().isBlank()) throw new IllegalArgumentException("label must not be blank");
        if (command.doorSide() != null && !command.doorSide().isBlank() && !DOOR_SIDES.contains(command.doorSide())) {
            throw new IllegalArgumentException("doorSide is invalid");
        }
        boolean roomElement = "ROOM".equals(command.elementType());
        if (roomElement && command.roomId() == null) throw new IllegalArgumentException("ROOM element requires roomId");
        if (!roomElement && command.roomId() != null) throw new IllegalArgumentException("Only ROOM element can link roomId");
        if (roomElement && !store.roomIsActive(command.roomId())) throw new IllegalStateException("Phòng không tồn tại hoặc đã tạm ngừng.");
        if (roomElement && store.roomIsPlacedElsewhere(command.roomId(), excludedElementId)) {
            throw new IllegalStateException("Phòng đã được đặt trên mặt bằng khác.");
        }
        ensureWithinBounds(floor.gridColumns(), floor.gridRows(), command.gridX(), command.gridY(), command.gridWidth(), command.gridHeight());
        if (store.hasIntersectingElement(floor.id(), command.gridX(), command.gridY(), command.gridWidth(), command.gridHeight(), excludedElementId)) {
            throw new IllegalStateException("Phần tử mặt bằng chồng lấn với phần tử khác.");
        }
    }

    private static void validateFloor(FloorCommand command) {
        if (command.code() == null || command.code().isBlank() || command.name() == null || command.name().isBlank()) {
            throw new IllegalArgumentException("code and name must not be blank");
        }
        if (command.gridColumns() < 1 || command.gridColumns() > 100 || command.gridRows() < 1 || command.gridRows() > 100) {
            throw new IllegalArgumentException("grid dimensions must be between 1 and 100");
        }
    }

    private static void ensureWithinBounds(int columns, int rows, int x, int y, int width, int height) {
        if (x < 0 || y < 0 || width < 1 || height < 1 || x + width > columns || y + height > rows) {
            throw new IllegalArgumentException("Element geometry exceeds floor grid bounds");
        }
    }

    private void record(FacilityLayoutAuditContext context, String action, String resourceType, UUID resourceId, long version, String reason) {
        audit.record(context.actorAccountId(), context.permissionSnapshot(), action, "SUCCEEDED", reason, resourceType,
                resourceId, version, context.sessionId(), context.requestId(), context.correlationId());
    }

    private static String nullable(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }

    private static int offset(String cursor) {
        if (cursor == null || cursor.isBlank()) return 0;
        try {
            int result = Integer.parseInt(new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8));
            if (result < 0) throw new IllegalArgumentException("Cursor is invalid");
            return result;
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
