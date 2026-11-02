/*
 * Decompiled with CFR 0.152.
 */
package com.yuni.web;

import com.yuni.agent.ScriptedAgent;
import com.yuni.engine.Model;
import com.yuni.engine.WrapCardEngine;
import com.yuni.llm.LlmClient;
import com.yuni.llm.PromptBuilder;
import com.yuni.store.MessageEntity;
import com.yuni.store.MessageRepository;
import com.yuni.store.RunEntity;
import com.yuni.store.RunRepository;
import com.yuni.store.RunStore;
import com.yuni.store.SessionEntity;
import com.yuni.store.SessionRepository;
import com.yuni.web.MemoryService;
import com.yuni.web.SessionCache;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ChatService {
    private static final Logger log = LoggerFactory.getLogger(ChatService.class);
    private static final String[] CRISIS = new String[]{"\u4e0d\u60f3\u6d3b", "\u60f3\u6b7b", "\u81ea\u6740", "\u7ed3\u675f\u751f\u547d", "\u6d3b\u7740\u6ca1\u610f\u601d", "\u4f24\u5bb3\u81ea\u5df1", "\u5272\u8155", "\u8df3\u697c", "\u6491\u4e0d\u4e0b\u53bb"};
    private final ScriptedAgent agent;
    private final WrapCardEngine engine;
    private final RunStore runStore;
    private final SessionCache cache;
    private final RunRepository runs;
    private final SessionRepository sessions;
    private final MessageRepository messages;
    private final LlmClient llm;
    private final PromptBuilder prompts;
    private final MemoryService memory;

    public ChatService(ScriptedAgent agent, WrapCardEngine engine, RunStore runStore, SessionCache cache, SessionRepository sessions, RunRepository runs, MessageRepository messages, LlmClient llm, PromptBuilder prompts, MemoryService memory) {
        this.agent = agent;
        this.engine = engine;
        this.runStore = runStore;
        this.cache = cache;
        this.sessions = sessions;
        this.runs = runs;
        this.messages = messages;
        this.llm = llm;
        this.prompts = prompts;
        this.memory = memory;
    }

    public Map<String, Object> greet(String sessionId, String style) {
        String fallback;
        ScriptedAgent.Context ctx = this.cache.get(sessionId);
        if (ctx == null) {
            ctx = new ScriptedAgent.Context();
            ctx.sessionId = sessionId;
        }
        if (style != null && !style.isBlank()) {
            ctx.style = style;
        }
        this.cache.put(ctx);
        String reply = fallback = this.agent.scripts().line("greet", ctx.style);
        String engineUsed = "script";
        if (this.llm.available()) {
            try {
                String sys = this.prompts.system(ctx.style, "GREET", null, this.memory.render(this.owner(sessionId)));
                String text = this.llm.complete(this.prompts.messages(sys, List.of(), "\uff08\u521a\u6253\u5f00\u5e94\u7528\uff09"), 0.8, 160);
                if (text != null && !text.isBlank()) {
                    reply = text.trim();
                    engineUsed = "model";
                }
            }
            catch (Exception e) {
                log.warn("\u5f00\u573a\u767d\u964d\u7ea7\u5230\u5267\u672c\uff1a{}", (Object)e.getMessage());
            }
        }
        LinkedHashMap<String, Object> m = new LinkedHashMap<String, Object>();
        m.put("reply", reply);
        m.put("quickReplies", this.agent.scripts().quick("greet"));
        m.put("state", ctx.state.name());
        m.put("engine", engineUsed);
        return m;
    }

    @Transactional
    public String createSession(String style, String userId) {
        SessionEntity latest;
        if (userId != null && (latest = (SessionEntity)this.sessions.findFirstByUserIdOrderByLastActiveAtDesc(userId).orElse(null)) != null && !this.messages.existsBySessionId(latest.getId())) {
            return latest.getId();
        }
        SessionEntity e = new SessionEntity();
        e.setId(UUID.randomUUID().toString().substring(0, 8));
        e.setUserId(userId);
        e.setStyle(style == null ? "gentle" : style);
        e.setState(ScriptedAgent.State.GREET.name());
        e.setCreatedAt(LocalDateTime.now());
        e.setLastActiveAt(LocalDateTime.now());
        this.sessions.save(e);
        return e.getId();
    }

    public ChatReply chat(String sessionId, String text, String style) {
        return this.chat(sessionId, text, style, null, null);
    }

    public ChatReply chat(String sessionId, String text, String style, String userId) {
        return this.chat(sessionId, text, style, userId, null);
    }

    public ChatReply chat(String sessionId, String text, String style, String userId, Consumer<String> onDelta) {
        ScriptedAgent.Context ctx = this.cache.get(sessionId);
        if (ctx == null) {
            ctx = new ScriptedAgent.Context();
            ctx.sessionId = sessionId;
            ctx.style = style == null ? "gentle" : style;
        } else if (style != null && !style.isBlank()) {
            ctx.style = style;
        }
        LocalDateTime now = LocalDateTime.now();
        String said = text == null ? "" : text;
        ScriptedAgent.Step step = this.agent.handle(ctx, said, now);
        Model.Result result = null;
        List<Model.TraceStep> trace = List.of();
        String runId = null;
        if (step.wrapInput() != null) {
            Model.RunRecord record = this.engine.run(step.wrapInput(), now);
            this.runStore.save(record, sessionId);
            result = record.result();
            trace = record.trace();
            ctx.lastRunId = runId = record.runId();
        }
        if (("ACCEPT".equals(step.intent()) || "UNDO".equals(step.intent())) && ctx.lastRunId != null) {
            this.runStore.applyConfirmation(ctx.lastRunId, "ACCEPT".equals(step.intent()) ? "confirm" : "undo", "");
        }
        List<String[]> history = this.history(sessionId, 8);
        boolean crisis = ChatService.containsAny(said, CRISIS);
        String reply = null;
        String engineUsed = "script";
        if (this.llm.available() && !said.isBlank()) {
            try {
                String owner = userId != null ? userId : this.owner(sessionId);
                Object sys = this.prompts.system(ctx.style, ctx.state.name(), ChatService.brief(result), this.memory.render(owner));
                if (crisis) {
                    sys = (String)sys + "\n\u3010\u6ce8\u610f\u3011\u8fd9\u53e5\u8bdd\u91cc\u51fa\u73b0\u4e86\u5371\u673a\u8868\u8fbe\uff0c\u8bf7\u4e25\u683c\u6309\u4e0a\u9762\u7684\u3010\u5b89\u5168\u3011\u6bb5\u56de\u5e94\uff0c\u4e0d\u8981\u7ee7\u7eed\u6309\u6d41\u7a0b\u63d0\u95ee\uff0c\u4e5f\u4e0d\u8981\u7ed9\u4efb\u4f55\u5b89\u6392\u5efa\u8bae\u3002";
                }
                if ((reply = this.llm.stream(this.prompts.messages((String)sys, history, said), 0.85, 320, onDelta)) != null && !reply.isBlank()) {
                    engineUsed = "model";
                }
            }
            catch (Exception e) {
                log.warn("\u56de\u590d\u964d\u7ea7\u5230\u5267\u672c\uff1a{}", (Object)e.getMessage());
            }
        }
        if (reply == null || reply.isBlank()) {
            reply = step.reply();
            engineUsed = "script";
            if (onDelta != null) {
                onDelta.accept(reply);
            }
        }
        reply = reply.trim();
        if (crisis) {
            this.memory.flagSafety(userId != null ? userId : this.owner(sessionId), 3);
        }
        this.cache.put(ctx);
        this.persistTurn(sessionId, userId, said, step, ctx, now, reply);
        if (userId != null && !said.isBlank()) {
            StringBuilder t = new StringBuilder();
            history.forEach(h -> t.append("user".equals(h[0]) ? "\u7528\u6237\uff1a" : "NiNi\uff1a").append(h[1]).append('\n'));
            t.append("\u7528\u6237\uff1a").append(said).append('\n').append("NiNi\uff1a").append(reply);
            this.memory.extractAsync(userId, t.toString());
        }
        return new ChatReply(sessionId, reply, step.quickReplies(), step.state(), step.intent(), result, trace, runId, this.cache.backend(), engineUsed);
    }

    private List<String[]> history(String sessionId, int limit) {
        List<MessageEntity> all = this.messages.findBySessionIdOrderByIdAsc(sessionId);
        int from = Math.max(0, all.size() - limit);
        ArrayList<String[]> out = new ArrayList<String[]>();
        for (MessageEntity e : all.subList(from, all.size())) {
            out.add(new String[]{"user".equals(e.getRole()) ? "user" : "nini", e.getContent()});
        }
        return out;
    }

    private static String brief(Model.Result r) {
        if (r == null) {
            return null;
        }
        StringBuilder sb = new StringBuilder();
        sb.append(r.verdictZh());
        sb.append("\uff1a\u53ef\u7528 ").append(r.available()).append(" \u5206\u949f\uff0c\u9700\u8981 ").append(r.demand()).append(" \u5206\u949f");
        if (r.gapMinutes() > 0) {
            sb.append("\uff0c\u5dee ").append(r.gapMinutes()).append(" \u5206\u949f");
        }
        return sb.toString();
    }

    private String owner(String sessionId) {
        return this.sessions.findById(sessionId).map(SessionEntity::getUserId).orElse(null);
    }

    private static boolean containsAny(String text, String[] keys) {
        for (String k : keys) {
            if (!text.contains(k)) continue;
            return true;
        }
        return false;
    }

    @Transactional(readOnly=true)
    public Map<String, Object> state(String userId) {
        LinkedHashMap<String, Object> m = new LinkedHashMap<String, Object>();
        SessionEntity s = null;
        for (SessionEntity sessionEntity : this.sessions.findByUserIdOrderByLastActiveAtDesc(userId)) {
            if (!this.messages.existsBySessionId(sessionEntity.getId())) continue;
            s = sessionEntity;
            break;
        }
        if (s == null) {
            s = this.sessions.findFirstByUserIdOrderByLastActiveAtDesc(userId).orElse(null);
        }
        if (s == null) {
            m.put("sessionId", null);
            m.put("profile", this.memory.get(userId));
            return m;
        }
        m.put("sessionId", s.getId());
        m.put("style", s.getStyle());
        m.put("state", s.getState());
        m.put("task", s.getTask());
        m.put("lastActiveAt", s.getLastActiveAt() == null ? null : s.getLastActiveAt().toString());
        ArrayList msgs = new ArrayList();
        for (MessageEntity e : this.messages.findBySessionIdOrderByIdAsc(s.getId())) {
            LinkedHashMap<String, String> one = new LinkedHashMap<String, String>();
            one.put("role", "user".equals(e.getRole()) ? "me" : "nini");
            one.put("text", e.getContent());
            msgs.add(one);
        }
        m.put("messages", msgs);
        RunEntity runEntity = this.runs.findFirstBySessionIdOrderByCreatedAtDesc(s.getId()).orElse(null);
        if (runEntity != null) {
            Model.RunRecord rec = this.runStore.load(runEntity.getRunId());
            m.put("wrapcard", rec.result());
            m.put("trace", rec.trace());
            m.put("runId", rec.runId());
        }
        m.put("profile", this.memory.get(userId));
        m.put("engine", this.llm.available() ? "model" : "script");
        return m;
    }

    private void persistTurn(String sessionId, String userId, String text, ScriptedAgent.Step step, ScriptedAgent.Context ctx, LocalDateTime now, String reply) {
        SessionEntity e = this.sessions.findById(sessionId).orElseGet(() -> {
            SessionEntity created = new SessionEntity();
            created.setId(sessionId);
            created.setCreatedAt(now);
            created.setUserId(userId);
            return created;
        });
        if (e.getUserId() == null && userId != null) {
            e.setUserId(userId);
        }
        e.setStyle(ctx.style);
        e.setState(ctx.state.name());
        e.setTask(ctx.task);
        e.setLastActiveAt(now);
        this.sessions.save(e);
        MessageEntity user = new MessageEntity();
        user.setSessionId(sessionId);
        user.setRole("user");
        user.setContent(text);
        user.setIntent(step.intent());
        user.setCreatedAt(now);
        this.messages.save(user);
        MessageEntity nini = new MessageEntity();
        nini.setSessionId(sessionId);
        nini.setRole("nini");
        nini.setContent(reply);
        nini.setIntent(step.state());
        nini.setCreatedAt(now);
        this.messages.save(nini);
    }

    public record ChatReply(String sessionId, String reply, List<String> quickReplies, String state, String intent, Model.Result wrapcard, List<Model.TraceStep> trace, String runId, String cacheBackend, String engine) {
    }
}

