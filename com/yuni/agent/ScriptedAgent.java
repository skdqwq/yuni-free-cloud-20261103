/*
 * Decompiled with CFR 0.152.
 */
package com.yuni.agent;

import com.yuni.agent.ScriptLibrary;
import com.yuni.engine.Model;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

@Component
public class ScriptedAgent {
    private static final Pattern MINUTES = Pattern.compile("(\\d{1,3})\\s*\u5206\u949f");
    private static final Pattern HOURS = Pattern.compile("(\\d{1,2}(?:\\.\\d)?)\\s*(?:\u4e2a)?\\s*\u5c0f\u65f6");
    private static final Pattern CN_HOURS = Pattern.compile("([\u4e00\u4e24\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u534a])\\s*(?:\u4e2a)?\\s*\u5c0f\u65f6");
    private static final Pattern CLOCK = Pattern.compile("(\\d{1,2})\\s*[\u70b9:\uff1a]\\s*(\\d{1,2})?");
    private static final Pattern RANGE = Pattern.compile("(\\d{1,2})\\s*[\u70b9:\uff1a]?\\s*(\\d{1,2})?\\s*(?:\u5230|\u81f3|-|~|\u2014)\\s*(\\d{1,2})\\s*[\u70b9:\uff1a]?\\s*(\\d{1,2})?");
    private final ScriptLibrary scripts = new ScriptLibrary();

    public ScriptLibrary scripts() {
        return this.scripts;
    }

    public Step handle(Context ctx, String rawText, LocalDateTime now) {
        String text = rawText == null ? "" : rawText.trim();
        ++ctx.turns;
        if (text.isEmpty()) {
            return new Step(this.scripts.line("fallback", ctx.style), this.scripts.quick("greet"), ctx.state.name(), null, "EMPTY");
        }
        if (this.looksLikeUndo(text)) {
            ctx.state = State.CLOSED;
            return new Step(this.scripts.line("card_undone", ctx.style), List.of("\u91cd\u65b0\u7b97\u4e00\u6b21"), ctx.state.name(), null, "UNDO");
        }
        if (this.looksLikeAccept(text) && ctx.state == State.CARD) {
            ctx.state = State.CLOSED;
            return new Step(this.scripts.line("card_confirmed", ctx.style), List.of("\u660e\u65e9\u89c1"), ctx.state.name(), null, "ACCEPT");
        }
        if (this.looksLikeMorning(text)) {
            ctx.state = State.CLOSED;
            return new Step(this.scripts.line("morning", ctx.style), List.of("\u770b\u4e00\u773c", "\u5148\u4e0d\u770b\u4e86"), ctx.state.name(), null, "MORNING");
        }
        return switch (ctx.state.ordinal()) {
            default -> throw new MatchException(null, null);
            case 0, 1 -> this.firstOrListen(ctx, text, now);
            case 2 -> this.withTask(ctx, text, now);
            case 3 -> this.withDeadline(ctx, text, now);
            case 4 -> this.withMinutes(ctx, text, now);
            case 5 -> this.withWindow(ctx, text, now);
            case 6 -> new Step(this.scripts.line("card_waiting", ctx.style), this.scripts.quick("ready"), ctx.state.name(), null, "IDLE");
            case 7 -> new Step(this.scripts.line("fallback", ctx.style), this.scripts.quick("greet"), ctx.state.name(), null, "CLOSED");
        };
    }

    private Step firstOrListen(Context ctx, String text, LocalDateTime now) {
        boolean taskish;
        Slot slot = Slot.parse(text, now);
        boolean vent = ScriptedAgent.containsAny(text, "\u7d2f", "\u56f0", "\u70e6", "\u96be\u53d7", "\u54ed", "\u5d29", "\u7761\u4e0d\u7740", "\u7126\u8651", "\u6491\u4e0d\u4f4f");
        boolean bl = taskish = slot.minutes > 0 || ScriptedAgent.containsAny(text, "\u4f5c\u4e1a", "\u62a5\u544a", "PPT", "ppt", "\u8bba\u6587", "\u5b9e\u9a8c", "\u590d\u4e60", "\u8981\u4ea4", "\u6ca1\u505a", "\u6ca1\u5199", "\u505a\u4e0d\u5b8c", "\u8bfe\u8bbe");
        if (!taskish) {
            ctx.state = State.LISTEN;
            String id = vent ? "listen_vent" : "listen_more";
            return new Step(this.scripts.line(id, ctx.style), this.scripts.quick("greet"), ctx.state.name(), null, vent ? "VENT" : "CHAT");
        }
        ctx.task = slot.task != null ? slot.task : text;
        ctx.minutes = slot.minutes;
        if (slot.deadline != null) {
            ctx.deadline = slot.deadline;
            ctx.state = State.ASK_MINUTES;
            return new Step(this.scripts.line("ask_minutes", ctx.style), this.scripts.quick("ask_minutes"), ctx.state.name(), null, "TASK");
        }
        ctx.state = State.ASK_DEADLINE;
        return new Step(this.scripts.line("ask_deadline", ctx.style), this.scripts.quick("ask_deadline"), ctx.state.name(), null, "TASK");
    }

    private Step withTask(Context ctx, String text, LocalDateTime now) {
        ctx.task = text;
        Slot slot = Slot.parse(text, now);
        if (slot.deadline != null) {
            ctx.deadline = slot.deadline;
            ctx.state = State.ASK_MINUTES;
            return new Step(this.scripts.line("ask_minutes", ctx.style), this.scripts.quick("ask_minutes"), ctx.state.name(), null, "TASK");
        }
        ctx.state = State.ASK_DEADLINE;
        return new Step(this.scripts.line("ask_deadline", ctx.style), this.scripts.quick("ask_deadline"), ctx.state.name(), null, "TASK");
    }

    private Step withDeadline(Context ctx, String text, LocalDateTime now) {
        Slot slot = Slot.parse(text, now);
        if (slot.deadline == null) {
            ctx.state = State.ASK_DEADLINE;
            return new Step(this.scripts.line("ask_deadline", ctx.style), this.scripts.quick("ask_deadline"), ctx.state.name(), null, "CLARIFY");
        }
        if (this.looksLikeTask(text)) {
            ctx.task = Slot.extractTask(text);
        }
        ctx.deadline = slot.deadline;
        if (slot.minutes > 0) {
            ctx.minutes = slot.minutes;
        }
        ctx.state = State.ASK_MINUTES;
        return new Step(this.scripts.line("ask_minutes", ctx.style), this.scripts.quick("ask_minutes"), ctx.state.name(), null, "TIME_OK");
    }

    private Step withMinutes(Context ctx, String text, LocalDateTime now) {
        Slot slot = Slot.parse(text, now);
        int n = ctx.minutes = slot.minutes > 0 ? slot.minutes : Math.max(30, ctx.minutes);
        if (ctx.minutes <= 0) {
            ctx.minutes = 60;
        }
        if (slot.rangeStart != null) {
            return this.finishWindow(ctx, slot.rangeStart, slot.rangeEnd, null);
        }
        ctx.state = State.ASK_WINDOW;
        return new Step(this.scripts.line("ask_window", ctx.style), this.scripts.quick("ask_window"), ctx.state.name(), null, "MINUTES_OK");
    }

    private Step withWindow(Context ctx, String text, LocalDateTime now) {
        Slot slot = Slot.parse(text, now);
        if (slot.rangeStart != null) {
            return this.finishWindow(ctx, slot.rangeStart, slot.rangeEnd, null);
        }
        if (slot.hours > 0.0) {
            String start = now.toLocalTime().withSecond(0).withNano(0).toString().substring(0, 5);
            int endMin = Math.min(1439, now.getHour() * 60 + now.getMinute() + (int)(slot.hours * 60.0));
            return this.finishWindow(ctx, start, String.format("%02d:%02d", endMin / 60, endMin % 60), "\u4f60\u8bf4\u7684\u662f\u6709 " + ScriptedAgent.fmtDur(slot.hours) + "\uff0c\u6ca1\u8bf4\u4ece\u51e0\u70b9\u5f00\u59cb\uff0c\u6240\u4ee5\u8d77\u70b9\u6309\u6b64\u523b\u7b97");
        }
        return this.finishWindow(ctx, "21:00", "23:30", "\u4f60\u6ca1\u8bf4\u5177\u4f53\u65f6\u6bb5\uff0c\u8fd9\u91cc\u5148\u6309 21:00\u201323:30 \u7b97\uff0c\u53ef\u4ee5\u6539");
    }

    private static String fmtDur(double hours) {
        int m = (int)Math.round(hours * 60.0);
        return m % 60 == 0 ? m / 60 + " \u5c0f\u65f6" : m + " \u5206\u949f";
    }

    private Step finishWindow(Context ctx, String start, String end, String note) {
        ctx.windowStart = start;
        ctx.windowEnd = end;
        ctx.state = State.CARD;
        if (ctx.task == null || ctx.task.isBlank()) {
            return new Step(this.scripts.line("no_parts", ctx.style), this.scripts.quick("ask_task"), ctx.state.name(), null, "NO_TASK");
        }
        int total = ctx.minutes > 0 ? ctx.minutes : 60;
        int second = Math.max(15, Math.min(30, total / 3));
        ArrayList<Model.Part> parts = new ArrayList<Model.Part>();
        parts.add(new Model.Part(ctx.task, total));
        parts.add(new Model.Part("\u6536\u5c3e\u4e0e\u68c0\u67e5", second));
        Model.WrapCardInput input = new Model.WrapCardInput(ctx.task, ctx.deadline == null ? null : ctx.deadline.toString().substring(0, 16), parts, List.of(), new Model.TimeWindow(start, end), total, note);
        return new Step(this.scripts.line("ready", ctx.style), this.scripts.quick("ready"), ctx.state.name(), input, "RUN_WORKFLOW");
    }

    private boolean looksLikeTask(String t) {
        return ScriptedAgent.containsAny(t, "\u4f5c\u4e1a", "\u62a5\u544a", "PPT", "ppt", "\u8bba\u6587", "\u5b9e\u9a8c", "\u590d\u4e60", "\u8bfe\u8bbe", "\u8981\u4ea4", "\u6ca1\u505a", "\u6ca1\u5199", "\u505a\u4e0d\u5b8c", "\u7ec4\u4f1a", "\u6f14\u8bb2", "\u7b54\u8fa9");
    }

    private boolean looksLikeAccept(String t) {
        return ScriptedAgent.containsAny(t, "\u5c31\u6309\u8fd9\u4e2a", "\u6309\u8fd9\u4e2a\u6765", "\u53ef\u4ee5", "\u884c", "\u597d\u7684", "\u786e\u8ba4", "\u5c31\u8fd9\u6837", "\u6210\u4e86");
    }

    private boolean looksLikeUndo(String t) {
        return ScriptedAgent.containsAny(t, "\u5148\u4e0d\u505a", "\u64a4\u6389", "\u64a4\u9500", "\u7b97\u4e86", "\u4e0d\u5f04\u4e86", "\u660e\u5929\u518d\u8bf4");
    }

    private boolean looksLikeMorning(String t) {
        return ScriptedAgent.containsAny(t, "\u65e9\u4e0a\u597d", "\u65e9\u5b89", "\u8d77\u5e8a\u4e86", "\u9192\u4e86");
    }

    private static boolean containsAny(String text, String ... keys) {
        for (String k : keys) {
            if (!text.contains(k)) continue;
            return true;
        }
        return false;
    }

    public static class Context {
        public String sessionId;
        public String style = "gentle";
        public State state = State.GREET;
        public String task;
        public LocalDateTime deadline;
        public int minutes;
        public String windowStart = "21:00";
        public String windowEnd = "23:30";
        public int turns;
        public String lastRunId;

        public void reset() {
            this.state = State.GREET;
            this.task = null;
            this.deadline = null;
            this.minutes = 0;
            this.windowStart = "21:00";
            this.windowEnd = "23:30";
            this.lastRunId = null;
        }
    }

    public record Step(String reply, List<String> quickReplies, String state, Model.WrapCardInput wrapInput, String intent) {
    }

    public static enum State {
        GREET,
        LISTEN,
        ASK_TASK,
        ASK_DEADLINE,
        ASK_MINUTES,
        ASK_WINDOW,
        CARD,
        CLOSED;

    }

    static class Slot {
        LocalDateTime deadline;
        int minutes;
        double hours;
        String rangeStart;
        String rangeEnd;
        String task;

        Slot() {
        }

        static Slot parse(String text, LocalDateTime now) {
            Matcher r;
            Matcher h;
            Slot s = new Slot();
            String norm = Slot.normalize(text);
            Matcher m = MINUTES.matcher(norm);
            if (m.find()) {
                s.minutes = Integer.parseInt(m.group(1));
            }
            if ((h = HOURS.matcher(norm)).find()) {
                s.hours = Double.parseDouble(h.group(1));
                s.minutes = (int)Math.round(s.hours * 60.0);
            }
            if ((r = RANGE.matcher(norm)).find()) {
                s.rangeStart = String.format("%02d:%02d", Integer.parseInt(r.group(1)), r.group(2) == null ? 0 : Integer.parseInt(r.group(2)));
                s.rangeEnd = String.format("%02d:%02d", Integer.parseInt(r.group(3)), r.group(4) == null ? 0 : Integer.parseInt(r.group(4)));
            }
            int dayOffset = -1;
            if (text.contains("\u540e\u5929")) {
                dayOffset = 2;
            } else if (text.contains("\u660e\u5929")) {
                dayOffset = 1;
            } else if (text.contains("\u5468") || text.contains("\u661f\u671f")) {
                dayOffset = Slot.nextWeekday(text, now);
            }
            Matcher c = CLOCK.matcher(norm);
            int hour = -1;
            int minute = 0;
            while (c.find()) {
                int v = Integer.parseInt(c.group(1));
                if (v < 0 || v > 24) continue;
                hour = v;
                minute = c.group(2) == null ? 0 : Integer.parseInt(c.group(2));
            }
            if (dayOffset >= 0 || hour >= 0) {
                LocalDateTime candidate;
                LocalDateTime base = now.plusDays(Math.max(dayOffset, 0));
                if (hour < 0) {
                    hour = text.contains("\u4e0a\u5348") ? 9 : (text.contains("\u4e2d\u5348") ? 12 : (text.contains("\u4e0b\u5348") ? 15 : (text.contains("\u665a\u4e0a") ? 20 : 23)));
                    minute = 0;
                }
                if ((text.contains("\u4e0b\u5348") || text.contains("\u665a\u4e0a")) && hour < 12) {
                    hour += 12;
                }
                if (hour == 24) {
                    base = base.plusDays(1L);
                    hour = 0;
                }
                if ((candidate = base.toLocalDate().atTime(LocalTime.of(hour, Math.min(minute, 59)))).isBefore(now) && dayOffset < 0) {
                    candidate = candidate.plusDays(1L);
                }
                s.deadline = candidate;
            }
            s.task = Slot.extractTask(text);
            return s;
        }

        static String normalize(String raw) {
            String t = raw.replace("\u4e24\u4e2a\u534a\u5c0f\u65f6", "2.5\u5c0f\u65f6").replace("\u4e00\u4e2a\u534a\u5c0f\u65f6", "1.5\u5c0f\u65f6").replace("\u534a\u4e2a\u5c0f\u65f6", "0.5\u5c0f\u65f6").replace("\u534a\u5c0f\u65f6", "0.5\u5c0f\u65f6").replace("\u4e24\u4e2a\u5c0f\u65f6", "2\u5c0f\u65f6").replace("\u4e00\u4e2a\u5c0f\u65f6", "1\u5c0f\u65f6");
            Matcher m = Pattern.compile("([\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341]{1,3})\\s*\u70b9(\\s*\u534a)?").matcher(t);
            StringBuilder sb = new StringBuilder();
            while (m.find()) {
                m.appendReplacement(sb, Slot.cn2int(m.group(1)) + "\u70b9" + (m.group(2) != null ? "30" : ""));
            }
            m.appendTail(sb);
            Matcher hm = Pattern.compile("([\u4e00\u4e24\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u534a]+)\\s*\u4e2a?\\s*(?:\u5c0f\u65f6|\u949f\u5934)").matcher(sb.toString());
            StringBuilder sb2 = new StringBuilder();
            while (hm.find()) {
                String g = hm.group(1);
                String num = "\u534a".equals(g) ? "0.5" : String.valueOf(Slot.cn2int(g));
                hm.appendReplacement(sb2, num + "\u5c0f\u65f6");
            }
            hm.appendTail(sb2);
            return sb2.toString();
        }

        static int cn2int(String s) {
            String digits = "\u96f6\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d";
            if (s.equals("\u5341")) {
                return 10;
            }
            if (s.startsWith("\u5341")) {
                return 10 + digits.indexOf(s.charAt(1));
            }
            if (s.length() == 1) {
                return digits.indexOf(s.charAt(0));
            }
            return digits.indexOf(s.charAt(0)) * 10 + digits.indexOf(s.charAt(1));
        }

        private static int nextWeekday(String text, LocalDateTime now) {
            String[] keys = new String[]{"\u4e00", "\u4e8c", "\u4e09", "\u56db", "\u4e94", "\u516d", "\u65e5", "\u5929"};
            for (int i = 0; i < keys.length; ++i) {
                if (!text.contains("\u5468" + keys[i]) && !text.contains("\u661f\u671f" + keys[i])) continue;
                int target = i == 7 ? 7 : i + 1;
                int today = now.getDayOfWeek().getValue();
                int delta = (target - today + 7) % 7;
                return delta == 0 ? 7 : delta;
            }
            return -1;
        }

        static String extractTask(String text) {
            String t = text.trim();
            int cut = -1;
            for (String mark : new String[]{"\u8981\u4ea4", "\u622a\u6b62", "\u4e4b\u524d", "\u4ea4", "\u505a\u5b8c", "\u5199\u5b8c"}) {
                int i = t.indexOf(mark);
                if (i <= 0 || cut >= 0 && i >= cut) continue;
                cut = i;
            }
            if (cut > 4) {
                t = t.substring(0, cut);
            }
            return t.length() > 40 ? t.substring(0, 40) : t;
        }
    }
}

