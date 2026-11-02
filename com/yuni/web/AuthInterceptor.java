/*
 * Decompiled with CFR 0.152.
 */
package com.yuni.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yuni.store.AppUser;
import com.yuni.web.AuthService;
import com.yuni.web.AuthSupport;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.Writer;
import java.util.Map;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class AuthInterceptor
implements HandlerInterceptor {
    private final AuthService auth;
    private final ObjectMapper json = new ObjectMapper();

    public AuthInterceptor(AuthService auth) {
        this.auth = auth;
    }

    public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object handler) throws Exception {
        AppUser u = this.auth.byId(AuthSupport.uid(req));
        if (u == null) {
            res.setStatus(401);
            res.setContentType("application/json;charset=UTF-8");
            this.json.writeValue((Writer)res.getWriter(), Map.of("error", "\u672a\u767b\u5f55", "needLogin", true));
            return false;
        }
        req.setAttribute("yuni.user", (Object)u);
        return true;
    }
}

