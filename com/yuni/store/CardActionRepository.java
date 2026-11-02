/*
 * Decompiled with CFR 0.152.
 */
package com.yuni.store;

import com.yuni.store.CardActionEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CardActionRepository
extends JpaRepository<CardActionEntity, Long> {
    public List<CardActionEntity> findByRunIdOrderByIdAsc(String var1);

    public void deleteByRunId(String var1);
}

