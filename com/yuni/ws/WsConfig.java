/*
 * Decompiled with CFR 0.152.
 */
package com.yuni.ws;

import com.yuni.web.AuthSupport;
import com.yuni.ws.ChatSocketHandler;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import java.util.Map;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.HandshakeInterceptor;

@Configuration
@EnableWebSocket
public class WsConfig
implements WebSocketConfigurer {
    private final ChatSocketHandler handler;

    public WsConfig(ChatSocketHandler handler) {
        this.handler = handler;
    }

    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler((WebSocketHandler)this.handler, new String[]{"/ws"}).setAllowedOriginPatterns(new String[]{"*"}).addInterceptors(new HandshakeInterceptor[]{new SessionUidInterceptor()});
    }

    static class SessionUidInterceptor
    implements HandshakeInterceptor {
        SessionUidInterceptor() {
        }

        public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler wsHandler, Map<String, Object> attributes) {
            if (request instanceof ServletServerHttpRequest) {
                HttpSession s;
                ServletServerHttpRequest servlet = (ServletServerHttpRequest)request;
                HttpServletRequest req = servlet.getServletRequest();
                String uid = AuthSupport.uid(req);
                if (uid == null && (s = req.getSession(false)) != null) {
                    Object v = s.getAttribute("yuni.uid");
                    String string = uid = v == null ? null : v.toString();
                }
                if (uid == null) {
                    return false;
                }
                attributes.put("uid", uid);
                return true;
            }
            return false;
        }

        public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler wsHandler, Exception exception) {
        }
    }
}

