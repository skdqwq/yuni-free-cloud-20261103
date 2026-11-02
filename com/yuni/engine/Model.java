/*
 * Decompiled with CFR 0.152.
 */
package com.yuni.engine;

import java.util.List;
import java.util.Map;

public final class Model {
    private Model() {
    }

    public record RunRecord(String runId, String workflow, String executedAt, WrapCardInput input, List<TraceStep> trace, Result result, Object confirmation, String status) {
    }

    public record Result(String verdict, String verdictZh, Integer gapMinutes, Integer available, Integer demand, List<Candidate> candidates, Card card, List<RuleCheck> blockingRules, boolean rulesAllPassed) {
    }

    public record Card(String runId, String title, String oneThing, String deadline, boolean deadlineUntouched, String verdict, int gapMinutes, String slot, String slotNote, List<Map<String, Object>> plan, String proposal, String proposalAction, String footer) {
    }

    public record Candidate(String id, String type, String title, String action, String rationale, Map<String, Object> effect, boolean requiresConfirm) {
    }

    public record TraceStep(String stage, String status, Object detail) {
    }

    public record RuleCheck(String rule, String desc, boolean passed, String detail) {
    }

    public record WrapCardInput(String task, String deadline, List<Part> mustParts, List<FixedBlock> fixedBlocks, TimeWindow window, Integer willingMinutes, String windowNote) {
        public WrapCardInput(String task, String deadline, List<Part> mustParts, List<FixedBlock> fixedBlocks, TimeWindow window, Integer willingMinutes) {
            this(task, deadline, mustParts, fixedBlocks, window, willingMinutes, null);
        }
    }

    public record TimeWindow(String start, String end) {
    }

    public record FixedBlock(String name, String start, String end) {
    }

    public record Part(String text, int minutes) {
    }
}

