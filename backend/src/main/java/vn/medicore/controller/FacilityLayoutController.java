package vn.medicore.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.medicore.common.web.RequestContext;
import vn.medicore.dto.AuthenticatedAccount;
import vn.medicore.dto.FacilityLayoutAuditContext;
import vn.medicore.dto.FacilityLayoutModels.CreateElementItem;
import vn.medicore.dto.FacilityLayoutModels.DeleteElementItem;
import vn.medicore.dto.FacilityLayoutModels.FacilityFloorElementView;
import vn.medicore.dto.FacilityLayoutModels.FacilityFloorSymbolView;
import vn.medicore.dto.FacilityLayoutModels.FacilityFloorView;
import vn.medicore.dto.FacilityLayoutModels.FacilityLayoutSnapshot;
import vn.medicore.dto.FacilityLayoutModels.FacilityRoomPlacementList;
import vn.medicore.dto.FacilityLayoutModels.LayoutChangesCommand;
import vn.medicore.dto.FacilityLayoutModels.Page;
import vn.medicore.dto.FacilityLayoutModels.UpdateElementItem;
import vn.medicore.service.FacilityLayoutService;
import vn.medicore.service.FacilityLayoutService.ElementCommand;
import vn.medicore.service.FacilityLayoutService.FloorCommand;
import vn.medicore.service.FacilityLayoutService.SymbolCommand;

@RestController
@RequestMapping("/api/v1")
public class FacilityLayoutController {

    private static final String ELEMENT_TYPES = "ROOM|WALKWAY|ELEVATOR|STAIRS|WC|RECEPTION|EQUIPMENT|WAITING_AREA|EMERGENCY_EXIT|OTHER";

    private final FacilityLayoutService service;

    public FacilityLayoutController(FacilityLayoutService service) {
        this.service = service;
    }

    @GetMapping("/facility-floors/{floorId}/layout")
    @PreAuthorize("hasAuthority('floorplan.read')")
    ResponseEntity<FacilityLayoutSnapshot> getLayoutSnapshot(@PathVariable UUID floorId) {
        FacilityLayoutSnapshot snapshot = service.getLayoutSnapshot(floorId);
        return versioned(snapshot, snapshot.floor().version());
    }

    @GetMapping("/facility-floors/room-placements")
    @PreAuthorize("hasAuthority('floorplan.read')")
    FacilityRoomPlacementList listRoomPlacements() {
        return new FacilityRoomPlacementList(service.getRoomPlacements());
    }

    @PostMapping("/facility-floors/{floorId}/layout/changes")
    @PreAuthorize("hasAuthority('floorplan.manage')")
    ResponseEntity<FacilityLayoutSnapshot> applyLayoutChanges(HttpServletRequest request, @PathVariable UUID floorId,
            @AuthenticationPrincipal AuthenticatedAccount principal, @Valid @RequestBody LayoutChangesRequest body) {
        FacilityLayoutSnapshot snapshot = service.applyLayoutChanges(floorId, body.toCommand(), auditContext(request, principal));
        return versioned(snapshot, snapshot.floor().version());
    }

    @GetMapping("/facility-floors")
    @PreAuthorize("hasAuthority('floorplan.read')")
    Page<FacilityFloorView> listFloors(@RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit) {
        return service.listFloors(cursor, limit);
    }

    @GetMapping("/facility-floors/{id}")
    @PreAuthorize("hasAuthority('floorplan.read')")
    ResponseEntity<FacilityFloorView> getFloor(@PathVariable UUID id) {
        FacilityFloorView view = service.getFloor(id);
        return versioned(view, view.version());
    }

    @PostMapping("/facility-floors")
    @PreAuthorize("hasAuthority('floorplan.manage')")
    ResponseEntity<FacilityFloorView> createFloor(HttpServletRequest request,
            @AuthenticationPrincipal AuthenticatedAccount principal, @Valid @RequestBody FloorRequest body) {
        FacilityFloorView view = service.createFloor(body.toCommand(), auditContext(request, principal));
        return versioned(view, view.version());
    }

    @PatchMapping("/facility-floors/{id}")
    @PreAuthorize("hasAuthority('floorplan.manage')")
    ResponseEntity<FacilityFloorView> updateFloor(HttpServletRequest request, @PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedAccount principal, @RequestHeader("If-Match") String ifMatch,
            @Valid @RequestBody FloorRequest body) {
        FacilityFloorView view = service.updateFloor(id, body.toCommand(), version(ifMatch), auditContext(request, principal));
        return versioned(view, view.version());
    }

    @DeleteMapping("/facility-floors/{id}")
    @PreAuthorize("hasAuthority('floorplan.manage')")
    ResponseEntity<Void> deleteFloor(HttpServletRequest request, @PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedAccount principal, @RequestHeader("If-Match") String ifMatch) {
        service.deleteFloor(id, version(ifMatch), auditContext(request, principal));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/facility-floors/{floorId}/elements")
    @PreAuthorize("hasAuthority('floorplan.read')")
    Page<FacilityFloorElementView> listElements(@PathVariable UUID floorId, @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "100") @Min(1) @Max(100) int limit) {
        return service.listElements(floorId, cursor, limit);
    }

    @PostMapping("/facility-floors/{floorId}/elements")
    @PreAuthorize("hasAuthority('floorplan.manage')")
    ResponseEntity<FacilityFloorElementView> createElement(HttpServletRequest request, @PathVariable UUID floorId,
            @AuthenticationPrincipal AuthenticatedAccount principal, @Valid @RequestBody ElementRequest body) {
        FacilityFloorElementView view = service.createElement(floorId, body.toCommand(), auditContext(request, principal));
        return versioned(view, view.version());
    }

    @GetMapping("/facility-floor-elements/{id}")
    @PreAuthorize("hasAuthority('floorplan.read')")
    ResponseEntity<FacilityFloorElementView> getElement(@PathVariable UUID id) {
        FacilityFloorElementView view = service.getElement(id);
        return versioned(view, view.version());
    }

    @PatchMapping("/facility-floor-elements/{id}")
    @PreAuthorize("hasAuthority('floorplan.manage')")
    ResponseEntity<FacilityFloorElementView> updateElement(HttpServletRequest request, @PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedAccount principal, @RequestHeader("If-Match") String ifMatch,
            @Valid @RequestBody ElementRequest body) {
        FacilityFloorElementView view = service.updateElement(id, body.toCommand(), version(ifMatch), auditContext(request, principal));
        return versioned(view, view.version());
    }

    @DeleteMapping("/facility-floor-elements/{id}")
    @PreAuthorize("hasAuthority('floorplan.manage')")
    ResponseEntity<Void> deleteElement(HttpServletRequest request, @PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedAccount principal, @RequestHeader("If-Match") String ifMatch) {
        service.deleteElement(id, version(ifMatch), auditContext(request, principal));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/facility-floors/{floorId}/symbols")
    @PreAuthorize("hasAuthority('floorplan.read')")
    Page<FacilityFloorSymbolView> listSymbols(@PathVariable UUID floorId, @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "100") @Min(1) @Max(100) int limit) {
        return service.listSymbols(floorId, cursor, limit);
    }

    @PostMapping("/facility-floors/{floorId}/symbols")
    @PreAuthorize("hasAuthority('floorplan.manage')")
    ResponseEntity<FacilityFloorSymbolView> createSymbol(HttpServletRequest request, @PathVariable UUID floorId,
            @AuthenticationPrincipal AuthenticatedAccount principal, @Valid @RequestBody SymbolRequest body) {
        FacilityFloorSymbolView view = service.createSymbol(floorId, body.toCommand(), auditContext(request, principal));
        return versioned(view, view.version());
    }

    @GetMapping("/facility-floor-symbols/{id}")
    @PreAuthorize("hasAuthority('floorplan.read')")
    ResponseEntity<FacilityFloorSymbolView> getSymbol(@PathVariable UUID id) {
        FacilityFloorSymbolView view = service.getSymbol(id);
        return versioned(view, view.version());
    }

    @PatchMapping("/facility-floor-symbols/{id}")
    @PreAuthorize("hasAuthority('floorplan.manage')")
    ResponseEntity<FacilityFloorSymbolView> updateSymbol(HttpServletRequest request, @PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedAccount principal, @RequestHeader("If-Match") String ifMatch,
            @Valid @RequestBody SymbolRequest body) {
        FacilityFloorSymbolView view = service.updateSymbol(id, body.toCommand(), version(ifMatch), auditContext(request, principal));
        return versioned(view, view.version());
    }

    @DeleteMapping("/facility-floor-symbols/{id}")
    @PreAuthorize("hasAuthority('floorplan.manage')")
    ResponseEntity<Void> deleteSymbol(HttpServletRequest request, @PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedAccount principal, @RequestHeader("If-Match") String ifMatch) {
        service.deleteSymbol(id, version(ifMatch), auditContext(request, principal));
        return ResponseEntity.noContent().build();
    }

    private static FacilityLayoutAuditContext auditContext(HttpServletRequest request, AuthenticatedAccount principal) {
        return new FacilityLayoutAuditContext(principal.accountId(), principal.sessionId().toString(),
                Map.of("permissions", List.copyOf(principal.permissions())), RequestContext.requestId(request),
                RequestContext.correlationId(request));
    }

    private static <T> ResponseEntity<T> versioned(T body, long version) {
        return ResponseEntity.ok().eTag(Long.toString(version)).body(body);
    }

    private static long version(String value) {
        if (value == null || !value.matches("^\"[0-9]+\"$")) throw new IllegalArgumentException("If-Match is invalid");
        return Long.parseLong(value.substring(1, value.length() - 1));
    }

    record FloorRequest(@NotBlank @Size(max = 64) String code, @NotBlank @Size(max = 200) String name,
                        int level, @Size(max = 1000) String description,
                        @Min(1) @Max(100) int gridColumns, @Min(1) @Max(100) int gridRows) {
        FloorCommand toCommand() {
            return new FloorCommand(code, name, level, description, gridColumns, gridRows);
        }
    }

    record ElementRequest(UUID roomId, @NotBlank @Pattern(regexp = ELEMENT_TYPES) String elementType,
                          @NotBlank @Size(max = 200) String label, @Min(0) int gridX, @Min(0) int gridY,
                          @Min(1) @Max(100) int gridWidth, @Min(1) @Max(100) int gridHeight,
                          int zIndex, @Pattern(regexp = "NORTH|EAST|SOUTH|WEST") String doorSide,
                          @Size(max = 1000) String notes) {
        ElementCommand toCommand() {
            return new ElementCommand(roomId, elementType, label, gridX, gridY, gridWidth, gridHeight, zIndex, doorSide, notes);
        }
    }

    record SymbolRequest(
            @NotBlank @Pattern(regexp = "WALL_STRAIGHT|WALL_CURVED|PARTITION|DOOR|STAIRS|ELEVATOR|WC|SKYWELL") String symbolType,
            @NotBlank @Size(max = 200) String label, @NotNull JsonNode geometry, int zIndex) {
        SymbolCommand toCommand() {
            return new SymbolCommand(symbolType, label, geometry, zIndex);
        }
    }

    record LayoutChangesRequest(
            List<@Valid ElementRequest> creates,
            List<@Valid UpdateElementItemRequest> updates,
            List<@Valid DeleteElementItemRequest> deletes) {
        LayoutChangesCommand toCommand() {
            List<CreateElementItem> createItems = creates == null ? List.of()
                    : creates.stream().map(c -> new CreateElementItem(
                            c.roomId(), c.elementType(), c.label(), c.gridX(), c.gridY(),
                            c.gridWidth(), c.gridHeight(), c.zIndex(), c.doorSide(), c.notes())).toList();
            List<UpdateElementItem> updateItems = updates == null ? List.of()
                    : updates.stream().map(u -> new UpdateElementItem(
                            u.id(), u.expectedVersion(), u.roomId(), u.elementType(), u.label(), u.gridX(), u.gridY(),
                            u.gridWidth(), u.gridHeight(), u.zIndex(), u.doorSide(), u.notes())).toList();
            List<DeleteElementItem> deleteItems = deletes == null ? List.of()
                    : deletes.stream().map(d -> new DeleteElementItem(d.id(), d.expectedVersion())).toList();
            return new LayoutChangesCommand(createItems, updateItems, deleteItems);
        }
    }

    record UpdateElementItemRequest(
            @NotNull UUID id, long expectedVersion, UUID roomId,
            @NotBlank @Pattern(regexp = ELEMENT_TYPES) String elementType,
            @NotBlank @Size(max = 200) String label, @Min(0) int gridX, @Min(0) int gridY,
            @Min(1) @Max(100) int gridWidth, @Min(1) @Max(100) int gridHeight,
            int zIndex, @Pattern(regexp = "NORTH|EAST|SOUTH|WEST") String doorSide,
            @Size(max = 1000) String notes) {
    }

    record DeleteElementItemRequest(@NotNull UUID id, long expectedVersion) {
    }
}
