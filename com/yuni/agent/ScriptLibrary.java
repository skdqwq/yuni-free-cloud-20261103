/*
 * Decompiled with CFR 0.152.
 */
package com.yuni.agent;

import java.io.InputStream;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.core.io.ClassPathResource;
import org.yaml.snakeyaml.Yaml;

public class ScriptLibrary {
    private final Map<String, Map<String, String>> lines;
    private final Map<String, List<String>> quick;

    public ScriptLibrary() {
        Map root;
        try (InputStream in = new ClassPathResource("agent/scripts.yml").getInputStream();){
            root = (Map)new Yaml().load(in);
        }
        catch (Exception e) {
            throw new IllegalStateException("\u5267\u672c\u5e93\u52a0\u8f7d\u5931\u8d25", e);
        }
        LinkedHashMap parsedLines = new LinkedHashMap();
        Object rawLines = root.get("lines");
        if (rawLines instanceof Map) {
            Map<?, ?> m = (Map<?, ?>)rawLines;
            for (Map.Entry e : m.entrySet()) {
                LinkedHashMap<String, String> byStyle = new LinkedHashMap<String, String>();
                Object object = e.getValue();
                if (object instanceof Map) {
                    Map<?, ?> styles = (Map<?, ?>)object;
                    for (Map.Entry v : styles.entrySet()) {
                        byStyle.put(String.valueOf(v.getKey()), String.valueOf(v.getValue()));
                    }
                }
                parsedLines.put(String.valueOf(e.getKey()), byStyle);
            }
        }
        this.lines = Collections.unmodifiableMap(parsedLines);
        LinkedHashMap<String, List<String>> parsedQuick = new LinkedHashMap<String, List<String>>();
        Object rawQuick = root.get("quick");
        if (rawQuick instanceof Map) {
            Map<?, ?> m = (Map<?, ?>)rawQuick;
            for (Map.Entry e : m.entrySet()) {
                Object v = e.getValue();
                if (!(v instanceof List)) continue;
                List l = (List)v;
                parsedQuick.put(String.valueOf(e.getKey()), l.stream().map(String::valueOf).toList());
            }
        }
        this.quick = Collections.unmodifiableMap(parsedQuick);
    }

    public String line(String id, String style) {
        Map<String, String> byStyle = this.lines.getOrDefault(id, Map.of());
        String v = (String)byStyle.get(style);
        if (v == null) {
            v = byStyle.getOrDefault("gentle", "");
        }
        return v;
    }

    public List<String> quick(String id) {
        return this.quick.getOrDefault(id, List.of());
    }

    public int size() {
        return this.lines.size();
    }
}

