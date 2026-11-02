/*
 * Decompiled with CFR 0.152.
 */
package com.yuni.web;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yuni.llm.LlmClient;
import com.yuni.llm.PromptBuilder;
import com.yuni.store.UserProfile;
import com.yuni.store.UserProfileRepository;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class MemoryService {
    private static final Logger log = LoggerFactory.getLogger(MemoryService.class);
    private static final ObjectMapper JSON = new ObjectMapper();
    public static final List<String> FIELDS = List.of("address", "night_triggers", "soothing", "refused", "promises", "morning_trace", "safety");
    private static final Map<String, String> LABELS = new LinkedHashMap<String, String>(){
        {
            this.put("address", "\u79f0\u547c\u4e0e\u8bed\u6c14");
            this.put("night_triggers", "\u591c\u95f4\u89e6\u53d1\u70b9");
            this.put("soothing", "\u6709\u6548\u5b89\u629a\u7b56\u7565");
            this.put("refused", "\u660e\u786e\u62d2\u7edd\u8fc7\u7684");
            this.put("promises", "\u5df2\u786e\u8ba4\u7684\u627f\u8bfa");
            this.put("morning_trace", "\u6668\u95f4\u60c5\u7eea\u8f68\u8ff9");
            this.put("safety", "\u5b89\u5168\u6807\u8bb0");
        }
    };
    private final UserProfileRepository repo;
    private final LlmClient llm;
    private final PromptBuilder prompts;
    private final ExecutorService pool = Executors.newFixedThreadPool(2, r -> {
        Thread t = new Thread(r, "yuni-memory");
        t.setDaemon(true);
        return t;
    });
    private final ConcurrentHashMap<String, CompletableFuture<Void>> tails = new ConcurrentHashMap();

    public MemoryService(UserProfileRepository repo, LlmClient llm, PromptBuilder prompts) {
        this.repo = repo;
        this.llm = llm;
        this.prompts = prompts;
    }

    public Map<String, String> labels() {
        return LABELS;
    }

    public static Map<String, Object> empty() {
        LinkedHashMap<String, Object> m = new LinkedHashMap<String, Object>();
        m.put("address", new LinkedHashMap());
        for (String f : FIELDS) {
            if (f.equals("address")) continue;
            if (f.equals("safety")) {
                LinkedHashMap<String, Object> s = new LinkedHashMap<>();
                s.put("flagged", Boolean.valueOf(false));
                s.put("level", Integer.valueOf(0));
                m.put("safety", s);
                continue;
            }
            m.put(f, new ArrayList());
        }
        return m;
    }

    public Map<String, Object> get(String userId) {
        Map<String, Object> out = MemoryService.empty();
        UserProfile p = this.repo.findById(userId).orElse(null);
        boolean enabled = p == null || p.isEnabled();
        out.put("enabled", enabled);
        if (p == null || p.getPayload() == null || p.getPayload().isBlank()) {
            return out;
        }
        if (!enabled) {
            return out;
        }
        try {
            Map saved = (Map)JSON.readValue(p.getPayload(), (TypeReference)new TypeReference<Map<String, Object>>(){});
            for (String f : FIELDS) {
                if (!saved.containsKey(f)) continue;
                out.put(f, saved.get(f));
            }
        }
        catch (Exception e) {
            log.warn("\u6863\u6848\u89e3\u6790\u5931\u8d25\uff1a{}", (Object)e.getMessage());
        }
        return out;
    }

    public void setEnabled(String userId, boolean enabled) {
        UserProfile p = this.repo.findById(userId).orElseGet(() -> {
            UserProfile n = new UserProfile();
            n.setUserId(userId);
            return n;
        });
        p.setEnabled(enabled);
        p.setUpdatedAt(LocalDateTime.now());
        this.repo.save(p);
    }

    public Map<String, Object> put(String userId, Map<String, Object> incoming) {
        Map<String, Object> cur = this.get(userId);
        for (String f : FIELDS) {
            if (!incoming.containsKey(f)) continue;
            cur.put(f, incoming.get(f));
        }
        this.write(userId, cur);
        return this.get(userId);
    }

    public Map<String, Object> deleteField(String userId, String field) {
        if (!FIELDS.contains(field)) {
            throw new IllegalArgumentException("\u6ca1\u6709\u8fd9\u4e00\u7c7b\uff1a" + field);
        }
        Map<String, Object> cur = this.get(userId);
        Map<String, Object> blank = MemoryService.empty();
        cur.put(field, blank.get(field));
        this.write(userId, cur);
        return this.get(userId);
    }

    public void deleteAll(String userId) {
        this.repo.deleteById(userId);
    }

    public void flagSafety(String userId, int level) {
        if (userId == null) {
            return;
        }
        Map<String, Object> cur = this.get(userId);
        LinkedHashMap<String, Object> s = new LinkedHashMap<String, Object>();
        s.put("flagged", true);
        s.put("level", level);
        s.put("at", LocalDateTime.now().toString());
        cur.put("safety", s);
        this.write(userId, cur);
    }

    public String render(String userId) {
        Map s;
        Map a;
        Map<String, Object> m = this.get(userId);
        if (Boolean.FALSE.equals(m.get("enabled"))) {
            return "\uff08\u7528\u6237\u5df2\u5173\u95ed\u4e2a\u6027\u5316\u3002\u8fd9\u6b21\u6309\u901a\u7528\u7248\u672c\uff0c\u4e0d\u8981\u5f15\u7528\u4efb\u4f55\u504f\u597d\u3002\uff09";
        }
        ArrayList<String> lines = new ArrayList<String>();
        Object address = m.get("address");
        if (address instanceof Map && (a = (Map)address).get("name") != null && !String.valueOf(a.get("name")).isBlank()) {
            lines.add("\u79f0\u547c\uff1a" + String.valueOf(a.get("name")));
        }
        MemoryService.appendTopics(lines, "\u53cd\u590d\u6302\u5fc3\u7684\u4e8b", m.get("night_triggers"), "topic");
        MemoryService.appendTopics(lines, "\u8bf4\u8fc7\u6709\u7528\u7684", m.get("soothing"), "type");
        MemoryService.appendTopics(lines, "\u660e\u786e\u4e0d\u60f3\u8981\u7684", m.get("refused"), "what");
        MemoryService.appendTopics(lines, "\u7b54\u5e94\u8fc7\u8981\u7ee7\u7eed\u7684", m.get("promises"), "task");
        MemoryService.appendTopics(lines, "\u6700\u8fd1\u9192\u6765\u7684\u5fc3\u60c5", m.get("morning_trace"), "mood");
        Object safety = m.get("safety");
        if (safety instanceof Map && Boolean.TRUE.equals((s = (Map)safety).get("flagged"))) {
            lines.add("\u4e0a\u6b21\u51fa\u73b0\u8fc7\u5371\u673a\u8868\u8fbe\uff1a\u5f00\u573a\u5148\u786e\u8ba4\u73b0\u5728\u662f\u5426\u5b89\u5168\uff0c\u4e0d\u8981\u76f4\u63a5\u8fdb\u5165\u5b89\u6392\u3002");
        }
        return lines.isEmpty() ? "\uff08\u8fd8\u6ca1\u6709\u4efb\u4f55\u8bb0\u5f55\u3002\u4e0d\u8981\u5047\u88c5\u8bb0\u5f97\u4e0a\u4e00\u665a\u7684\u4e8b\u3002\uff09" : String.join((CharSequence)"\n", lines);
    }

    private static void appendTopics(List<String> lines, String label, Object value, String key) {
        List list;
        if (!(value instanceof List) || (list = (List)value).isEmpty()) {
            return;
        }
        ArrayList<String> items = new ArrayList<String>();
        for (Object o : list) {
            Map map;
            Object v;
            if (!(o instanceof Map) || (v = (map = (Map)o).get(key)) == null || String.valueOf(v).isBlank()) continue;
            items.add(String.valueOf(v));
        }
        if (!items.isEmpty()) {
            lines.add(label + "\uff1a" + String.join((CharSequence)"\u3001", items.subList(0, Math.min(3, items.size()))));
        }
    }

    private void write(String userId, Map<String, Object> m) {
        UserProfile p = this.repo.findById(userId).orElseGet(() -> {
            UserProfile n = new UserProfile();
            n.setUserId(userId);
            n.setEnabled(true);
            return n;
        });
        try {
            LinkedHashMap<String, Object> clean = new LinkedHashMap<String, Object>();
            for (String f : FIELDS) {
                clean.put(f, m.getOrDefault(f, MemoryService.empty().get(f)));
            }
            p.setPayload(JSON.writeValueAsString(clean));
            p.setUpdatedAt(LocalDateTime.now());
            this.repo.save(p);
        }
        catch (Exception e) {
            log.warn("\u6863\u6848\u5199\u5165\u5931\u8d25\uff1a{}", (Object)e.getMessage());
        }
    }

    public void extractAsync(String userId, String transcript) {
        if (userId == null || !this.llm.available() || transcript == null || transcript.isBlank()) {
            return;
        }
        UserProfile p = this.repo.findById(userId).orElse(null);
        if (p != null && !p.isEnabled()) {
            return;
        }
        CompletableFuture done = new CompletableFuture();
        CompletableFuture<Object> prev = this.tails.put(userId, done);
        if (prev == null) {
            prev = CompletableFuture.completedFuture(null);
        }
        CompletionStage step = ((CompletableFuture)prev.handle((x, e) -> null)).thenRunAsync(() -> {
            try {
                Map<String, Object> current = this.get(userId);
                String curJson = JSON.writeValueAsString(MemoryService.slim(current));
                String raw = this.llm.completeJson(this.prompts.extractMessages(curJson, transcript), 700);
                Map merged = (Map)JSON.readValue(MemoryService.stripFence(raw), (TypeReference)new TypeReference<Map<String, Object>>(){});
                this.applyMerged(userId, current, merged);
            }
            catch (Exception e) {
                log.debug("\u8bb0\u5fc6\u62bd\u53d6\u8df3\u8fc7\uff1a{}", (Object)e.getMessage());
            }
        }, this.pool);
        ((CompletableFuture)step).whenComplete((x, e) -> {
            done.complete(null);
            this.tails.remove(userId, done);
        });
    }

    private static Map<String, Object> slim(Map<String, Object> m) {
        LinkedHashMap<String, Object> out = new LinkedHashMap<String, Object>();
        for (String f : FIELDS) {
            out.put(f, m.get(f));
        }
        return out;
    }

    private static String stripFence(String s) {
        String t;
        String string = t = s == null ? "" : s.trim();
        if (t.startsWith("```")) {
            int i = t.indexOf(123);
            int j = t.lastIndexOf(125);
            if (i >= 0 && j > i) {
                return t.substring(i, j + 1);
            }
        }
        return t;
    }

    private synchronized void applyMerged(String userId, Map<String, Object> current, Map<String, Object> merged) {
        LinkedHashMap<String, Object> next = new LinkedHashMap<String, Object>();
        for (String f : FIELDS) {
            Object nv = merged.get(f);
            Object ov = current.get(f);
            if (nv instanceof List) {
                List ol;
                List nl = (List)nv;
                if (nl.isEmpty() && ov instanceof List && !(ol = (List)ov).isEmpty()) {
                    next.put(f, ol);
                    continue;
                }
                next.put(f, new ArrayList(nl.subList(0, Math.min(3, nl.size()))));
                continue;
            }
            if (nv instanceof Map) {
                Map om;
                Map nm = (Map)nv;
                if (nm.isEmpty() && ov instanceof Map && !(om = (Map)ov).isEmpty()) {
                    next.put(f, om);
                    continue;
                }
                next.put(f, nm);
                continue;
            }
            if (nv != null) {
                next.put(f, nv);
                continue;
            }
            next.put(f, ov);
        }
        this.write(userId, next);
    }
}

