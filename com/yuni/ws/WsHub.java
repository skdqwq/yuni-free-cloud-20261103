/*
 * Decompiled with CFR 0.152.
 */
package com.yuni.ws;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketMessage;
import org.springframework.web.socket.WebSocketSession;

@Component
public class WsHub {
    private static final Logger log = LoggerFactory.getLogger(WsHub.class);
    private final Map<String, Set<WebSocketSession>> byUser = new ConcurrentHashMap<String, Set<WebSocketSession>>();
    private final ObjectMapper json = new ObjectMapper();

    public void join(String userId, WebSocketSession session) {
        this.byUser.computeIfAbsent(userId, k -> new CopyOnWriteArraySet()).add(session);
        log.info("ws join user={} conn={} now={}", new Object[]{userId, session.getId(), this.count(userId)});
    }

    public void leave(String userId, WebSocketSession session) {
        Set<WebSocketSession> set = this.byUser.get(userId);
        if (set != null) {
            set.remove(session);
            if (set.isEmpty()) {
                this.byUser.remove(userId);
            }
        }
    }

    public int count(String userId) {
        Set<WebSocketSession> set = this.byUser.get(userId);
        return set == null ? 0 : set.size();
    }

    public boolean online(String userId) {
        return this.count(userId) > 0;
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     */
    public void send(String userId, String type, Map<String, Object> payload) {
        String text;
        Set<WebSocketSession> set = this.byUser.get(userId);
        if (set == null || set.isEmpty()) {
            return;
        }
        LinkedHashMap<String, Object> frame = new LinkedHashMap<String, Object>();
        frame.put("type", type);
        frame.put("at", System.currentTimeMillis());
        frame.putAll(payload);
        try {
            text = this.json.writeValueAsString(frame);
        }
        catch (Exception e) {
            log.warn("ws \u5e8f\u5217\u5316\u5931\u8d25: {}", (Object)e.getMessage());
            return;
        }
        for (WebSocketSession s : set) {
            try {
                if (s.isOpen()) {
                    WebSocketSession webSocketSession = s;
                    synchronized (webSocketSession) {
                        s.sendMessage((WebSocketMessage)new TextMessage((CharSequence)text));
                        continue;
                    }
                }
                set.remove(s);
            }
            catch (Exception e) {
                set.remove(s);
            }
        }
    }
}

