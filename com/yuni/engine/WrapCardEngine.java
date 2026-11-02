/*
 * Decompiled with CFR 0.152.
 */
package com.yuni.engine;

import com.yuni.engine.Model;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class WrapCardEngine {
    public static final double SLACK_RATIO = 0.8;
    public static final int MIN_USEFUL_SLOT = 20;
    public static final String WORKFLOW = "\u5c7fYUNI \u6536\u5c3e\u5361\u5de5\u4f5c\u6d41 v1.1-java";
    public static final String[][] RULES = new String[][]{{"R1", "\u622a\u6b62\u65f6\u95f4\u5fc5\u987b\u662f\u5177\u4f53\u65f6\u523b\uff0c\u4e14\u5728\u672a\u6765"}, {"R2", "\u5fc5\u987b\u5b8c\u6210\u7684\u90e8\u5206\u4e0d\u80fd\u4e3a\u7a7a"}, {"R3", "\u53ef\u7528\u65f6\u95f4\u7a97\u5fc5\u987b\u6210\u7acb\uff08\u7ed3\u675f\u665a\u4e8e\u5f00\u59cb\uff09"}, {"R4", "\u5bb9\u91cf\u6838\u7b97\uff1a\u9700\u6c42\u65f6\u957f vs \u7a97\u53e3\u5185\u771f\u5b9e\u53ef\u7528\u65f6\u957f"}, {"R5", "\u7f3a\u53e3\u5fc5\u987b\u663e\u5f0f\u5c55\u793a\uff0c\u4e0d\u5f97\u9759\u9ed8\u541e\u6389"}, {"R6", "\u4e0d\u5f97\u81ea\u52a8\u4fee\u6539\u7528\u6237\u7ed9\u5b9a\u7684\u622a\u6b62\u65f6\u95f4"}, {"R7", "\u6bcf\u4e2a\u5019\u9009\u65b9\u6848\u90fd\u5fc5\u987b\u7ecf\u7528\u6237\u786e\u8ba4\u624d\u751f\u6548"}};
    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private static final DateTimeFormatter RUN_FMT = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");
    private static final DateTimeFormatter EXEC_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final String[] PARSE_PATTERNS = new String[]{"yyyy-MM-dd'T'HH:mm", "yyyy-MM-dd HH:mm", "yyyy-MM-dd'T'HH:mm:ss", "yyyy-MM-dd"};

    public static int hhmm(String s) {
        if (s == null || s.isBlank()) {
            return 0;
        }
        String[] p = s.trim().split(":");
        return Integer.parseInt(p[0].trim()) * 60 + Integer.parseInt(p[1].trim());
    }

    public static String hhmmOf(int v) {
        int m = Math.max(0, Math.min(v, 1440));
        return String.format("%02d:%02d", m / 60, m % 60);
    }

    public static LocalDateTime parseDeadline(String s) {
        if (s == null || s.isBlank()) {
            return null;
        }
        String v = s.trim().replace("Z", "");
        for (String p : PARSE_PATTERNS) {
            try {
                return LocalDateTime.parse(v, DateTimeFormatter.ofPattern(p));
            }
            catch (Exception exception) {
            }
        }
        return null;
    }

    private static int overlap(int a1, int a2, int b1, int b2) {
        return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
    }

    public Model.RunRecord run(Model.WrapCardInput input, LocalDateTime now) {
        Object verdictZh;
        String verdict;
        String runId = "WC-" + now.format(RUN_FMT) + "-" + UUID.randomUUID().toString().replace("-", "").substring(0, 4);
        ArrayList<Model.TraceStep> trace = new ArrayList<Model.TraceStep>();
        String task = input.task() == null ? "" : input.task().trim();
        String deadlineRaw = input.deadline() == null ? "" : input.deadline();
        LocalDateTime deadline = WrapCardEngine.parseDeadline(deadlineRaw);
        ArrayList<Model.Part> parts = new ArrayList<Model.Part>();
        if (input.mustParts() != null) {
            for (Model.Part part : input.mustParts()) {
                if (part == null || part.text() == null || part.text().isBlank()) continue;
                parts.add(new Model.Part(part.text().trim(), part.minutes()));
            }
        }
        ArrayList<Model.FixedBlock> fixed = new ArrayList<Model.FixedBlock>();
        if (input.fixedBlocks() != null) {
            for (Model.FixedBlock f : input.fixedBlocks()) {
                if (f == null) continue;
                String name = f.name() == null || f.name().isBlank() ? "\u5df2\u9501\u5b9a\u5b89\u6392" : f.name().trim();
                fixed.add(new Model.FixedBlock(name, f.start() == null ? "00:00" : f.start(), f.end() == null ? "00:00" : f.end()));
            }
        }
        Model.TimeWindow timeWindow = input.window() == null ? new Model.TimeWindow("21:00", "23:30") : input.window();
        int wStart = WrapCardEngine.hhmm(timeWindow.start() == null ? "21:00" : timeWindow.start());
        int wEnd = WrapCardEngine.hhmm(timeWindow.end() == null ? "23:30" : timeWindow.end());
        int willing = input.willingMinutes() == null ? 0 : input.willingMinutes();
        ArrayList fixedView = new ArrayList();
        for (Model.FixedBlock f : fixed) {
            LinkedHashMap<String, Object> m = new LinkedHashMap<String, Object>();
            m.put("\u540d\u79f0", f.name());
            m.put("\u65f6\u6bb5", WrapCardEngine.hhmmOf(WrapCardEngine.hhmm(f.start())) + "-" + WrapCardEngine.hhmmOf(WrapCardEngine.hhmm(f.end())));
            fixedView.add(m);
        }
        LinkedHashMap<String, Object> d1 = new LinkedHashMap<String, Object>();
        d1.put("\u6700\u6302\u5fc3\u7684\u4e00\u4ef6\u4e8b", task);
        d1.put("\u622a\u6b62\u65f6\u95f4\u539f\u6587", deadlineRaw);
        d1.put("\u622a\u6b62\u65f6\u95f4\u89e3\u6790\u7ed3\u679c", deadline == null ? "\u672a\u80fd\u89e3\u6790" : deadline.format(FMT));
        d1.put("\u5fc5\u987b\u5b8c\u6210\u7684\u90e8\u5206", parts);
        d1.put("\u5df2\u9501\u5b9a\u5b89\u6392", fixedView);
        d1.put("\u53ef\u7528\u7a97\u53e3", WrapCardEngine.hhmmOf(wStart) + "-" + WrapCardEngine.hhmmOf(wEnd));
        d1.put("\u613f\u610f\u6295\u5165", willing);
        trace.add(new Model.TraceStep("1 \u89e3\u6790\u8f93\u5165", "ok", d1));
        ArrayList<Model.RuleCheck> checks = new ArrayList<Model.RuleCheck>();
        boolean c1 = deadline != null && deadline.isAfter(now);
        checks.add(new Model.RuleCheck("R1", RULES[0][1], c1, "\u622a\u6b62 " + (deadline == null ? "\u672a\u7ed9\u51fa" : deadline.format(FMT)) + "\uff0c\u73b0\u5728 " + now.format(FMT)));
        boolean c2 = !parts.isEmpty();
        checks.add(new Model.RuleCheck("R2", RULES[1][1], c2, "\u5df2\u586b " + parts.size() + " \u9879"));
        boolean c3 = wEnd - wStart >= 20;
        checks.add(new Model.RuleCheck("R3", RULES[2][1], c3, "\u7a97\u53e3\u957f\u5ea6 " + (wEnd - wStart) + " \u5206\u949f"));
        ArrayList<Model.RuleCheck> blocking = new ArrayList<Model.RuleCheck>();
        ArrayList<String> blockingIds = new ArrayList<String>();
        for (Model.RuleCheck c : checks) {
            if (c.passed()) continue;
            blocking.add(c);
            blockingIds.add(c.rule());
        }
        LinkedHashMap<String, Object> d2 = new LinkedHashMap<>();
        d2.put("\u9010\u6761\u7ed3\u679c", checks);
        d2.put("\u963b\u65ad\u9879", blockingIds);
        trace.add(new Model.TraceStep("2 \u89c4\u5219\u6821\u9a8c", blocking.isEmpty() ? "ok" : "fail", d2));
        if (!blocking.isEmpty()) {
            Model.Result blocked = new Model.Result("invalid", "\u8f93\u5165\u4e0d\u5b8c\u6574\uff0c\u672a\u751f\u6210\u6536\u5c3e\u5361", null, null, null, List.of(), null, blocking, false);
            return this.finish(runId, now, input, trace, blocked);
        }
        int windowLen = wEnd - wStart;
        int fixedMin = 0;
        for (Model.FixedBlock f : fixed) {
            fixedMin += WrapCardEngine.overlap(wStart, wEnd, WrapCardEngine.hhmm(f.start()), WrapCardEngine.hhmm(f.end()));
        }
        int available = Math.max(0, windowLen - fixedMin);
        int demand = parts.stream().mapToInt(Model.Part::minutes).sum();
        int gap = demand - available;
        if (demand == 0) {
            verdict = "unknown";
            verdictZh = "\u672a\u63d0\u4f9b\u5404\u9879\u7528\u65f6\uff0c\u65e0\u6cd5\u6838\u7b97\u5bb9\u91cf";
        } else if (gap <= 0 && (double)demand <= (double)available * 0.8) {
            verdict = "ok";
            verdictZh = "\u6392\u5f97\u4e0b\uff0c\u8fd8\u6709\u4f59\u91cf";
        } else if (gap <= 0) {
            verdict = "tight";
            verdictZh = "\u52c9\u5f3a\u6392\u5f97\u4e0b\uff0c\u4f59\u91cf\u5f88\u5c11";
        } else {
            verdict = "over";
            verdictZh = "\u6392\u4e0d\u4e0b\uff0c\u5dee " + gap + " \u5206\u949f";
        }
        LinkedHashMap<String, Object> d3 = new LinkedHashMap<String, Object>();
        d3.put("\u7a97\u53e3\u603b\u957f", windowLen);
        d3.put("\u5df2\u9501\u5b9a\u5360\u7528", fixedMin);
        d3.put("\u771f\u5b9e\u53ef\u7528", available);
        d3.put("\u9700\u6c42\u5408\u8ba1", demand);
        d3.put("\u7f3a\u53e3", gap);
        d3.put("\u5224\u5b9a", verdictZh);
        trace.add(new Model.TraceStep("3 \u5bb9\u91cf\u6838\u7b97", "over".equals(verdict) ? "fail" : "ok", d3));
        ArrayList<Model.Candidate> cands = new ArrayList<Model.Candidate>();
        if ("ok".equals(verdict) || "tight".equals(verdict) || "unknown".equals(verdict)) {
            cands.add(new Model.Candidate("C-keep", "\u4fdd\u7559", "\u6309\u539f\u8ba1\u5212\u505a\u5b8c", "\u5728 " + WrapCardEngine.hhmmOf(wStart) + "\u2013" + WrapCardEngine.hhmmOf(wEnd) + " \u5185\u4f9d\u6b21\u5b8c\u6210\uff1a" + String.join((CharSequence)"\u3001", parts.stream().map(Model.Part::text).toList()), "\u9700\u6c42 " + demand + " \u5206\u949f\uff0c\u7a97\u53e3\u771f\u5b9e\u53ef\u7528 " + available + " \u5206\u949f\uff0c\u4e0d\u9700\u8981\u52a8\u622a\u6b62\u65f6\u95f4\u3002", WrapCardEngine.effect(demand, available, gap), true));
            if ("tight".equals(verdict)) {
                Model.Part first = (Model.Part)parts.get(0);
                int trimmed = (int)((double)demand * 0.6);
                cands.add(new Model.Candidate("C-trim", "\u62c6\u5c0f", "\u53ea\u505a\u6700\u5fc5\u8981\u7684\u90a3\u4e00\u5c0f\u5757", "\u628a\u300c" + first.text() + "\u300d\u538b\u5230\u4eca\u665a\u53ea\u505a\u80fd\u4ea4\u5dee\u7684\u6700\u5c0f\u7248\u672c\uff0c\u5176\u4f59\u987a\u5ef6\u5230\u4e0b\u4e00\u65f6\u6bb5\u3002", "\u4f59\u91cf\u5c11\u4e8e 20%\uff0c\u7559\u4e00\u70b9\u7f13\u51b2\uff0c\u907f\u514d\u505a\u5230\u4e00\u534a\u88ab\u6253\u65ad\u3002", WrapCardEngine.effect(trimmed, available, trimmed - available), true));
            }
        } else {
            int used = 0;
            ArrayList<String> keep = new ArrayList<String>();
            ArrayList<String> defer = new ArrayList<String>();
            for (Model.Part p : parts) {
                if (used + p.minutes() <= available) {
                    keep.add(p.text());
                    used += p.minutes();
                    continue;
                }
                defer.add(p.text());
            }
            if (keep.isEmpty()) {
                Model.Part p0 = (Model.Part)parts.get(0);
                keep.add(p0.text());
                used = Math.min(p0.minutes(), available);
                for (int i = 1; i < parts.size(); ++i) {
                    defer.add(((Model.Part)parts.get(i)).text());
                }
            }
            String splitAction = defer.isEmpty() ? "\u4eca\u665a\u6309\u987a\u5e8f\u505a\u5b8c\u300c" + String.join((CharSequence)"\u3001", keep) + "\u300d\uff0c\u5408\u8ba1 " + used + " \u5206\u949f\u3002" : "\u4eca\u665a\u505a\u5b8c\u300c" + String.join((CharSequence)"\u3001", keep) + "\u300d\uff0c\u5408\u8ba1 " + used + " \u5206\u949f\uff1b\u628a\u300c" + String.join((CharSequence)"\u3001", defer) + "\u300d\u632a\u5230\u4e0b\u4e00\u65f6\u6bb5\u3002";
            cands.add(new Model.Candidate("C-split", "\u62c6\u5c0f", "\u628a\u80fd\u505a\u5b8c\u7684\u90e8\u5206\u7559\u5728\u4eca\u665a", splitAction, "\u7f3a\u53e3 " + gap + " \u5206\u949f\uff0c\u6574\u4ef6\u585e\u4e0d\u8fdb\u53bb\uff1b\u5148\u4fdd\u8bc1\u6709\u4e00\u5757\u662f\u5b8c\u6210\u72b6\u6001\uff0c\u6bd4\u5168\u90fd\u505c\u5728\u534a\u8def\u597d\u3002", WrapCardEngine.effect(used, available, 0), true));
            cands.add(new Model.Candidate("C-move", "\u79fb\u671f", "\u6574\u4ef6\u632a\u5230\u4e0b\u4e00\u53ef\u7528\u65f6\u6bb5", "\u4eca\u665a\u4e0d\u786c\u505a\uff0c\u6539\u5230\u660e\u5929\u540c\u4e00\u65f6\u95f4\u7a97\uff08" + WrapCardEngine.hhmmOf(wStart) + "\u2013" + WrapCardEngine.hhmmOf(wEnd) + "\uff09\u6574\u6bb5\u5904\u7406\u3002", "\u7f3a\u53e3 " + gap + " \u5206\u949f\uff0c\u538b\u7f29\u53ea\u4f1a\u628a\u7761\u7720\u5f80\u540e\u63a8\uff1b\u6574\u6bb5\u632a\u8d70\u80fd\u4fdd\u4f4f\u5b8c\u6210\u8d28\u91cf\u3002", WrapCardEngine.effect(demand, available, 0), true));
            cands.add(new Model.Candidate("C-scope", "\u7f29\u5c0f\u8303\u56f4", "\u548c\u5bf9\u65b9\u786e\u8ba4\u80fd\u5426\u5c11\u505a\u4e00\u90e8\u5206", "\u628a\u300c" + task + "\u300d\u7684\u8303\u56f4\u8bf4\u6e05\u695a\uff0c\u95ee\u5bf9\u65b9\u54ea\u4e00\u90e8\u5206\u53ef\u4ee5\u5148\u4e0d\u8981\u3002", "\u7f3a\u53e3 " + gap + " \u5206\u949f\u9760\u81ea\u5df1\u662f\u8865\u4e0d\u56de\u6765\u7684\uff0c\u9700\u8981\u5916\u90e8\u677e\u4e00\u677e\u3002", WrapCardEngine.effect(null, available, null), true));
            if (!fixed.isEmpty()) {
                Model.FixedBlock f0 = (Model.FixedBlock)fixed.get(0);
                int freed = WrapCardEngine.overlap(wStart, wEnd, WrapCardEngine.hhmm(f0.start()), WrapCardEngine.hhmm(f0.end()));
                cands.add(new Model.Candidate("C-pause", "\u6682\u505c\u81ea\u9009", "\u4eca\u665a\u5148\u653e\u4e0b\u300c" + f0.name() + "\u300d", "\u628a\u300c" + f0.name() + "\u300d\uff08" + WrapCardEngine.hhmmOf(WrapCardEngine.hhmm(f0.start())) + "\u2013" + WrapCardEngine.hhmmOf(WrapCardEngine.hhmm(f0.end())) + "\uff09\u4eca\u665a\u8ba9\u51fa\u6765\uff0c\u7f3a\u53e3\u53ef\u51cf " + freed + " \u5206\u949f\u3002", "\u8fd9\u4e00\u9879\u662f\u81ea\u9009\u5b89\u6392\uff0c\u8ba9\u51fa\u6765\u4e0d\u6b20\u4efb\u4f55\u4eba\u3002", WrapCardEngine.effect(demand, available + freed, 0), true));
            }
        }
        LinkedHashMap<String, Object> d4 = new LinkedHashMap<String, Object>();
        d4.put("\u6570\u91cf", cands.size());
        d4.put("\u7c7b\u578b", cands.stream().map(Model.Candidate::type).toList());
        trace.add(new Model.TraceStep("4 \u5019\u9009\u5904\u7406\u65b9\u5f0f", "ok", d4));
        Model.Candidate chosen = (Model.Candidate)cands.get(0);
        ArrayList<Map<String, Object>> plan = new ArrayList<Map<String, Object>>();
        for (Model.Part p : parts) {
            LinkedHashMap<String, Object> m = new LinkedHashMap<String, Object>();
            m.put("part", p.text());
            m.put("minutes", p.minutes());
            plan.add(m);
        }
        Model.Card card = new Model.Card(runId, "\u4eca\u665a\u7684\u6536\u5c3e\u5361", task, deadline == null ? "" : deadline.format(FMT), true, (String)verdictZh, Math.max(gap, 0), WrapCardEngine.hhmmOf(wStart) + "\u2013" + WrapCardEngine.hhmmOf(wEnd), input.windowNote(), plan, chosen.title(), chosen.action(), "\u622a\u6b62\u65f6\u95f4\u6ca1\u6709\u88ab\u6539\u52a8\u3002\u660e\u5929\u9192\u4e86\u53ef\u4ee5\u5728\u8fd9\u91cc\u6539\uff0c\u4e5f\u53ef\u4ee5\u6574\u5f20\u64a4\u6389\u3002");
        LinkedHashMap<String, Object> d5 = new LinkedHashMap<String, Object>();
        d5.put("\u6807\u9898", card.title());
        d5.put("\u91c7\u7528\u65b9\u6848", chosen.title());
        d5.put("\u622a\u6b62\u662f\u5426\u88ab\u4fee\u6539", false);
        trace.add(new Model.TraceStep("5 \u6536\u5c3e\u5361\u8349\u7a3f", "ok", d5));
        Model.Result result = new Model.Result(verdict, (String)verdictZh, gap, available, demand, cands, card, List.of(), true);
        return this.finish(runId, now, input, trace, result);
    }

    private static Map<String, Object> effect(Integer demand, Integer available, Integer gap) {
        LinkedHashMap<String, Object> m = new LinkedHashMap<String, Object>();
        m.put("\u9700\u6c42", demand);
        m.put("\u53ef\u7528", available);
        m.put("\u7f3a\u53e3", gap);
        return m;
    }

    private Model.RunRecord finish(String runId, LocalDateTime now, Model.WrapCardInput input, List<Model.TraceStep> trace, Model.Result result) {
        trace.add(new Model.TraceStep("6 \u7b49\u5f85\u7528\u6237\u786e\u8ba4", "pending", "\u5de5\u4f5c\u6d41\u5230\u6b64\u6682\u505c\uff0c\u786e\u8ba4\u8bb0\u5f55\u7531 /api/confirm \u5199\u5165\u540c\u4e00\u6761 run \u8bb0\u5f55\u3002"));
        String status = result.card() == null ? "rejected_input" : "awaiting_confirm";
        return new Model.RunRecord(runId, WORKFLOW, now.format(EXEC_FMT), input, trace, result, null, status);
    }
}

