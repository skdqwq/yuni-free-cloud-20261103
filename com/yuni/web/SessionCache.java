/*
 * Decompiled with CFR 0.152.
 */
package com.yuni.web;

import com.yuni.agent.ScriptedAgent;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

@Component
public class SessionCache {
    private static final long TTL_SECONDS = 43200L;
    private final Map<String, Entry> local = new ConcurrentHashMap<String, Entry>();
    private volatile long lastSweep = 0L;

    public ScriptedAgent.Context get(String sessionId) {
        Entry e = this.local.get(sessionId);
        if (e == null) {
            return null;
        }
        if (e.expireAt().isBefore(Instant.now())) {
            this.local.remove(sessionId);
            return null;
        }
        return e.ctx();
    }

    public void put(ScriptedAgent.Context ctx) {
        if (ctx == null || ctx.sessionId == null) {
            return;
        }
        this.local.put(ctx.sessionId, new Entry(ctx, Instant.now().plusSeconds(43200L)));
        this.sweep();
    }

    public void drop(String sessionId) {
        this.local.remove(sessionId);
    }

    private void sweep() {
        long now = System.currentTimeMillis();
        if (now - this.lastSweep < 300000L) {
            return;
        }
        this.lastSweep = now;
        Instant t = Instant.now();
        this.local.entrySet().removeIf(e -> ((Entry)e.getValue()).expireAt().isBefore(t));
    }

    public String backend() {
        return "local";
    }

    private record Entry(ScriptedAgent.Context ctx, Instant expireAt) {
    }
}

