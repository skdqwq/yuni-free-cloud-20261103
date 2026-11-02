/*
 * Decompiled with CFR 0.152.
 */
package com.yuni.web;

import com.yuni.agent.ScriptedAgent;
import com.yuni.engine.Model;
import com.yuni.engine.WrapCardEngine;
import com.yuni.llm.LlmClient;
import com.yuni.store.AppUser;
import com.yuni.store.RunStore;
import com.yuni.store.SessionEntity;
import com.yuni.store.SessionRepository;
import com.yuni.web.AuthSupport;
import com.yuni.web.ChatService;
import com.yuni.web.SessionCache;
import com.yuni.ws.ReplyStreamer;
import com.yuni.ws.WsHub;
import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping(value={"/api"})
public class ApiController {
    private final ChatService chatService;
    private final WrapCardEngine engine;
    private final RunStore runStore;
    private final ScriptedAgent agent;
    private final SessionCache cache;
    private final SessionRepository sessions;
    private final ReplyStreamer streamer;
    private final WsHub hub;
    private final LlmClient llm;

    public ApiController(ChatService chatService, WrapCardEngine engine, RunStore runStore, ScriptedAgent agent, SessionCache cache, SessionRepository sessions, ReplyStreamer streamer, WsHub hub, LlmClient llm) {
        this.chatService = chatService;
        this.engine = engine;
        this.runStore = runStore;
        this.agent = agent;
        this.cache = cache;
        this.sessions = sessions;
        this.streamer = streamer;
        this.hub = hub;
        this.llm = llm;
    }

    @GetMapping(value={"/health"})
    public Map<String, Object> health() {
        LinkedHashMap<String, Object> m = new LinkedHashMap<String, Object>();
        m.put("status", "ok");
        m.put("app", "\u5c7fYUNI backend");
        m.put("workflow", "\u5c7fYUNI \u6536\u5c3e\u5361\u5de5\u4f5c\u6d41 v1.1-java");
        m.put("rules", WrapCardEngine.RULES.length);
        m.put("scriptLines", this.agent.scripts().size());
        m.put("llm", this.llm.available() ? "model" : "script");
        m.put("llmRoute", this.llm.route());
        m.put("llmModel", this.llm.model());
        m.put("cacheBackend", this.cache.backend());
        m.put("auth", "session");
        m.put("time", LocalDateTime.now().toString());
        return m;
    }

    @GetMapping(value={"/state"})
    public Map<String, Object> state(HttpServletRequest req) {
        AppUser u = this.mustUser(req);
        LinkedHashMap<String, Object> m = new LinkedHashMap<String, Object>();
        m.put("user", Map.of("id", u.getId(), "username", u.getUsername()));
        m.putAll(this.chatService.state(u.getId()));
        m.put("online", this.hub.count(u.getId()));
        return m;
    }

    @GetMapping(value={"/greet"})
    public Map<String, Object> greet(@RequestParam String sessionId, @RequestParam(required=false) String style, HttpServletRequest req) {
        AppUser u = this.mustUser(req);
        String sid = this.ownedSession(u, sessionId, style);
        return this.chatService.greet(sid, style);
    }

    @PostMapping(value={"/sessions"})
    public Map<String, String> createSession(@RequestBody(required=false) SessionRequest req, HttpServletRequest http) {
        AppUser u = this.mustUser(http);
        String style = req == null || req.style() == null ? "gentle" : req.style();
        String id = this.chatService.createSession(style, u.getId());
        return Map.of("sessionId", id, "style", style);
    }

    @PostMapping(value={"/chat"})
    public ChatService.ChatReply chat(@RequestBody ChatRequest req, HttpServletRequest http) {
        String text;
        AppUser u = this.mustUser(http);
        String sid = this.ownedSession(u, req.sessionId(), req.style());
        String string = text = req.text() == null ? "" : req.text();
        if (this.streamer.online(u.getId())) {
            this.streamer.echo(u.getId(), sid, text);
            this.streamer.begin(u.getId(), sid);
            ChatService.ChatReply reply = this.chatService.chat(sid, text, req.style(), u.getId(), piece -> this.streamer.delta(u.getId(), (String)piece));
            this.streamer.end(u.getId(), reply);
            return reply;
        }
        return this.chatService.chat(sid, text, req.style(), u.getId());
    }

    @PostMapping(value={"/wrapcard"})
    public Map<String, Object> wrapcard(@RequestBody WrapCardRequest req, HttpServletRequest http) {
        AppUser u = this.mustUser(http);
        String sid = this.ownedSession(u, req.sessionId(), null);
        if (req.input() == null || req.input().task() == null || req.input().task().isBlank()) {
            throw new ResponseStatusException((HttpStatusCode)HttpStatus.BAD_REQUEST, "input.task \u5fc5\u586b\uff1a\u8fd9\u4e2a\u63a5\u53e3\u8981\u5b8c\u6574\u7684\u4efb\u52a1\u3001\u622a\u6b62\u65f6\u95f4\u3001\u53ef\u7528\u65f6\u6bb5\uff0c\u4e0d\u80fd\u53ea\u7ed9 sessionId\u3002\u6b63\u5e38\u5bf9\u8bdd\u8d70\u5230 CARD \u4f1a\u81ea\u52a8\u51fa\u5361\u3002");
        }
        Model.RunRecord record = this.engine.run(req.input(), LocalDateTime.now());
        this.runStore.save(record, sid);
        LinkedHashMap<String, Object> m = new LinkedHashMap<String, Object>();
        m.put("record", record);
        m.put("runId", record.runId());
        return m;
    }

    private void requireRunOwner(String runId, AppUser user) {
        String sid = this.runStore.sessionIdOf(runId);
        SessionEntity session = sid == null ? null : this.sessions.findById(sid).orElse(null);
        if(session == null || !user.getId().equals(session.getUserId())) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    }

    @PostMapping(value={"/confirm"})
    public Model.RunRecord confirm(@RequestBody ConfirmRequest req, HttpServletRequest http) {
        AppUser u = this.mustUser(http);
        this.requireRunOwner(req.runId(), u);
        Model.RunRecord r = this.runStore.applyConfirmation(req.runId(), req.action(), req.reason());
        this.streamer.confirm(u.getId(), req.runId(), req.action(), r);
        return r;
    }

    @GetMapping(value={"/runs/{runId}"})
    public Model.RunRecord run(@PathVariable String runId, HttpServletRequest http) {
        this.requireRunOwner(runId, this.mustUser(http));
        return this.runStore.load(runId);
    }

    @GetMapping(value={"/runs/{runId}/actions"})
    public List<Map<String, Object>> actions(@PathVariable String runId, HttpServletRequest http) {
        this.requireRunOwner(runId, this.mustUser(http));
        return this.runStore.actionsOf(runId).stream().<Map<String, Object>>map(a -> {
            LinkedHashMap<String, Object> m = new LinkedHashMap<>();
            m.put("action", a.getAction());
            m.put("reason", a.getReason());
            m.put("at", a.getCreatedAt() == null ? "" : a.getCreatedAt().toString());
            return m;
        }).toList();
    }

    @GetMapping(value={"/scripts"})
    public Map<String, Object> scripts() {
        LinkedHashMap<String, Object> m = new LinkedHashMap<String, Object>();
        m.put("name", "\u5c7fYUNI \u5267\u672c\u578b Agent");
        m.put("states", ScriptedAgent.State.values());
        m.put("lines", this.agent.scripts().size());
        return m;
    }

    private AppUser mustUser(HttpServletRequest req) {
        AppUser u = AuthSupport.user(req);
        if (u == null) {
            throw new ResponseStatusException((HttpStatusCode)HttpStatus.UNAUTHORIZED, "\u672a\u767b\u5f55");
        }
        return u;
    }

    private String ownedSession(AppUser u, String sessionId, String style) {
        SessionEntity e;
        if (sessionId != null && !sessionId.isBlank() && (e = (SessionEntity)this.sessions.findById(sessionId).orElse(null)) != null && u.getId().equals(e.getUserId())) {
            return sessionId;
        }
        return this.chatService.createSession(style == null ? "gentle" : style, u.getId());
    }

    public record SessionRequest(String style) {
    }

    public record ChatRequest(String sessionId, String text, String style) {
    }

    public record WrapCardRequest(String sessionId, Model.WrapCardInput input) {
    }

    public record ConfirmRequest(String runId, String action, String reason) {
    }
}

