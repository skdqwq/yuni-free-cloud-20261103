/*
 * Decompiled with CFR 0.152.
 */
package com.yuni.web;

import com.yuni.store.AppUser;
import com.yuni.web.AuthSupport;
import com.yuni.web.MemoryService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping(value={"/api/memory"})
public class MemoryController {
    private final MemoryService memory;

    public MemoryController(MemoryService memory) {
        this.memory = memory;
    }

    @GetMapping
    public Map<String, Object> get(HttpServletRequest req) {
        String uid = this.uid(req);
        Map<String, Object> profile = this.memory.get(uid);
        ArrayList fields = new ArrayList();
        this.memory.labels().forEach((key, label) -> {
            LinkedHashMap<String, String> f = new LinkedHashMap<String, String>();
            f.put("key", (String)key);
            f.put("label", (String)label);
            f.put("value", (String)profile.get(key));
            fields.add(f);
        });
        LinkedHashMap<String, Object> m = new LinkedHashMap<String, Object>();
        m.put("enabled", profile.get("enabled"));
        m.put("fields", fields);
        m.put("profile", profile);
        return m;
    }

    @PutMapping
    public Map<String, Object> put(@RequestBody Map<String, Object> body, HttpServletRequest req) {
        return this.memory.put(this.uid(req), body);
    }

    @DeleteMapping(value={"/{field}"})
    public Map<String, Object> deleteField(@PathVariable String field, HttpServletRequest req) {
        return this.memory.deleteField(this.uid(req), field);
    }

    @PostMapping(value={"/enabled"})
    public Map<String, Object> enabled(@RequestBody EnabledRequest body, HttpServletRequest req) {
        this.memory.setEnabled(this.uid(req), body.enabled());
        return this.memory.get(this.uid(req));
    }

    private String uid(HttpServletRequest req) {
        AppUser u = AuthSupport.user(req);
        if (u == null) {
            throw new ResponseStatusException((HttpStatusCode)HttpStatus.UNAUTHORIZED, "\u672a\u767b\u5f55");
        }
        return u.getId();
    }

    public record EnabledRequest(boolean enabled) {
    }
}

