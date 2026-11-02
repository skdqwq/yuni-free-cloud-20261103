/*
 * Decompiled with CFR 0.152.
 */
package com.yuni.store;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name="run_record")
public class RunEntity {
    @Id
    @Column(length=40)
    private String runId;
    @Column(length=40)
    private String sessionId;
    @Column(length=80)
    private String workflow;
    @Column(length=32)
    private String executedAt;
    @Column(columnDefinition="text")
    private String inputJson;
    @Column(columnDefinition="text")
    private String traceJson;
    @Column(columnDefinition="text")
    private String resultJson;
    @Column(columnDefinition="text")
    private String confirmationJson;
    @Column(length=24)
    private String status;
    private LocalDateTime createdAt;

    public String getRunId() {
        return this.runId;
    }

    public void setRunId(String runId) {
        this.runId = runId;
    }

    public String getSessionId() {
        return this.sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public String getWorkflow() {
        return this.workflow;
    }

    public void setWorkflow(String workflow) {
        this.workflow = workflow;
    }

    public String getExecutedAt() {
        return this.executedAt;
    }

    public void setExecutedAt(String executedAt) {
        this.executedAt = executedAt;
    }

    public String getInputJson() {
        return this.inputJson;
    }

    public void setInputJson(String inputJson) {
        this.inputJson = inputJson;
    }

    public String getTraceJson() {
        return this.traceJson;
    }

    public void setTraceJson(String traceJson) {
        this.traceJson = traceJson;
    }

    public String getResultJson() {
        return this.resultJson;
    }

    public void setResultJson(String resultJson) {
        this.resultJson = resultJson;
    }

    public String getConfirmationJson() {
        return this.confirmationJson;
    }

    public void setConfirmationJson(String confirmationJson) {
        this.confirmationJson = confirmationJson;
    }

    public String getStatus() {
        return this.status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalDateTime getCreatedAt() {
        return this.createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}

