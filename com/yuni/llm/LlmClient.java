/*
 * Decompiled with CFR 0.152.
 */
package com.yuni.llm;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import java.util.stream.Stream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class LlmClient {
    private static final Logger log = LoggerFactory.getLogger(LlmClient.class);
    private final ObjectMapper json = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8L)).build();
    private final String directBase;
    private final String directKey;
    private final String gatewayBase;
    private final String model;
    private final int timeoutSeconds;
    private static final long GATEWAY_TTL_MS = 30000L;
    private volatile Boolean gatewayOk;
    private volatile long gatewayCheckedAt;
    private volatile String gatewayModel = "";

    public LlmClient(@Value(value="${yuni.llm.base-url:https://api.deepseek.com}") String baseUrl, @Value(value="${yuni.llm.api-key:}") String apiKey, @Value(value="${yuni.llm.model:deepseek-chat}") String model, @Value(value="${yuni.llm.timeout-seconds:45}") int timeoutSeconds, @Value(value="${yuni.llm.gateway-url:http://127.0.0.1:8071}") String gatewayUrl) {
        this.directBase = LlmClient.trimSlash(baseUrl);
        String env = System.getenv("DEEPSEEK_API_KEY");
        this.directKey = apiKey != null && !apiKey.isBlank() ? apiKey : (env == null ? "" : env.trim());
        this.gatewayBase = gatewayUrl == null ? "" : gatewayUrl.trim().replaceAll("/+$", "");
        this.model = model;
        this.timeoutSeconds = timeoutSeconds;
        if (!this.gatewayBase.isBlank()) {
            log.info("\u6a21\u578b\u63a5\u5165\uff1a\u4f18\u5148 Python \u7f51\u5173 {}\uff1b\u7f51\u5173\u4e0d\u53ef\u7528\u65f6{}", (Object)this.gatewayBase, this.directKey.isBlank() ? "\u56de\u843d\u5185\u7f6e\u8bdd\u672f" : "\u76f4\u8fde " + this.directBase);
        } else {
            log.info("\u6a21\u578b\u63a5\u5165\uff1a\u76f4\u8fde {} / {}\uff08{}\uff09", new Object[]{this.directBase, this.model, this.directKey.isBlank() ? "\u672a\u914d\u7f6e key\uff0c\u5c06\u56de\u843d\u5267\u672c" : "\u5df2\u914d\u7f6e key"});
        }
    }

    public boolean available() {
        return this.gatewayReady() || !this.directKey.isBlank();
    }

    public String route() {
        if (this.gatewayReady()) {
            return "gateway";
        }
        return this.directKey.isBlank() ? "script" : "direct";
    }

    public String model() {
        if (this.gatewayReady() && !this.gatewayModel.isBlank()) {
            return this.gatewayModel;
        }
        return this.model;
    }

    public void refreshGateway() {
        this.gatewayOk = null;
        this.gatewayCheckedAt = 0L;
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     */
    private boolean gatewayReady() {
        if (this.gatewayBase.isBlank()) {
            return false;
        }
        Boolean cached = this.gatewayOk;
        if (cached != null && System.currentTimeMillis() - this.gatewayCheckedAt < 30000L) {
            return cached;
        }
        LlmClient llmClient = this;
        synchronized (llmClient) {
            if (this.gatewayOk != null && System.currentTimeMillis() - this.gatewayCheckedAt < 30000L) {
                return this.gatewayOk;
            }
            this.gatewayCheckedAt = System.currentTimeMillis();
            boolean ok = this.probeGateway();
            this.gatewayOk = ok;
            return ok;
        }
    }

    private boolean probeGateway() {
        try {
            HttpRequest req = HttpRequest.newBuilder().uri(URI.create(this.gatewayBase + "/health")).timeout(Duration.ofMillis(1500L)).GET().build();
            HttpResponse<String> resp = this.http.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (resp.statusCode() / 100 != 2) {
                return false;
            }
            JsonNode n = this.json.readTree(resp.body());
            this.gatewayModel = n.path("model").asText("");
            return n.path("hasKey").asBoolean(false);
        }
        catch (Exception e) {
            this.gatewayModel = "";
            return false;
        }
    }

    public String complete(List<Map<String, String>> messages, double temperature, int maxTokens) {
        Map<String, Object> body = this.payload(messages, temperature, maxTokens, false, false);
        HttpResponse<String> resp = this.send(body, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (resp.statusCode() / 100 != 2) {
            throw new IllegalStateException("\u6a21\u578b\u8fd4\u56de " + resp.statusCode() + "\uff1a" + LlmClient.brief(resp.body()));
        }
        try {
            JsonNode root = this.json.readTree(resp.body());
            return root.path("choices").path(0).path("message").path("content").asText("");
        }
        catch (Exception e) {
            throw new IllegalStateException("\u6a21\u578b\u54cd\u5e94\u89e3\u6790\u5931\u8d25\uff1a" + e.getMessage(), e);
        }
    }

    public String completeJson(List<Map<String, String>> messages, int maxTokens) {
        Map<String, Object> body = this.payload(messages, 0.2, maxTokens, true, false);
        HttpResponse<String> resp = this.send(body, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (resp.statusCode() / 100 != 2) {
            throw new IllegalStateException("\u6a21\u578b\u8fd4\u56de " + resp.statusCode() + "\uff1a" + LlmClient.brief(resp.body()));
        }
        try {
            JsonNode root = this.json.readTree(resp.body());
            return root.path("choices").path(0).path("message").path("content").asText("");
        }
        catch (Exception e) {
            throw new IllegalStateException("\u6a21\u578b\u54cd\u5e94\u89e3\u6790\u5931\u8d25\uff1a" + e.getMessage(), e);
        }
    }

    public String stream(List<Map<String, String>> messages, double temperature, int maxTokens, Consumer<String> onDelta) {
        Map<String, Object> body = this.payload(messages, temperature, maxTokens, false, true);
        HttpResponse<Stream<String>> resp = this.send(body, HttpResponse.BodyHandlers.ofLines());
        if (resp.statusCode() / 100 != 2) {
            String text = resp.body().reduce("", (a, b) -> a + b);
            throw new IllegalStateException("\u6a21\u578b\u8fd4\u56de " + resp.statusCode() + "\uff1a" + LlmClient.brief(text));
        }
        StringBuilder full = new StringBuilder();
        try (Stream<String> lines = resp.body();){
            lines.forEach(line -> {
                if (!line.startsWith("data:")) {
                    return;
                }
                String data = line.substring(5).trim();
                if (data.isEmpty() || "[DONE]".equals(data)) {
                    return;
                }
                try {
                    JsonNode node = this.json.readTree(data);
                    JsonNode delta = node.path("choices").path(0).path("delta").path("content");
                    if (delta.isMissingNode() || delta.isNull()) {
                        return;
                    }
                    String piece = delta.asText("");
                    if (piece.isEmpty()) {
                        return;
                    }
                    full.append(piece);
                    if (onDelta != null) {
                        onDelta.accept(piece);
                    }
                }
                catch (Exception exception) {
                    // empty catch block
                }
            });
        }
        return full.toString();
    }

    private Map<String, Object> payload(List<Map<String, String>> messages, double temperature, int maxTokens, boolean jsonMode, boolean stream) {
        LinkedHashMap<String, Object> body = new LinkedHashMap<String, Object>();
        body.put("model", this.model);
        body.put("messages", new ArrayList<Map<String, String>>(messages));
        body.put("temperature", temperature);
        body.put("max_tokens", maxTokens);
        body.put("stream", stream);
        if (jsonMode) {
            body.put("response_format", Map.of("type", "json_object"));
        }
        return body;
    }

    private <T> HttpResponse<T> send(Map<String, Object> body, HttpResponse.BodyHandler<T> handler) {
        boolean viaGateway = this.gatewayReady();
        String url = (viaGateway ? this.gatewayBase : this.directBase) + "/chat/completions";
        try {
            HttpRequest.Builder b = HttpRequest.newBuilder().uri(URI.create(url)).timeout(Duration.ofSeconds(this.timeoutSeconds)).header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(this.json.writeValueAsString(body), StandardCharsets.UTF_8));
            if (!viaGateway && !this.directKey.isBlank()) {
                b.header("Authorization", "Bearer " + this.directKey);
            }
            return this.http.send(b.build(), handler);
        }
        catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("\u6a21\u578b\u8c03\u7528\u88ab\u4e2d\u65ad", e);
        }
        catch (Exception e) {
            throw new IllegalStateException("\u6a21\u578b\u8c03\u7528\u5931\u8d25\uff1a" + e.getMessage(), e);
        }
    }

    private static String trimSlash(String s) {
        if (s == null || s.isBlank()) {
            return "https://api.deepseek.com";
        }
        return s.endsWith("/") ? s.substring(0, s.length() - 1) : s;
    }

    private static String brief(String s) {
        if (s == null) {
            return "";
        }
        return s.length() > 240 ? s.substring(0, 240) + "\u2026" : s;
    }
}

