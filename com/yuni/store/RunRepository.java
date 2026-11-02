/*
 * Decompiled with CFR 0.152.
 */
package com.yuni.store;

import com.yuni.store.RunEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RunRepository
extends JpaRepository<RunEntity, String> {
    public List<RunEntity> findTop20ByOrderByCreatedAtDesc();

    public Optional<RunEntity> findFirstBySessionIdOrderByCreatedAtDesc(String var1);

    public List<RunEntity> findBySessionId(String var1);
}

