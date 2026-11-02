/*
 * Decompiled with CFR 0.152.
 */
package com.yuni.store;

import com.yuni.store.AppUser;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppUserRepository
extends JpaRepository<AppUser, String> {
    public Optional<AppUser> findByUsername(String var1);

    public boolean existsByUsername(String var1);
}

