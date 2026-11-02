/*
 * Decompiled with CFR 0.152.
 */
package com.yuni.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yuni.llm.LlmClient;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(value={"/api/gateway"})
public class GatewayController {
    private final ObjectMapper json = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3L)).build();
    private final String base;
    private final LlmClient llm;

    public GatewayController(@Value(value="${yuni.llm.gateway-url:http://127.0.0.1:8071}") String base, LlmClient llm) {
        this.base = base == null ? "" : base.trim().replaceAll("/+$", "");
        this.llm = llm;
    }

    @GetMapping
    public Map<String, Object> status() {
        LinkedHashMap<String, Object> out = new LinkedHashMap<String, Object>();
        if (this.base.isBlank()) {
            out.put("online", false);
            out.put("error", "\u6ca1\u6709\u542f\u7528\u7f51\u5173\uff08yuni.llm.gateway-url \u4e3a\u7a7a\uff09");
            out.put("route", this.llm.route());
            return out;
        }
        out.put("gatewayUrl", this.base);
        try {
            JsonNode h = this.call("/health", null, 3);
            out.put("online", true);
            out.put("hasKey", h.path("hasKey").asBoolean(false));
            out.put("keyMasked", h.path("keyMasked").asText(""));
            out.put("keySource", h.path("keySource").asText("none"));
            out.put("model", h.path("model").asText(""));
            out.put("baseUrl", h.path("baseUrl").asText(""));
            out.put("version", h.path("version").asText(""));
            out.put("calls", h.path("calls").asInt(0));
            out.put("errors", h.path("errors").asInt(0));
            out.put("lastError", h.path("lastError").asText(""));
            out.put("route", this.llm.route());
            try {
                JsonNode cfg = this.call("/config", null, 3);
                out.put("presets", this.json.convertValue((Object)cfg.path("presets"), Object.class));
                out.put("configPath", cfg.path("configPath").asText(""));
            }
            catch (Exception exception) {}
        }
        catch (Exception e) {
            out.put("online", false);
            out.put("error", "\u8fde\u4e0d\u4e0a\u7f51\u5173 " + this.base);
            out.put("hint", "Python \u7f51\u5173\u6ca1\u542f\u52a8\u3002\u6b63\u5e38\u5206\u53d1\u7248\u91cc\u53cc\u51fb run.bat \u4f1a\u81ea\u52a8\u62c9\u8d77\uff1b\u5f00\u53d1\u65f6\u53ef\u4ee5\u5355\u72ec\u5728 gateway \u76ee\u5f55\u8dd1 python app.py\u3002");
            out.put("route", this.llm.route());
        }
        return out;
    }

    @PostMapping(value={"/config"})
    public Map<String, Object> save(@RequestBody ConfigRequest req) {
        LinkedHashMap<String, Object> out = new LinkedHashMap<String, Object>();
        LinkedHashMap<String, Object> body = new LinkedHashMap<String, Object>();
        if (req != null) {
            if (req.apiKey() != null) {
                body.put("apiKey", req.apiKey().trim());
            }
            if (req.baseUrl() != null) {
                body.put("baseUrl", req.baseUrl().trim());
            }
            if (req.model() != null) {
                body.put("model", req.model().trim());
            }
        }
        if (body.isEmpty()) {
            out.put("ok", false);
            out.put("error", "\u6ca1\u6709\u8981\u6539\u7684\u5b57\u6bb5");
            return out;
        }
        try {
            JsonNode r = this.call("/config", body, 8);
            this.llm.refreshGateway();
            out.put("ok", true);
            out.put("hasKey", r.path("hasKey").asBoolean(false));
            out.put("keyMasked", r.path("keyMasked").asText(""));
            out.put("keySource", r.path("keySource").asText("none"));
            out.put("model", r.path("model").asText(""));
            out.put("baseUrl", r.path("baseUrl").asText(""));
        }
        catch (Exception e) {
            out.put("ok", false);
            out.put("error", "\u5199\u4e0d\u8fdb\u7f51\u5173\uff1a\u7f51\u5173\u6ca1\u5728\u8dd1");
        }
        return out;
    }

    @PostMapping(value={"/test"})
    public Map<String, Object> test() {
        LinkedHashMap<String, Object> out = new LinkedHashMap<String, Object>();
        try {
            JsonNode r = this.call("/config/test", Map.of(), 45);
            boolean ok = r.path("ok").asBoolean(false);
            out.put("ok", ok);
            out.put("latencyMs", r.path("latencyMs").asInt(0));
            out.put("reply", r.path("reply").asText(""));
            out.put("model", r.path("model").asText(""));
            if (!ok) {
                out.put("error", r.path("error").asText("\u6d4b\u8bd5\u6ca1\u901a\u8fc7\uff0c\u4f46\u7f51\u5173\u6ca1\u7ed9\u539f\u56e0"));
                out.put("hint", r.path("hint").asText(""));
            }
            this.llm.refreshGateway();
        }
        catch (Exception e) {
            out.put("ok", false);
            out.put("error", "\u7f51\u5173\u6ca1\u6709\u54cd\u5e94\uff0c\u5148\u628a\u5b83\u542f\u52a8\u8d77\u6765");
        }
        return out;
    }

    private JsonNode call(String path, Map<String, Object> body, int timeoutSeconds) throws Exception {
        String text;
        HttpRequest.Builder b = HttpRequest.newBuilder().uri(URI.create(this.base + path)).timeout(Duration.ofSeconds(timeoutSeconds));
        if (body == null) {
            b.GET();
        } else {
            b.header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(this.json.writeValueAsString(body), StandardCharsets.UTF_8));
        }
        HttpResponse<String> r = this.http.send(b.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        String string = text = r.body() == null ? "" : r.body();
        if (text.isBlank()) {
            throw new IllegalStateException("\u7f51\u5173\u8fd4\u56de\u7a7a\u54cd\u5e94\uff08HTTP " + r.statusCode() + "\uff09");
        }
        return this.json.readTree(text);
    }

    public record ConfigRequest(String apiKey, String baseUrl, String model) {
    }
}

