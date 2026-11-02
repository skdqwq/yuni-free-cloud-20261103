/*
 * Decompiled with CFR 0.152.
 */
package com.yuni.ws;

import com.yuni.web.ChatService;
import com.yuni.ws.WsHub;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class ReplyStreamer {
    private static final Logger log = LoggerFactory.getLogger(ReplyStreamer.class);
    private final WsHub hub;

    public ReplyStreamer(WsHub hub) {
        this.hub = hub;
    }

    public boolean online(String userId) {
        return userId != null && this.hub.online(userId);
    }

    public void echo(String userId, String sessionId, String userText) {
        if (!this.online(userId)) {
            return;
        }
        LinkedHashMap<String, Object> head = new LinkedHashMap<String, Object>();
        head.put("sessionId", sessionId);
        head.put("text", userText);
        this.hub.send(userId, "user", head);
    }

    public void begin(String userId, String sessionId) {
        if (!this.online(userId)) {
            return;
        }
        this.hub.send(userId, "start", Map.of("sessionId", sessionId));
    }

    public void delta(String userId, String piece) {
        if (!this.online(userId) || piece == null || piece.isEmpty()) {
            return;
        }
        this.hub.send(userId, "token", Map.of("t", piece));
    }

    public void end(String userId, ChatService.ChatReply reply) {
        if (!this.online(userId)) {
            return;
        }
        try {
            LinkedHashMap<String, Object> end = new LinkedHashMap<String, Object>();
            end.put("sessionId", reply.sessionId());
            end.put("reply", reply.reply());
            end.put("quickReplies", reply.quickReplies());
            end.put("state", reply.state());
            end.put("intent", reply.intent());
            end.put("wrapcard", reply.wrapcard());
            end.put("trace", reply.trace());
            end.put("runId", reply.runId());
            end.put("cacheBackend", reply.cacheBackend());
            end.put("engine", reply.engine());
            this.hub.send(userId, "end", end);
        }
        catch (Exception e) {
            log.warn("\u63a8\u9001\u5931\u8d25: {}", (Object)e.getMessage());
        }
    }

    public void confirm(String userId, String runId, String action, Object record) {
        LinkedHashMap<String, Object> m = new LinkedHashMap<String, Object>();
        m.put("runId", runId);
        m.put("action", action);
        m.put("record", record);
        this.hub.send(userId, "confirm", m);
    }

    public void reset(String userId, String sessionId) {
        this.hub.send(userId, "reset", Map.of("sessionId", sessionId));
    }
}

