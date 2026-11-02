/*
 * Decompiled with CFR 0.152.
 */
package com.yuni.store;

import com.yuni.store.MorningRecord;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MorningRecordRepository
extends JpaRepository<MorningRecord, String> {
    public Optional<MorningRecord> findFirstByUserIdOrderByCreatedAtDesc(String var1);

    public List<MorningRecord> findByUserIdOrderByCreatedAtDesc(String var1);

    public void deleteByUserId(String var1);
}

