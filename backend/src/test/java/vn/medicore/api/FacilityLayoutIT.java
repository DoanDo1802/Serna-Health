package vn.medicore.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockCookie;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import vn.medicore.MediCoreApplication;
import vn.medicore.config.SecretHasher;

@Testcontainers
@SpringBootTest(classes = MediCoreApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class FacilityLayoutIT {

    private static final UUID CATALOG_ADMINISTRATOR_ROLE_ID = UUID.fromString("01980000-0000-7000-8000-000000000004");
    private static final String TAB_CONTEXT = "LLLLLLLLLLLLLLLLLLLLLL";
    private static final String SESSION_COOKIE = "MEDICORE_SESSION_" + TAB_CONTEXT;

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17.10");

    @Autowired
    MockMvc mockMvc;

    @Autowired
    DataSource dataSource;

    @Autowired
    SecretHasher secretHasher;

    @Autowired
    ObjectMapper objectMapper;

    @Test
    void getLayoutSnapshot_returnsFloorElementsAndSymbols() throws Exception {
        AuthSession admin = administrator();
        UUID floorId = createFloor(admin, "SNAP-1", "Snapshot Floor 1", 1, 20, 20);
        UUID elementId = createElement(admin, floorId, null, "ROOM", "Room 101", 0, 0, 3, 3);
        UUID symbolId = createSymbol(admin, floorId, "WALL_STRAIGHT", "Wall 1",
                """
                {"start":{"x":0,"y":0},"end":{"x":10,"y":0},"thickness":0.2}
                """);

        MvcResult result = mockMvc.perform(get("/api/v1/facility-floors/{floorId}/layout", floorId)
                        .header("X-MediCore-Tab-Context", TAB_CONTEXT)
                        .cookie(admin.cookie()))
                .andExpect(status().isOk())
                .andExpect(header().exists("ETag"))
                .andExpect(jsonPath("$.floor.id").value(floorId.toString()))
                .andExpect(jsonPath("$.floor.code").value("SNAP-1"))
                .andExpect(jsonPath("$.elements.length()").value(1))
                .andExpect(jsonPath("$.elements[0].id").value(elementId.toString()))
                .andExpect(jsonPath("$.elements[0].label").value("Room 101"))
                .andExpect(jsonPath("$.symbols.length()").value(1))
                .andExpect(jsonPath("$.symbols[0].id").value(symbolId.toString()))
                .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString(StandardCharsets.UTF_8));
        assertThat(body.path("floor").path("name").asText()).isEqualTo("Snapshot Floor 1");
    }

    @Test
    void getRoomPlacements_returnsAllPlacedRoomsAcrossFloors() throws Exception {
        AuthSession admin = administrator();
        UUID deptId = createDepartment(admin, "PL-DEPT", "Placement Dept");
        UUID room1 = createRoom(admin, deptId, "PL-R1", "Placement Room 1");
        UUID room2 = createRoom(admin, deptId, "PL-R2", "Placement Room 2");

        UUID floor1 = createFloor(admin, "PL-F1", "Placement Floor 1", 10, 20, 20);
        UUID floor2 = createFloor(admin, "PL-F2", "Placement Floor 2", 11, 20, 20);

        createElement(admin, floor1, room1, "ROOM", "R1 Slot", 0, 0, 2, 2);
        createElement(admin, floor2, room2, "ROOM", "R2 Slot", 0, 0, 2, 2);

        MvcResult result = mockMvc.perform(get("/api/v1/facility-floors/room-placements")
                        .header("X-MediCore-Tab-Context", TAB_CONTEXT)
                        .cookie(admin.cookie()))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString(StandardCharsets.UTF_8));
        JsonNode items = body.path("items");
        assertThat(items.isArray()).isTrue();

        boolean foundR1 = false;
        boolean foundR2 = false;
        for (JsonNode item : items) {
            if (item.path("roomId").asText().equals(room1.toString())) {
                assertThat(item.path("floorId").asText()).isEqualTo(floor1.toString());
                foundR1 = true;
            }
            if (item.path("roomId").asText().equals(room2.toString())) {
                assertThat(item.path("floorId").asText()).isEqualTo(floor2.toString());
                foundR2 = true;
            }
        }
        assertThat(foundR1).isTrue();
        assertThat(foundR2).isTrue();
    }

    @Test
    void applyLayoutChanges_atomicBatchWithCreatesUpdatesDeletesAndIdempotency() throws Exception {
        AuthSession admin = administrator();
        UUID floorId = createFloor(admin, "BATCH-1", "Batch Floor", 20, 30, 30);
        UUID elem1 = createElement(admin, floorId, null, "ROOM", "Element 1", 0, 0, 2, 2);
        UUID elem2 = createElement(admin, floorId, null, "WALKWAY", "Element 2", 3, 0, 2, 2);

        // Fetch current floor version
        JsonNode snapBefore = getSnapshot(admin, floorId);
        long floorVersion = snapBefore.path("floor").path("version").asLong();

        String idempotencyKey = "layout-batch-" + UUID.randomUUID();
        String payload = """
                {
                  "expectedFloorVersion": %d,
                  "creates": [
                    {
                      "elementType": "RECEPTION",
                      "label": "Reception Desk",
                      "gridX": 6,
                      "gridY": 0,
                      "gridWidth": 3,
                      "gridHeight": 2,
                      "zIndex": 1
                    }
                  ],
                  "updates": [
                    {
                      "id": "%s",
                      "elementType": "ROOM",
                      "label": "Element 1 Renamed",
                      "gridX": 0,
                      "gridY": 0,
                      "gridWidth": 2,
                      "gridHeight": 2,
                      "zIndex": 1
                    }
                  ],
                  "deletes": [
                    {
                      "id": "%s",
                      "expectedVersion": 0
                    }
                  ]
                }
                """.formatted(floorVersion, elem1, elem2);

        // First execution
        MvcResult firstResult = mockMvc.perform(post("/api/v1/facility-floors/{floorId}/layout/changes", floorId)
                        .header("X-MediCore-Tab-Context", TAB_CONTEXT)
                        .cookie(admin.cookie())
                        .header("X-CSRF-Token", admin.csrfToken())
                        .header("Idempotency-Key", idempotencyKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(header().exists("ETag"))
                .andReturn();

        JsonNode response1 = objectMapper.readTree(firstResult.getResponse().getContentAsString(StandardCharsets.UTF_8));
        assertThat(response1.path("floor").path("version").asLong()).isEqualTo(floorVersion + 1);
        assertThat(response1.path("elements").size()).isEqualTo(2); // elem1 (updated) and created reception

        boolean hasElem1Renamed = false;
        boolean hasReception = false;
        boolean hasElem2 = false;
        for (JsonNode el : response1.path("elements")) {
            if (el.path("id").asText().equals(elem1.toString())) {
                assertThat(el.path("label").asText()).isEqualTo("Element 1 Renamed");
                hasElem1Renamed = true;
            }
            if (el.path("label").asText().equals("Reception Desk")) {
                hasReception = true;
            }
            if (el.path("id").asText().equals(elem2.toString())) {
                hasElem2 = true;
            }
        }
        assertThat(hasElem1Renamed).isTrue();
        assertThat(hasReception).isTrue();
        assertThat(hasElem2).isFalse();

        // Idempotent replay: send exact same request again with same idempotency key
        MvcResult replayResult = mockMvc.perform(post("/api/v1/facility-floors/{floorId}/layout/changes", floorId)
                        .header("X-MediCore-Tab-Context", TAB_CONTEXT)
                        .cookie(admin.cookie())
                        .header("X-CSRF-Token", admin.csrfToken())
                        .header("Idempotency-Key", idempotencyKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode response2 = objectMapper.readTree(replayResult.getResponse().getContentAsString(StandardCharsets.UTF_8));
        assertThat(response2).isEqualTo(response1);
    }

    @Test
    void applyLayoutChanges_rollsBackOnCollision() throws Exception {
        AuthSession admin = administrator();
        UUID floorId = createFloor(admin, "COLL-1", "Collision Floor", 30, 20, 20);
        UUID elem1 = createElement(admin, floorId, null, "ROOM", "Element 1", 0, 0, 3, 3);

        JsonNode snapBefore = getSnapshot(admin, floorId);
        long floorVersion = snapBefore.path("floor").path("version").asLong();

        // Attempt to create an element overlapping with elem1 (at x=1, y=1, w=2, h=2)
        String payload = """
                {
                  "expectedFloorVersion": %d,
                  "creates": [
                    {
                      "elementType": "ROOM",
                      "label": "Overlapping Room",
                      "gridX": 1,
                      "gridY": 1,
                      "gridWidth": 2,
                      "gridHeight": 2
                    }
                  ]
                }
                """.formatted(floorVersion);

        mockMvc.perform(post("/api/v1/facility-floors/{floorId}/layout/changes", floorId)
                        .header("X-MediCore-Tab-Context", TAB_CONTEXT)
                        .cookie(admin.cookie())
                        .header("X-CSRF-Token", admin.csrfToken())
                        .header("Idempotency-Key", "collision-test-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BUSINESS_RULE_VIOLATION"));

        // Verify floor was NOT modified and element count is still 1
        JsonNode snapAfter = getSnapshot(admin, floorId);
        assertThat(snapAfter.path("floor").path("version").asLong()).isEqualTo(floorVersion);
        assertThat(snapAfter.path("elements").size()).isEqualTo(1);
    }

    @Test
    void applyLayoutChanges_rejectsStaleVersion() throws Exception {
        AuthSession admin = administrator();
        UUID floorId = createFloor(admin, "STALE-1", "Stale Version Floor", 40, 20, 20);

        String payload = """
                {
                  "expectedFloorVersion": 99999,
                  "creates": [
                    {
                      "elementType": "WALKWAY",
                      "label": "Hallway",
                      "gridX": 0,
                      "gridY": 0,
                      "gridWidth": 1,
                      "gridHeight": 1
                    }
                  ]
                }
                """;

        mockMvc.perform(post("/api/v1/facility-floors/{floorId}/layout/changes", floorId)
                        .header("X-MediCore-Tab-Context", TAB_CONTEXT)
                        .cookie(admin.cookie())
                        .header("X-CSRF-Token", admin.csrfToken())
                        .header("Idempotency-Key", "stale-test-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isPreconditionFailed())
                .andExpect(jsonPath("$.code").value("STALE_VERSION"));
    }

    private JsonNode getSnapshot(AuthSession admin, UUID floorId) throws Exception {
        MvcResult res = mockMvc.perform(get("/api/v1/facility-floors/{floorId}/layout", floorId)
                        .header("X-MediCore-Tab-Context", TAB_CONTEXT)
                        .cookie(admin.cookie()))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(res.getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    private UUID createFloor(AuthSession admin, String code, String name, int level, int cols, int rows) throws Exception {
        MvcResult res = mockMvc.perform(post("/api/v1/facility-floors")
                        .header("X-MediCore-Tab-Context", TAB_CONTEXT)
                        .cookie(admin.cookie())
                        .header("X-CSRF-Token", admin.csrfToken())
                        .header("Idempotency-Key", "floor-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "code": "%s",
                                  "name": "%s",
                                  "level": %d,
                                  "gridColumns": %d,
                                  "gridRows": %d
                                }
                                """.formatted(code, name, level, cols, rows)))
                .andExpect(status().isOk())
                .andReturn();
        return UUID.fromString(objectMapper.readTree(res.getResponse().getContentAsString()).path("id").asText());
    }

    private UUID createElement(AuthSession admin, UUID floorId, UUID roomId, String type, String label,
            int x, int y, int w, int h) throws Exception {
        String roomField = roomId == null ? "" : "\"roomId\":\"" + roomId + "\",";
        MvcResult res = mockMvc.perform(post("/api/v1/facility-floors/{floorId}/elements", floorId)
                        .header("X-MediCore-Tab-Context", TAB_CONTEXT)
                        .cookie(admin.cookie())
                        .header("X-CSRF-Token", admin.csrfToken())
                        .header("Idempotency-Key", "elem-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  %s
                                  "elementType": "%s",
                                  "label": "%s",
                                  "gridX": %d,
                                  "gridY": %d,
                                  "gridWidth": %d,
                                  "gridHeight": %d,
                                  "zIndex": 1
                                }
                                """.formatted(roomField, type, label, x, y, w, h)))
                .andExpect(status().isOk())
                .andReturn();
        return UUID.fromString(objectMapper.readTree(res.getResponse().getContentAsString()).path("id").asText());
    }

    private UUID createSymbol(AuthSession admin, UUID floorId, String type, String label, String geometryJson) throws Exception {
        MvcResult res = mockMvc.perform(post("/api/v1/facility-floors/{floorId}/symbols", floorId)
                        .header("X-MediCore-Tab-Context", TAB_CONTEXT)
                        .cookie(admin.cookie())
                        .header("X-CSRF-Token", admin.csrfToken())
                        .header("Idempotency-Key", "symbol-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "symbolType": "%s",
                                  "label": "%s",
                                  "geometry": %s,
                                  "zIndex": 1
                                }
                                """.formatted(type, label, geometryJson)))
                .andExpect(status().isOk())
                .andReturn();
        return UUID.fromString(objectMapper.readTree(res.getResponse().getContentAsString()).path("id").asText());
    }

    private UUID createDepartment(AuthSession session, String code, String name) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/departments")
                        .header("X-MediCore-Tab-Context", TAB_CONTEXT)
                        .cookie(session.cookie())
                        .header("X-CSRF-Token", session.csrfToken())
                        .header("Idempotency-Key", "dept-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"%s","name":"%s","effectiveFrom":"2030-01-01T00:00:00Z"}
                                """.formatted(code, name)))
                .andExpect(status().isOk())
                .andReturn();
        return UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString()).path("id").asText());
    }

    private UUID createRoom(AuthSession session, UUID departmentId, String code, String name) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/rooms")
                        .header("X-MediCore-Tab-Context", TAB_CONTEXT)
                        .cookie(session.cookie())
                        .header("X-CSRF-Token", session.csrfToken())
                        .header("Idempotency-Key", "room-" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"departmentId":"%s","code":"%s","name":"%s"}
                                """.formatted(departmentId, code, name)))
                .andExpect(status().isOk())
                .andReturn();
        return UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString()).path("id").asText());
    }

    private AuthSession administrator() {
        return session(Set.of(CATALOG_ADMINISTRATOR_ROLE_ID));
    }

    private AuthSession session(Set<UUID> roleIds) {
        UUID accountId = UUID.randomUUID();
        UUID sessionId = UUID.randomUUID();
        String rawSession = "session-" + UUID.randomUUID();
        String csrfToken = "csrf-" + UUID.randomUUID();
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        jdbc.update("""
                insert into user_account(id, normalized_email, display_email, status, failed_login_count, version, created_at, updated_at)
                values (?, ?, ?, 'ACTIVE', 0, 0, now(), now())
                """, accountId, accountId + "@example.com", accountId + "@example.com");
        for (UUID roleId : roleIds) {
            jdbc.update("""
                    insert into account_role_assignment(id, account_id, role_id, department_id, effective_from, effective_to,
                        status, assigned_by_account_id, reason, version)
                    values (?, ?, ?, null, now() - interval '1 minute', null, 'ACTIVE', ?, 'Layout test role', 0)
                    """, UUID.randomUUID(), accountId, roleId, accountId);
        }
        jdbc.update("""
                insert into account_session(id, account_id, session_token_hash, csrf_token_hash, tab_context_hash, status,
                    authenticated_at, last_seen_at, absolute_expires_at, version)
                values (?, ?, ?, ?, ?, 'ACTIVE', now(), now(), now() + interval '1 hour', 0)
                """, sessionId, accountId, secretHasher.hash("SESSION", rawSession), secretHasher.hash("CSRF", csrfToken),
                secretHasher.hash("SESSION_CONTEXT", TAB_CONTEXT));
        return new AuthSession(accountId, sessionId, new MockCookie(SESSION_COOKIE, rawSession), csrfToken);
    }

    private record AuthSession(UUID accountId, UUID sessionId, MockCookie cookie, String csrfToken) {
    }
}
