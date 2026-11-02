/*
 * Decompiled with CFR 0.152.
 */
package com.yuni.store;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JavaType;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class JsonCodec {
    private final ObjectMapper om = new ObjectMapper().findAndRegisterModules().disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    public String write(Object value) {
        try {
            return this.om.writeValueAsString(value);
        }
        catch (Exception e) {
            throw new IllegalStateException("\u5e8f\u5217\u5316\u5931\u8d25", e);
        }
    }

    public String pretty(Object value) {
        try {
            return this.om.writerWithDefaultPrettyPrinter().writeValueAsString(value);
        }
        catch (Exception e) {
            throw new IllegalStateException("\u5e8f\u5217\u5316\u5931\u8d25", e);
        }
    }

    public <T> T read(String json, Class<T> type) {
        try {
            return (T)this.om.readValue(json, type);
        }
        catch (Exception e) {
            throw new IllegalStateException("\u53cd\u5e8f\u5217\u5316\u5931\u8d25", e);
        }
    }

    public <T> List<T> readList(String json, Class<T> type) {
        try {
            return (List)this.om.readValue(json, (JavaType)this.om.getTypeFactory().constructCollectionType(List.class, type));
        }
        catch (Exception e) {
            throw new IllegalStateException("\u53cd\u5e8f\u5217\u5316\u5931\u8d25", e);
        }
    }

    public Map<String, Object> readMap(String json) {
        try {
            return (Map)this.om.readValue(json, (TypeReference)new TypeReference<Map<String, Object>>(){});
        }
        catch (Exception e) {
            throw new IllegalStateException("\u53cd\u5e8f\u5217\u5316\u5931\u8d25", e);
        }
    }
}

