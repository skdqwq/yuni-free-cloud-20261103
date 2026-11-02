/*
 * Decompiled with CFR 0.152.
 */
package com.yuni.web;

import com.yuni.store.AppUser;
import com.yuni.web.AuthSupport;
import com.yuni.web.MorningService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping(value={"/api/morning"})
public class MorningController {
    private final MorningService service;

    public MorningController(MorningService service) {
        this.service = service;
    }

    @GetMapping
    public Map<String, Object> latest(HttpServletRequest req) {
        return this.service.latest(this.uid(req));
    }

    @PostMapping(value={"/start"})
    public Map<String, Object> start(@RequestBody StartRequest body, HttpServletRequest req) {
        return this.service.start(this.uid(req), body.mood(), body.dream());
    }

    @PostMapping(value={"/{id}/reply"})
    public Map<String, Object> reply(@PathVariable String id, @RequestBody ReplyRequest body, HttpServletRequest req) {
        return this.service.reply(this.uid(req), id, body.text());
    }

    @PostMapping(value={"/{id}/letter"})
    public Map<String, Object> letter(@PathVariable String id, @RequestBody LetterRequest body, HttpServletRequest req) {
        return this.service.letter(this.uid(req), id, body.text(), body.action());
    }

    @DeleteMapping(value={"/{id}"})
    public Map<String, Object> drop(@PathVariable String id, HttpServletRequest req) {
        this.service.drop(this.uid(req), id);
        return Map.of("deleted", true);
    }

    private String uid(HttpServletRequest req) {
        AppUser u = AuthSupport.user(req);
        if (u == null) {
            throw new ResponseStatusException((HttpStatusCode)HttpStatus.UNAUTHORIZED, "\u672a\u767b\u5f55");
        }
        return u.getId();
    }

    public record StartRequest(String mood, String dream) {
    }

    public record ReplyRequest(String text) {
    }

    public record LetterRequest(String text, String action) {
    }
}

