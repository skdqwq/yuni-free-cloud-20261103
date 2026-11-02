/*
 * Decompiled with CFR 0.152.
 */
package com.yuni.store;

import com.yuni.store.MessageEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MessageRepository
extends JpaRepository<MessageEntity, Long> {
    public List<MessageEntity> findBySessionIdOrderByIdAsc(String var1);

    public boolean existsBySessionId(String var1);

    public void deleteBySessionId(String var1);

    public long countBySessionId(String var1);
}

