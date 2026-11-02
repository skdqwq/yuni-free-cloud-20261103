/*
 * Decompiled with CFR 0.152.
 */
package com.yuni.web;

import com.yuni.store.AppUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;

public final class AuthSupport {
    public static final String UID = "yuni.uid";
    public static final String USER = "yuni.user";

    private AuthSupport() {
    }

    public static AppUser user(HttpServletRequest req) {
        Object u = req.getAttribute(USER);
        return u instanceof AppUser ? (AppUser)u : null;
    }

    public static String uid(HttpServletRequest req) {
        HttpSession s = req.getSession(false);
        if (s == null) {
            return null;
        }
        Object v = s.getAttribute(UID);
        return v == null ? null : v.toString();
    }
}

