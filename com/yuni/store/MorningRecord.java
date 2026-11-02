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
@Table(name="morning_record")
public class MorningRecord {
    @Id
    @Column(length=12)
    private String id;
    @Column(length=40)
    private String userId;
    @Column(length=32)
    private String mood;
    @Column(columnDefinition="text")
    private String dream;
    @Column(nullable=false)
    private int layer;
    @Column(columnDefinition="text")
    private String notes;
    @Column(columnDefinition="text")
    private String letter;
    @Column(length=16)
    private String letterState;
    @Column
    private LocalDateTime createdAt;
    @Column
    private LocalDateTime updatedAt;

    public String getId() {
        return this.id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getUserId() {
        return this.userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getMood() {
        return this.mood;
    }

    public void setMood(String mood) {
        this.mood = mood;
    }

    public String getDream() {
        return this.dream;
    }

    public void setDream(String dream) {
        this.dream = dream;
    }

    public int getLayer() {
        return this.layer;
    }

    public void setLayer(int layer) {
        this.layer = layer;
    }

    public String getNotes() {
        return this.notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public String getLetter() {
        return this.letter;
    }

    public void setLetter(String letter) {
        this.letter = letter;
    }

    public String getLetterState() {
        return this.letterState;
    }

    public void setLetterState(String letterState) {
        this.letterState = letterState;
    }

    public LocalDateTime getCreatedAt() {
        return this.createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return this.updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}

