/*
 * Decompiled with CFR 0.152.
 */
package com.yuni.ws;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yuni.ws.WsHub;
import java.util.LinkedHashMap;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

@Component
public class ChatSocketHandler
extends TextWebSocketHandler {
    public static final String ATTR_UID = "uid";
    private final WsHub hub;
    private final ObjectMapper json = new ObjectMapper();

    public ChatSocketHandler(WsHub hub) {
        this.hub = hub;
    }

    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        Object uid = session.getAttributes().get(ATTR_UID);
        if (uid == null) {
            session.close(CloseStatus.NOT_ACCEPTABLE.withReason("\u672a\u767b\u5f55"));
            return;
        }
        this.hub.join(uid.toString(), session);
        LinkedHashMap<String, Object> hello = new LinkedHashMap<String, Object>();
        hello.put("type", "ready");
        hello.put("conns", this.hub.count(uid.toString()));
        session.sendMessage((WebSocketMessage)new TextMessage((CharSequence)this.json.writeValueAsString(hello)));
    }

    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        if ("ping".equals(message.getPayload())) {
            session.sendMessage((WebSocketMessage)new TextMessage((CharSequence)"{\"type\":\"pong\"}"));
        }
    }

    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        Object uid = session.getAttributes().get(ATTR_UID);
        if (uid != null) {
            this.hub.leave(uid.toString(), session);
            LinkedHashMap<String, Object> bye = new LinkedHashMap<String, Object>();
            bye.put("conns", this.hub.count(uid.toString()));
            this.hub.send(uid.toString(), "peer-left", bye);
        }
    }
}

