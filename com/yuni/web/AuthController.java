/*
 * Decompiled with CFR 0.152.
 */
package com.yuni.web;

import com.yuni.store.AppUser;
import com.yuni.web.AuthService;
import com.yuni.web.AuthSupport;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(value={"/api/auth"})
public class AuthController {
    private final AuthService auth;

    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    @PostMapping(value={"/register"})
    public ResponseEntity<Map<String, Object>> register(@RequestBody Credentials c, HttpServletRequest req) {
        AuthService.LoginResult r = this.auth.register(c.username(), c.password());
        if (!r.ok()) {
            return ResponseEntity.badRequest().body(this.err(r.error()));
        }
        return ResponseEntity.ok(this.enter(r.user(), req));
    }

    @PostMapping(value={"/login"})
    public ResponseEntity<Map<String, Object>> login(@RequestBody Credentials c, HttpServletRequest req) {
        AuthService.LoginResult r = this.auth.login(c.username(), c.password());
        if (!r.ok()) {
            return ResponseEntity.status((HttpStatusCode)HttpStatus.UNAUTHORIZED).body(this.err(r.error()));
        }
        return ResponseEntity.ok(this.enter(r.user(), req));
    }

    @PostMapping(value={"/logout"})
    public Map<String, Object> logout(HttpServletRequest req) {
        HttpSession s = req.getSession(false);
        if (s != null) {
            s.invalidate();
        }
        return Map.of("ok", true);
    }

    @GetMapping(value={"/me"})
    public ResponseEntity<Map<String, Object>> me(HttpServletRequest req) {
        AppUser u = this.auth.byId(AuthSupport.uid(req));
        if (u == null) {
            return ResponseEntity.status((HttpStatusCode)HttpStatus.UNAUTHORIZED).body(this.err("\u672a\u767b\u5f55"));
        }
        return ResponseEntity.ok(this.view(u));
    }

    private Map<String, Object> enter(AppUser u, HttpServletRequest req) {
        HttpSession previous = req.getSession(false);
        if (previous != null) previous.invalidate();
        HttpSession s = req.getSession(true);
        s.setAttribute("yuni.uid", (Object)u.getId());
        s.setMaxInactiveInterval(604800);
        return this.view(u);
    }

    private Map<String, Object> view(AppUser u) {
        LinkedHashMap<String, Object> m = new LinkedHashMap<String, Object>();
        m.put("id", u.getId());
        m.put("username", u.getUsername());
        m.put("style", u.getStyle());
        return m;
    }

    private Map<String, Object> err(String msg) {
        LinkedHashMap<String, Object> m = new LinkedHashMap<String, Object>();
        m.put("error", msg);
        return m;
    }

    public record Credentials(String username, String password) {
    }
}

