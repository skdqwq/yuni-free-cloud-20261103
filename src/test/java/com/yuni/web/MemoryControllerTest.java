package com.yuni.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yuni.store.AppUser;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import static org.junit.jupiter.api.Assertions.*;

class MemoryControllerTest {
    @Test
    void settingsResponseRetainsStructuredMemoryValues() throws Exception {
        var profile = MemoryService.empty();
        profile.put("enabled", true);
        profile.put("address", Map.of("name", "Local review"));
        profile.put("promises", List.of(Map.of("task", "Read a chapter")));
        var memory = new MemoryService(null, null, null) {
            @Override public Map<String, Object> get(String userId) {
                assertEquals("review-user", userId);
                return profile;
            }
        };
        var request = new MockHttpServletRequest();
        var user = new AppUser();
        user.setId("review-user");
        request.setAttribute(AuthSupport.USER, user);
        var response = new MemoryController(memory).get(request);
        var encoded = new ObjectMapper().valueToTree(response);
        assertEquals(7, encoded.get("fields").size());
        assertEquals("Local review", encoded.get("fields").get(0).get("value").get("name").asText());
        assertTrue(encoded.get("fields").get(4).get("value").isArray());
        assertTrue(encoded.get("fields").get(6).get("value").isObject());
        assertTrue(encoded.get("enabled").asBoolean());
    }
}
