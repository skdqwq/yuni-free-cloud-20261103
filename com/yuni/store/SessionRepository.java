/*
 * Decompiled with CFR 0.152.
 */
package com.yuni.store;

import com.yuni.store.SessionEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SessionRepository
extends JpaRepository<SessionEntity, String> {
    public Optional<SessionEntity> findFirstByUserIdOrderByLastActiveAtDesc(String var1);

    public List<SessionEntity> findByUserIdOrderByLastActiveAtDesc(String var1);

    public List<SessionEntity> findByUserId(String var1);
}

