/*
 * Decompiled with CFR 0.152.
 */
package com.yuni.web;

import com.yuni.store.AppUser;
import com.yuni.store.AppUserRepository;
import com.yuni.store.CardActionRepository;
import com.yuni.store.MessageEntity;
import com.yuni.store.MessageRepository;
import com.yuni.store.MorningRecordRepository;
import com.yuni.store.RunEntity;
import com.yuni.store.RunRepository;
import com.yuni.store.SessionEntity;
import com.yuni.store.SessionRepository;
import com.yuni.store.UserProfileRepository;
import com.yuni.web.AuthSupport;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping(value={"/api/data"})
public class DataController {
    private final SessionRepository sessions;
    private final MessageRepository messages;
    private final RunRepository runs;
    private final CardActionRepository actions;
    private final MorningRecordRepository mornings;
    private final UserProfileRepository profiles;
    private final AppUserRepository users;
    private final JdbcTemplate jdbc;

    public DataController(SessionRepository sessions, MessageRepository messages, RunRepository runs, CardActionRepository actions, MorningRecordRepository mornings, UserProfileRepository profiles, AppUserRepository users, JdbcTemplate jdbc) {
        this.sessions = sessions;
        this.messages = messages;
        this.runs = runs;
        this.actions = actions;
        this.mornings = mornings;
        this.profiles = profiles;
        this.users = users;
        this.jdbc = jdbc;
    }

    @GetMapping(value={"/summary"})
    public Map<String, Object> summary(HttpServletRequest req) {
        AppUser u = this.must(req);
        List<SessionEntity> list = this.sessions.findByUserId(u.getId());
        int msgCount = 0;
        int runCount = 0;
        for (SessionEntity s : list) {
            msgCount += this.messages.findBySessionIdOrderByIdAsc(s.getId()).size();
            runCount += this.runs.findBySessionId(s.getId()).size();
        }
        LinkedHashMap<String, Object> m = new LinkedHashMap<String, Object>();
        m.put("sessions", list.size());
        m.put("messages", msgCount);
        m.put("runs", runCount);
        m.put("mornings", this.mornings.findByUserIdOrderByCreatedAtDesc(u.getId()).size());
        m.put("profile", this.profiles.findById(u.getId()).map(p -> p.getPayload() != null).orElse(false));
        return m;
    }

    @DeleteMapping(value={"/sessions/{id}"})
    @Transactional
    public Map<String, Object> deleteSession(@PathVariable String id, HttpServletRequest req) {
        AppUser u = this.must(req);
        SessionEntity s = this.sessions.findById(id).orElse(null);
        if (s == null || !u.getId().equals(s.getUserId())) {
            throw new ResponseStatusException((HttpStatusCode)HttpStatus.NOT_FOUND, "\u6ca1\u6709\u8fd9\u4e2a\u4f1a\u8bdd");
        }
        int msgs = this.messages.findBySessionIdOrderByIdAsc(id).size();
        this.deleteSessionDeep(id);
        LinkedHashMap<String, Object> m = new LinkedHashMap<String, Object>();
        m.put("deleted", true);
        m.put("messages", msgs);
        return m;
    }

    @DeleteMapping(value={"/messages/{id}"})
    @Transactional
    public Map<String, Object> deleteMessage(@PathVariable Long id, HttpServletRequest req) {
        AppUser u = this.must(req);
        MessageEntity msg = this.messages.findById(id).orElse(null);
        if (msg == null) {
            throw new ResponseStatusException((HttpStatusCode)HttpStatus.NOT_FOUND, "\u6ca1\u6709\u8fd9\u6761\u6d88\u606f");
        }
        SessionEntity s = this.sessions.findById(msg.getSessionId()).orElse(null);
        if (s == null || !u.getId().equals(s.getUserId())) {
            throw new ResponseStatusException((HttpStatusCode)HttpStatus.NOT_FOUND, "\u6ca1\u6709\u8fd9\u6761\u6d88\u606f");
        }
        this.messages.delete(msg);
        return Map.of("deleted", true);
    }

    @DeleteMapping
    @Transactional
    public Map<String, Object> deleteAll(@RequestParam(defaultValue="false") boolean withAccount, HttpServletRequest req) {
        AppUser u = this.must(req);
        List<SessionEntity> list = this.sessions.findByUserId(u.getId());
        int msgs = 0;
        for (SessionEntity s : list) {
            msgs += this.messages.findBySessionIdOrderByIdAsc(s.getId()).size();
            this.deleteSessionDeep(s.getId());
        }
        int morningCount = this.mornings.findByUserIdOrderByCreatedAtDesc(u.getId()).size();
        this.mornings.deleteByUserId(u.getId());
        this.profiles.deleteById(u.getId());
        this.jdbc.update("DELETE FROM yuni_night_cards WHERE user_id=?", u.getId());
        this.jdbc.update("DELETE FROM yuni_night_preferences WHERE user_id=?", u.getId());
        this.sessions.deleteAll(this.sessions.findByUserId(u.getId()));
        if (withAccount) {
            HttpSession http = req.getSession(false);
            if (http != null) {
                http.invalidate();
            }
            this.users.deleteById(u.getId());
        }
        LinkedHashMap<String, Object> m = new LinkedHashMap<String, Object>();
        m.put("deleted", true);
        m.put("sessions", list.size());
        m.put("messages", msgs);
        m.put("mornings", morningCount);
        m.put("accountDeleted", withAccount);
        return m;
    }

    private void deleteSessionDeep(String sessionId) {
        for (RunEntity r : this.runs.findBySessionId(sessionId)) {
            this.actions.deleteByRunId(r.getRunId());
        }
        this.runs.deleteAll(this.runs.findBySessionId(sessionId));
        this.messages.deleteBySessionId(sessionId);
        this.sessions.deleteById(sessionId);
    }

    private AppUser must(HttpServletRequest req) {
        AppUser u = AuthSupport.user(req);
        if (u == null) {
            throw new ResponseStatusException((HttpStatusCode)HttpStatus.UNAUTHORIZED, "\u672a\u767b\u5f55");
        }
        return u;
    }
}

