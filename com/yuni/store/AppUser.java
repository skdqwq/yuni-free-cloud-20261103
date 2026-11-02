/*
 * Decompiled with CFR 0.152.
 */
package com.yuni.store;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name="app_user", indexes={@Index(name="uk_app_user_name", columnList="username", unique=true)})
public class AppUser {
    @Id
    @Column(length=40)
    private String id;
    @Column(length=32, nullable=false, unique=true)
    private String username;
    @Column(length=80, nullable=false)
    private String passHash;
    @Column(length=16)
    private String style;
    private LocalDateTime createdAt;
    private LocalDateTime lastLoginAt;

    public String getId() {
        return this.id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getUsername() {
        return this.username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassHash() {
        return this.passHash;
    }

    public void setPassHash(String passHash) {
        this.passHash = passHash;
    }

    public String getStyle() {
        return this.style;
    }

    public void setStyle(String style) {
        this.style = style;
    }

    public LocalDateTime getCreatedAt() {
        return this.createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getLastLoginAt() {
        return this.lastLoginAt;
    }

    public void setLastLoginAt(LocalDateTime lastLoginAt) {
        this.lastLoginAt = lastLoginAt;
    }
}

