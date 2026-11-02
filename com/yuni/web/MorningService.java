/*
 * Decompiled with CFR 0.152.
 */
package com.yuni.web;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yuni.llm.LlmClient;
import com.yuni.llm.PromptBuilder;
import com.yuni.store.MorningRecord;
import com.yuni.store.MorningRecordRepository;
import com.yuni.web.MemoryService;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class MorningService {
    private static final Logger log = LoggerFactory.getLogger(MorningService.class);
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String[] TRAUMA = new String[]{"\u53cd\u590d\u505a", "\u4e00\u76f4\u505a\u540c\u4e00\u4e2a\u68a6", "\u53c8\u88ab", "\u88ab\u6253", "\u88ab\u4fb5\u72af", "\u8f66\u7978", "\u6b7b\u4e86"};
    private static final Map<Integer, String> LAYER_NAME = Map.of(0, "\u68a6\u540e\u7559\u8a00", 1, "\u63a2\u7d22", 2, "\u6d1e\u5bdf", 3, "\u884c\u52a8", 4, "\u6536\u675f");
    private static final Map<Integer, String> LAYER_ACT = Map.of(1, "\u7b2c\u4e00\u5c42\u00b7\u63a2\u7d22\u3002\u8bf7 TA \u628a\u68a6\u91cc\u7684\u753b\u9762\u8bf4\u5f97\u66f4\u5177\u4f53\u4e00\u70b9\uff1a\u662f\u4ec0\u4e48\u6837\u5b50\u3001\u4ec0\u4e48\u989c\u8272\u3001\u5f53\u65f6\u8eab\u4f53\u54ea\u4e2a\u90e8\u4f4d\u6709\u611f\u89c9\u3002\u4e0d\u8981\u89e3\u91ca\u8fd9\u4e2a\u610f\u8c61\u4ee3\u8868\u4ec0\u4e48\u3002", 2, "\u7b2c\u4e8c\u5c42\u00b7\u6d1e\u5bdf\u3002\u95ee TA\uff1a\u8fd9\u4e2a\u753b\u9762\u8ba9 TA \u60f3\u5230\u6700\u8fd1\u751f\u6d3b\u91cc\u7684\u4ec0\u4e48\u3002\u8ba9 TA \u81ea\u5df1\u8bf4\uff0c\u7edd\u4e0d\u66ff TA \u89e3\u91ca\u3002", 3, "\u7b2c\u4e09\u5c42\u00b7\u884c\u52a8\u3002\u95ee TA \u660e\u5929\u53ef\u4ee5\u505a\u7684\u4e00\u4ef6\u5f88\u5c0f\u7684\u4e8b\uff0c\u5c0f\u5230\u51e0\u4e4e\u4e0d\u4f1a\u5931\u8d25\u3002", 4, "\u6536\u675f\u3002\u7528\u4e24\u53e5\u8bdd\u590d\u8ff0 TA \u81ea\u5df1\u8bf4\u8fc7\u7684\u7ec6\u8282\uff0c\u4e0d\u52a0\u4efb\u4f55\u89e3\u91ca\u548c\u5224\u65ad\uff1b\u7136\u540e\u8bf4\u8fd9\u5c01\u4fe1\u4f1a\u7559\u7740\uff0cTA \u968f\u65f6\u53ef\u4ee5\u5220\u3002");
    private static final Map<Integer, String> FALLBACK = Map.of(1, "\u90a3\u4e2a\u753b\u9762\u91cc\uff0c\u6700\u5148\u8ba9\u4f60\u8bb0\u4f4f\u7684\u662f\u4ec0\u4e48\uff1f\u989c\u8272\u3001\u58f0\u97f3\uff0c\u6216\u8005\u8eab\u4f53\u7684\u611f\u89c9\u90fd\u884c\u3002", 2, "\u8fd9\u4e2a\u753b\u9762\uff0c\u8ba9\u4f60\u60f3\u5230\u6700\u8fd1\u751f\u6d3b\u91cc\u7684\u4ec0\u4e48\u5417\uff1f", 3, "\u660e\u5929\u9192\u6765\uff0c\u6709\u4e00\u4ef6\u5f88\u5c0f\u7684\u4e8b\u53ef\u4ee5\u505a\u5417\uff1f\u5c0f\u5230\u51e0\u4e4e\u4e0d\u4f1a\u5931\u8d25\u7684\u90a3\u79cd\u3002", 4, "\u6211\u628a\u5b83\u8bb0\u4e0b\u6765\u4e86\u3002\u8fd9\u5c01\u4fe1\u4f1a\u7559\u7740\uff0c\u4f60\u60f3\u5220\u968f\u65f6\u53ef\u4ee5\u5220\u3002");
    private static final Map<Integer, List<String>> OPTIONS = Map.of(1, List.of("\u4e00\u56e2\u7070\u8272\u7684\u96fe", "\u4e00\u76f4\u5728\u8d76\u8def", "\u8bb0\u4e0d\u6e05\u4e86\uff0c\u53ea\u8bb0\u5f97\u5f88\u7d2f"), 2, List.of("\u50cf\u6700\u8fd1\u7684\u72b6\u6001", "\u8bf4\u4e0d\u4e0a\u6765", "\u4e0d\u60f3\u5f80\u4e0b\u60f3"), 3, List.of("\u65e9\u70b9\u7761", "\u5148\u4e0d\u5b89\u6392\u4e86"), 4, List.of("\u5199\u5c01\u4fe1", "\u5148\u4e0d\u5199"));
    private final MorningRecordRepository repo;
    private final LlmClient llm;
    private final PromptBuilder prompts;
    private final MemoryService memory;

    public MorningService(MorningRecordRepository repo, LlmClient llm, PromptBuilder prompts, MemoryService memory) {
        this.repo = repo;
        this.llm = llm;
        this.prompts = prompts;
        this.memory = memory;
    }

    public Map<String, Object> latest(String userId) {
        MorningRecord r = this.repo.findFirstByUserIdOrderByCreatedAtDesc(userId).orElse(null);
        return r == null ? Map.of("exists", false) : this.view(r);
    }

    public Map<String, Object> start(String userId, String mood, String dream) {
        MorningRecord r = new MorningRecord();
        r.setId(UUID.randomUUID().toString().substring(0, 8));
        r.setUserId(userId);
        r.setMood(mood);
        r.setDream(dream == null ? "" : dream.trim());
        r.setLayer(1);
        r.setLetterState("");
        r.setCreatedAt(LocalDateTime.now());
        r.setUpdatedAt(LocalDateTime.now());
        r.setNotes("[]");
        String reply = this.speak(userId, r, null);
        this.appendNote(r, 1, null, reply);
        this.repo.save(r);
        this.memory.extractAsync(userId, this.transcript(r));
        Map<String, Object> m = this.view(r);
        m.put("reply", reply);
        return m;
    }

    public Map<String, Object> reply(String userId, String id, String text) {
        MorningRecord r = this.must(userId, id);
        if (r.getLayer() >= 4) {
            Map<String, Object> m = this.view(r);
            m.put("reply", "\u4eca\u665a\u8fd9\u6761\u5df2\u7ecf\u6536\u597d\u4e86\u3002\u60f3\u518d\u770b\u4e00\u904d\uff0c\u968f\u65f6\u7ffb\u5f97\u5230\u3002");
            return m;
        }
        int current = r.getLayer();
        int next = current + 1;
        r.setLayer(next);
        r.setUpdatedAt(LocalDateTime.now());
        String reply = this.speak(userId, r, text);
        this.appendNote(r, next, text, reply);
        this.repo.save(r);
        this.memory.extractAsync(userId, this.transcript(r));
        Map<String, Object> m = this.view(r);
        m.put("reply", reply);
        return m;
    }

    public Map<String, Object> letter(String userId, String id, String text, String action) {
        MorningRecord r = this.must(userId, id);
        if ("discard".equalsIgnoreCase(action)) {
            r.setLetter(null);
            r.setLetterState("discarded");
        } else {
            r.setLetter(text == null ? "" : text.trim());
            r.setLetterState("kept");
        }
        r.setUpdatedAt(LocalDateTime.now());
        this.repo.save(r);
        return this.view(r);
    }

    public void drop(String userId, String id) {
        MorningRecord r = this.must(userId, id);
        this.repo.delete(r);
    }

    private MorningRecord must(String userId, String id) {
        MorningRecord r = (MorningRecord)this.repo.findById(id).orElseThrow(() -> new IllegalArgumentException("\u627e\u4e0d\u5230\u8fd9\u6761\u6668\u95f4\u8bb0\u5f55"));
        if (!userId.equals(r.getUserId())) {
            throw new IllegalArgumentException("\u4e0d\u5c5e\u4e8e\u5f53\u524d\u8d26\u53f7");
        }
        return r;
    }

    private String speak(String userId, MorningRecord r, String userText) {
        int layer = r.getLayer();
        boolean trauma = MorningService.containsAny(r.getDream() == null ? "" : r.getDream(), TRAUMA);
        String fallback = FALLBACK.getOrDefault(layer, FALLBACK.get(4));
        if (!this.llm.available()) {
            return fallback;
        }
        try {
            Object sys = "\u4f60\u662f NiNi\uff0c\u5728\u65e9\u4e0a\u966a\u4eba\u56de\u770b\u6628\u665a\u7684\u68a6\u3002\u65b9\u6cd5\u662f Hill \u7684\u8ba4\u77e5\uff0d\u4f53\u9a8c\u6a21\u578b\uff1a\n\u63a2\u7d22 \u2192 \u6d1e\u5bdf \u2192 \u884c\u52a8\uff0c\u4e00\u5c42\u4e00\u5c42\u6765\uff0c\u4e0d\u80fd\u8df3\u7ea7\u3002\n\u786c\u8fb9\u754c\uff1a\n- \u4e0d\u505a\u786e\u5b9a\u6027\u89e3\u68a6\uff0c\u4e0d\u8bf4\u300c\u8fd9\u4e2a\u68a6\u4ee3\u8868\u300d\u300c\u8bf4\u660e\u4f60\u300d\u8fd9\u7c7b\u5224\u65ad\u3002\n- \u4e0d\u505a\u5fc3\u7406\u8bca\u65ad\uff0c\u4e0d\u5206\u6790\u521b\u4f24\uff0c\u4e0d\u8ffd\u95ee\u7ec6\u8282\u3002\n- \u53cd\u590d\u5669\u68a6\u6216\u6d89\u53ca\u88ab\u4f24\u5bb3\u65f6\uff0c\u4e0d\u8ffd\u95ee\uff0c\u5efa\u8bae\u627e\u4e13\u4e1a\u7684\u4eba\uff08\u6821\u5185\u5fc3\u7406\u4e2d\u5fc3\u300112356\uff09\u3002\n- TA \u968f\u65f6\u53ef\u4ee5\u505c\uff0c\u4e0d\u8981\u633d\u7559\u3002\n\u6bcf\u6b21 2\u20143 \u53e5 + \u4e00\u4e2a\u95ee\u53e5\uff0c\u4e0d\u8d85\u8fc7 70 \u5b57\uff0c\u4e0d\u7528\u5217\u8868\u3001\u4e0d\u7528 emoji\u3001\u4e0d\u7528\u300c\u9996\u5148\u300d\u3002\n";
            if (trauma) {
                sys = (String)sys + "\n\u3010\u6ce8\u610f\u3011\u8fd9\u6bb5\u68a6\u6d89\u53ca\u53cd\u590d\u51fa\u73b0\u6216\u53d7\u4f24\u7684\u5185\u5bb9\uff0c\u8bf7\u53ea\u505a\u966a\u4f34\u4e0e\u8f6c\u4ecb\uff0c\u4e0d\u8981\u505a\u610f\u8c61\u63a2\u7d22\u3002";
            }
            sys = (String)sys + "\n\u3010\u8fd9\u4e00\u5c42\u8981\u505a\u7684\u4e8b\u3011" + LAYER_ACT.getOrDefault(layer, LAYER_ACT.get(4));
            sys = (String)sys + "\n\u3010TA \u8bb0\u5f97\u7684\u504f\u597d\u3011" + this.memory.render(userId);
            String opening = "\u6628\u665a\u7684\u68a6\uff1a" + (String)(r.getDream() == null || r.getDream().isBlank() ? "\uff08TA \u6ca1\u7ec6\u8bf4\uff0c\u53ea\u8bf4\u5fc3\u60c5\uff1a" + MorningService.nz(r.getMood()) + "\uff09" : r.getDream());
            ArrayList<Map<String, String>> msgs = new ArrayList<Map<String, String>>();
            msgs.add(this.prompts.msg("system", (String)sys));
            msgs.add(this.prompts.msg("user", opening));
            for (Map<String, Object> n : this.notes(r)) {
                Object u = n.get("user");
                Object a = n.get("nini");
                if (u == null || a == null) continue;
                msgs.add(this.prompts.msg("user", String.valueOf(u)));
                msgs.add(this.prompts.msg("assistant", String.valueOf(a)));
            }
            if (userText != null && !userText.isBlank()) {
                msgs.add(this.prompts.msg("user", userText));
            }
            msgs.add(this.prompts.msg("user", "\uff08\u73b0\u5728\u8bf7\u8bf4\u8fd9\u4e00\u5c42\u7684\u8bdd\uff09"));
            String out = this.llm.complete(msgs, 0.85, 220);
            return out == null || out.isBlank() ? fallback : out.trim();
        }
        catch (Exception e) {
            log.warn("\u6668\u95f4\u56de\u590d\u964d\u7ea7\u5230\u56fa\u5b9a\u8bdd\u672f\uff1a{}", (Object)e.getMessage());
            return fallback;
        }
    }

    private String transcript(MorningRecord r) {
        StringBuilder sb = new StringBuilder("\uff08\u8fd9\u662f\u4e00\u6b21\u6668\u95f4\u8bb0\u5f55\uff09\n");
        sb.append("\u9192\u540e\u5fc3\u60c5\uff1a").append(MorningService.nz(r.getMood())).append('\n');
        if (r.getDream() != null && !r.getDream().isBlank()) {
            sb.append("\u68a6\uff1a").append(r.getDream()).append('\n');
        }
        for (Map<String, Object> n : this.notes(r)) {
            Object u = n.get("user");
            Object a = n.get("nini");
            if (u != null) {
                sb.append("\u7528\u6237\uff1a").append(u).append('\n');
            }
            if (a == null) continue;
            sb.append("NiNi\uff1a").append(a).append('\n');
        }
        return sb.toString();
    }

    private static String nz(String s) {
        return s == null || s.isBlank() ? "\u8bf4\u4e0d\u6e05" : s;
    }

    private static boolean containsAny(String text, String[] keys) {
        for (String k : keys) {
            if (!text.contains(k)) continue;
            return true;
        }
        return false;
    }

    private List<Map<String, Object>> notes(MorningRecord r) {
        try {
            if (r.getNotes() == null || r.getNotes().isBlank()) {
                return List.of();
            }
            return (List)JSON.readValue(r.getNotes(), (TypeReference)new TypeReference<List<Map<String, Object>>>(){});
        }
        catch (Exception e) {
            return List.of();
        }
    }

    private void appendNote(MorningRecord r, int layer, String user, String nini) {
        ArrayList<Map<String, Object>> list = new ArrayList<Map<String, Object>>(this.notes(r));
        LinkedHashMap<String, Object> n = new LinkedHashMap<String, Object>();
        n.put("layer", layer);
        n.put("user", user);
        n.put("nini", nini);
        list.add(n);
        try {
            r.setNotes(JSON.writeValueAsString(list));
        }
        catch (Exception e) {
            r.setNotes("[]");
        }
    }

    private Map<String, Object> view(MorningRecord r) {
        LinkedHashMap<String, Object> m = new LinkedHashMap<String, Object>();
        m.put("exists", true);
        m.put("id", r.getId());
        m.put("mood", r.getMood());
        m.put("dream", r.getDream());
        m.put("layer", r.getLayer());
        m.put("layerName", LAYER_NAME.getOrDefault(r.getLayer(), "\u6536\u675f"));
        m.put("done", r.getLayer() >= 4);
        m.put("options", OPTIONS.getOrDefault(r.getLayer(), List.of()));
        m.put("letter", r.getLetter());
        m.put("letterState", r.getLetterState() == null ? "" : r.getLetterState());
        m.put("notes", this.notes(r));
        m.put("createdAt", r.getCreatedAt() == null ? null : r.getCreatedAt().toString());
        return m;
    }
}

