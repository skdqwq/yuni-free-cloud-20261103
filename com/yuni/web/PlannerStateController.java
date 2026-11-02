package com.yuni.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/internal-state")
public class PlannerStateController {
    private final JdbcTemplate db;
    private final ObjectMapper json;
    public PlannerStateController(JdbcTemplate db, ObjectMapper json) {
        this.db = db; this.json = json;
        db.execute("CREATE TABLE IF NOT EXISTS yuni_planner_state (user_id VARCHAR(64) PRIMARY KEY, revision INTEGER NOT NULL, payload TEXT NOT NULL)");
    }
    @GetMapping
    public Map<String,Object> read(HttpServletRequest request) throws Exception {
        var rows = db.queryForList("SELECT payload FROM yuni_planner_state WHERE user_id = ?", AuthSupport.uid(request));
        if (rows.isEmpty()) return Map.of("revision",0,"tasks",java.util.List.of());
        return json.readValue((String) rows.get(0).get("payload"), new com.fasterxml.jackson.core.type.TypeReference<Map<String,Object>>(){});
    }
    @PutMapping
    public Map<String,Object> write(@RequestBody Map<String,Object> state, HttpServletRequest request) throws Exception {
        String uid = AuthSupport.uid(request);
        if (!(state.get("revision") instanceof Integer rev) || rev < 0 || rev == Integer.MAX_VALUE) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        state.put("revision", rev + 1);
        String payload = json.writeValueAsString(state);
        if (payload.length() > 250000) throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE);
        int updated = db.update("UPDATE yuni_planner_state SET revision=?, payload=? WHERE user_id=? AND revision=?",rev+1,payload,uid,rev);
        if (updated == 0 && rev == 0) {
            try { updated = db.update("INSERT INTO yuni_planner_state(user_id,revision,payload) VALUES(?,?,?)",uid,1,payload); }
            catch(DuplicateKeyException conflict) { updated = 0; }
        }
        if(updated == 0) throw new ResponseStatusException(HttpStatus.CONFLICT,"数据已更新，请刷新后重试");
        return state;
    }
}
