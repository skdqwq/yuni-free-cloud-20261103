/*
 * Decompiled with CFR 0.152.
 */
package com.yuni.web;

import com.yuni.store.AppUser;
import com.yuni.store.AppUserRepository;
import java.time.LocalDateTime;
import java.util.UUID;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
    private static final String NAME_RULE = "^[\\u4e00-\\u9fa5A-Za-z0-9_-]{2,20}$";
    private static final int MIN_PASS = 6;
    private final AppUserRepository users;
    private final BCryptPasswordEncoder bcrypt = new BCryptPasswordEncoder();

    public AuthService(AppUserRepository users) {
        this.users = users;
    }

    @Transactional
    public LoginResult register(String username, String password) {
        String pass;
        String name = username == null ? "" : username.trim();
        String string = pass = password == null ? "" : password;
        if (!name.matches(NAME_RULE)) {
            return new LoginResult(null, "\u7528\u6237\u540d\u9700 2\u201420 \u4f4d\uff0c\u53ea\u7528\u4e2d\u6587\u3001\u5b57\u6bcd\u3001\u6570\u5b57\u3001\u4e0b\u5212\u7ebf\u6216\u8fde\u5b57\u7b26");
        }
        if (pass.length() < 6) {
            return new LoginResult(null, "\u5bc6\u7801\u81f3\u5c11 6 \u4f4d");
        }
        if (this.users.existsByUsername(name)) {
            return new LoginResult(null, "\u8fd9\u4e2a\u7528\u6237\u540d\u5df2\u7ecf\u88ab\u7528\u4e86");
        }
        AppUser u = new AppUser();
        u.setId(UUID.randomUUID().toString().substring(0, 8));
        u.setUsername(name);
        u.setPassHash(this.bcrypt.encode((CharSequence)pass));
        u.setStyle("gentle");
        u.setCreatedAt(LocalDateTime.now());
        u.setLastLoginAt(LocalDateTime.now());
        this.users.save(u);
        return new LoginResult(u, null);
    }

    @Transactional
    public LoginResult login(String username, String password) {
        String pass;
        String name = username == null ? "" : username.trim();
        String string = pass = password == null ? "" : password;
        if (name.isEmpty() || pass.isEmpty()) {
            return new LoginResult(null, "\u7528\u6237\u540d\u548c\u5bc6\u7801\u90fd\u8981\u586b");
        }
        AppUser u = this.users.findByUsername(name).orElse(null);
        if (u == null) {
            this.bcrypt.matches((CharSequence)pass, "$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUV");
            return new LoginResult(null, "\u7528\u6237\u540d\u6216\u5bc6\u7801\u4e0d\u5bf9");
        }
        if (!this.bcrypt.matches((CharSequence)pass, u.getPassHash())) {
            return new LoginResult(null, "\u7528\u6237\u540d\u6216\u5bc6\u7801\u4e0d\u5bf9");
        }
        u.setLastLoginAt(LocalDateTime.now());
        this.users.save(u);
        return new LoginResult(u, null);
    }

    public AppUser byId(String id) {
        return id == null ? null : (AppUser)this.users.findById(id).orElse(null);
    }

    public record LoginResult(AppUser user, String error) {
        public boolean ok() {
            return this.user != null;
        }
    }
}

