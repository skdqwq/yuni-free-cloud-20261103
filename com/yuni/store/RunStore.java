/*
 * Decompiled with CFR 0.152.
 */
package com.yuni.store;

import com.yuni.engine.Model;
import com.yuni.store.CardActionEntity;
import com.yuni.store.CardActionRepository;
import com.yuni.store.JsonCodec;
import com.yuni.store.RunEntity;
import com.yuni.store.RunRepository;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RunStore {
    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private final RunRepository runs;
    private final CardActionRepository actions;
    private final JsonCodec codec;

    public RunStore(RunRepository runs, CardActionRepository actions, JsonCodec codec) {
        this.runs = runs;
        this.actions = actions;
        this.codec = codec;
    }

    @Transactional
    public Model.RunRecord save(Model.RunRecord record, String sessionId) {
        RunEntity e = new RunEntity();
        e.setRunId(record.runId());
        e.setSessionId(sessionId);
        e.setWorkflow(record.workflow());
        e.setExecutedAt(record.executedAt());
        e.setInputJson(this.codec.write(record.input()));
        e.setTraceJson(this.codec.write(record.trace()));
        e.setResultJson(this.codec.write(record.result()));
        e.setStatus(record.status());
        e.setCreatedAt(LocalDateTime.now());
        this.runs.save(e);
        return record;
    }

    public String sessionIdOf(String runId) {
        return this.runs.findById(runId).map(RunEntity::getSessionId).orElse(null);
    }

    public Model.RunRecord load(String runId) {
        RunEntity e = (RunEntity)this.runs.findById(runId).orElseThrow(() -> new IllegalArgumentException("\u627e\u4e0d\u5230\u8fd9\u6761\u8fd0\u884c\u8bb0\u5f55\uff1a" + runId));
        return new Model.RunRecord(e.getRunId(), e.getWorkflow(), e.getExecutedAt(), this.codec.read(e.getInputJson(), Model.WrapCardInput.class), this.codec.readList(e.getTraceJson(), Model.TraceStep.class), this.codec.read(e.getResultJson(), Model.Result.class), e.getConfirmationJson() == null ? null : this.codec.readMap(e.getConfirmationJson()), e.getStatus());
    }

    @Transactional
    public Model.RunRecord applyConfirmation(String runId, String action, String reason) {
        Model.RunRecord current = this.load(runId);
        LinkedHashMap<String, Object> conf = new LinkedHashMap<String, Object>();
        conf.put("action", action);
        conf.put("reason", reason == null ? "" : reason);
        conf.put("at", LocalDateTime.now().format(FMT));
        conf.put("deadlineUntouched", true);
        String status = switch (action) {
            case "confirm" -> "confirmed";
            case "undo" -> "undone";
            default -> "modified";
        };
        RunEntity e = (RunEntity)this.runs.findById(runId).orElseThrow();
        e.setConfirmationJson(this.codec.write(conf));
        e.setStatus(status);
        this.runs.save(e);
        CardActionEntity a = new CardActionEntity();
        a.setRunId(runId);
        a.setAction(action);
        a.setReason(reason);
        a.setCreatedAt(LocalDateTime.now());
        this.actions.save(a);
        return new Model.RunRecord(current.runId(), current.workflow(), current.executedAt(), current.input(), current.trace(), current.result(), conf, status);
    }

    public List<CardActionEntity> actionsOf(String runId) {
        return this.actions.findByRunIdOrderByIdAsc(runId);
    }
}

