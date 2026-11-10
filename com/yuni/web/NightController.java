package com.yuni.web;

import com.yuni.llm.LlmClient;
import com.yuni.llm.PromptBuilder;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/** A separate, opt-in space; it does not reuse the automatic profile extraction. */
@RestController
@RequestMapping("/api/night")
public class NightController {
    private final JdbcTemplate db;
    private final LlmClient llm;
    private final PromptBuilder prompts;
    public NightController(JdbcTemplate db, LlmClient llm, PromptBuilder prompts) {
        this.db = db; this.llm = llm; this.prompts = prompts;
        db.execute("CREATE TABLE IF NOT EXISTS yuni_night_cards (id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(64) NOT NULL, content VARCHAR(500) NOT NULL, purpose VARCHAR(20) NOT NULL, created_at VARCHAR(40) NOT NULL)");
        db.execute("CREATE TABLE IF NOT EXISTS yuni_night_preferences (user_id VARCHAR(64) PRIMARY KEY, fewer_questions BOOLEAN NOT NULL, short_stories BOOLEAN NOT NULL, no_advice BOOLEAN NOT NULL)");
    }
    private String uid(HttpServletRequest req) {
        String uid = AuthSupport.uid(req);
        if (uid == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        return uid;
    }
    @GetMapping("/cards")
    public List<Map<String,Object>> cards(HttpServletRequest req) {
        return db.query("SELECT id, content, purpose, created_at FROM yuni_night_cards WHERE user_id=? ORDER BY created_at DESC", (rs,n) -> Map.<String,Object>of("id",rs.getString(1),"content",rs.getString(2),"purpose",rs.getString(3),"created_at",rs.getString(4)), uid(req));
    }
    @PostMapping("/cards")
    public Map<String,Object> addCard(@RequestBody CardInput in, HttpServletRequest req) {
        String text = in.content() == null ? "" : in.content().strip();
        if (text.isEmpty() || text.length() > 500 || in.purpose() == null || !Set.of("self", "tomorrow", "keep").contains(in.purpose()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请填写不超过500字的内容并选择用途");
        String id = UUID.randomUUID().toString(), time = Instant.now().toString();
        db.update("INSERT INTO yuni_night_cards(id,user_id,content,purpose,created_at) VALUES(?,?,?,?,?)", id, uid(req), text, in.purpose(), time);
        return Map.of("id",id,"content",text,"purpose",in.purpose(),"created_at",time);
    }
    @DeleteMapping("/cards/{id}")
    public Map<String,Boolean> deleteCard(@PathVariable String id, HttpServletRequest req) {
        if (db.update("DELETE FROM yuni_night_cards WHERE id=? AND user_id=?",id,uid(req)) == 0)
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        return Map.of("deleted",true);
    }
    @GetMapping("/preferences")
    public Map<String,Boolean> preferences(HttpServletRequest req) {
        var rows = db.query("SELECT fewer_questions,short_stories,no_advice FROM yuni_night_preferences WHERE user_id=?", (rs,n)->Map.of("fewerQuestions",rs.getBoolean(1),"shortStories",rs.getBoolean(2),"noAdvice",rs.getBoolean(3)), uid(req));
        return rows.isEmpty() ? Map.of("fewerQuestions",false,"shortStories",false,"noAdvice",false) : rows.get(0);
    }
    @PutMapping("/preferences")
    @Transactional
    public Map<String,Boolean> savePreferences(@RequestBody Preferences p, HttpServletRequest req) {
        String user = uid(req);
        db.update("DELETE FROM yuni_night_preferences WHERE user_id=?",user);
        db.update("INSERT INTO yuni_night_preferences(user_id,fewer_questions,short_stories,no_advice) VALUES(?,?,?,?)",user,p.fewerQuestions(),p.shortStories(),p.noAdvice());
        return preferences(req);
    }
    @DeleteMapping("/preferences")
    public Map<String,Boolean> clearPreferences(HttpServletRequest req) {
        db.update("DELETE FROM yuni_night_preferences WHERE user_id=?",uid(req));
        return Map.of("deleted",true);
    }
    @PostMapping("/reply")
    public Map<String,Object> reply(@RequestBody ReplyInput input, HttpServletRequest req) {
        uid(req);
        String text = input.text() == null ? "" : input.text().strip();
        if (text.isEmpty() || text.length() > 2000) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"请输入不超过2000字的内容");
        String[] crisis = {"不想活", "想死", "自杀", "结束生命", "伤害自己", "割腕", "跳楼", "杀了自己"};
        if (Arrays.stream(crisis).anyMatch(text::contains)) return Map.of("reply","听起来你现在承受了很多，你的安全很重要。请立刻联系身边信任的人陪着你；如果有迫在眉睫的危险，请立即联系当地急救或报警服务。", "engine","safety");
        var pref = preferences(req);
        int turn = Math.max(1, Math.min(input.turn(), 100));
        String system = "你是屿YUNI里的虚拟伙伴NiNi，陪伴成年人在睡前梳理情绪。坦诚自己是AI，不假装真人；不评判对错、不比较痛苦、不替用户决定，不诊断、不治疗、不承诺睡眠疗效。对危险情况优先鼓励联系可信的人或当地急救。不要诱导依赖或不断延长聊天。" +
            (turn <= 2 ? "先简短接住情绪，不强迫提供细节。" : "请逐渐缩短回复并减少追问，允许用户随时结束。") +
            (pref.get("fewerQuestions") ? "尽量不提问。" : "最多问一个非强制问题。") +
            (pref.get("shortStories") ? "如用户要求故事，保持简短。" : "") +
            (pref.get("noAdvice") ? "除紧急安全情况外，不主动给建议。" : "不要主动给出长篇建议。") + "用自然中文，不超过80字。";
        if (llm.available()) try {
            List<String[]> history = new ArrayList<>();
            if (input.history() != null) {
                var turns = input.history();
                for (var item : turns.subList(Math.max(0, turns.size() - 6), turns.size())) {
                    if (item != null && ("user".equals(item.role()) || "assistant".equals(item.role())) && item.text() != null && item.text().length() <= 2000)
                        history.add(new String[]{item.role(), item.text()});
                }
            }
            String answer = llm.complete(prompts.messages(system,history,text),0.6,160);
            if (answer != null && !answer.isBlank()) return Map.of("reply",answer.strip(),"engine","model");
        } catch (Exception ignored) { }
        return Map.of("reply", turn <= 2 ? "听起来这件事让你有些难受。你可以慢慢说，也可以先停在这里。" : "我听到了。今晚不必急着解决，想停下时随时可以。", "engine","fallback");
    }
    public record CardInput(String content,String purpose) {}
    public record Preferences(boolean fewerQuestions,boolean shortStories,boolean noAdvice) {}
    public record Turn(String role,String text) {}
    public record ReplyInput(String text,int turn,List<Turn> history) {}
}
