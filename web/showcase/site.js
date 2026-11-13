(() => {
  'use strict';
  // Show the illustration immediately, then greet once when each figure enters view.
  // Only visible figures animate; no loop deforms the model or its wings.
  function animateFigure(figureId,buttonId,statusId){
    const figure=document.getElementById(figureId),button=document.getElementById(buttonId),status=document.getElementById(statusId),replay=document.querySelector(`[data-nini-replay="${figureId}"]`);
    if(!figure||!button)return;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    let loaded=false,loading=false,paused=false,visible=false,manual=false,attempted=false,player,scheduled;
    function sync(){
      const playing=!paused&&visible&&!document.hidden&&(!reduced.matches||manual);
      figure.dataset.motion=playing?'playing':'paused';
      button.disabled=loading;
      button.textContent=loading?'NiNi 正在准备…':!loaded?'播放打招呼 ↗':paused?'继续动作':'暂停动作';
      button.setAttribute('aria-pressed',String(loaded&&!paused));
      if(replay)replay.hidden=!loaded;
    }
    async function load(){
      if(loaded||loading)return;attempted=true;loading=true;sync();
      try{const module=await import('./nini-player.js?v=showcase-20261113-restore');player=await module.startGreeting({figureId,idleMotion:true});loaded=true;if(status)status.textContent='你好呀。慢慢来，我陪你。';}
      catch{if(status)status.textContent='NiNi 在这里，陪你慢慢来。';}
      finally{loading=false;sync();}
    }
    button.addEventListener('click',async()=>{if(loading)return;if(!loaded){manual=true;paused=false;await load();}else{paused=!paused;if(!paused)manual=true;sync();}});
    replay?.addEventListener('click',()=>{if(!player)return;manual=true;paused=false;player.replay();sync();});
    document.addEventListener('visibilitychange',sync);
    reduced.addEventListener('change',()=>{manual=false;if(reduced.matches)paused=true;sync();});
    window.addEventListener('nini:greeting-lost',event=>{if(event.detail?.figureId!==figureId)return;loaded=false;sync();});
    function observe(on){visible=on;clearTimeout(scheduled);sync();if(on&&!attempted&&!reduced.matches&&!navigator.connection?.saveData)scheduled=setTimeout(load,400);}
    if('IntersectionObserver'in window)new IntersectionObserver(([entry])=>observe(entry.isIntersecting),{threshold:.15}).observe(figure);else observe(true);
    sync();
  }
  animateFigure('nini-greeting','nini-motion','nini-status');
})();

(() => {
  const scene = document.querySelector(".portrait-scene");
  const card = scene.querySelector(".portrait");
  let yaw = 0, pitch = 0, startX = 0, startY = 0, startYaw = 0, startPitch = 0, activePointer = null;
  function show() {
    card.style.setProperty("--portrait-y", `${yaw}deg`);
    card.style.setProperty("--portrait-x", `${pitch}deg`);
  }
  scene.addEventListener("pointerdown", event => {
    if (event.button !== 0 || activePointer !== null) return;
    activePointer = event.pointerId; startX = event.clientX; startY = event.clientY;
    startYaw = yaw; startPitch = pitch;
    scene.setPointerCapture(activePointer); scene.classList.add("is-dragging");
  });
  scene.addEventListener("pointermove", event => {
    if (event.pointerId !== activePointer) return;
    yaw = startYaw + (event.clientX - startX) * .8;
    pitch = startPitch - (event.clientY - startY) * .8;
    show();
  });
  function release(event) {
    if (event.pointerId !== activePointer) return;
    activePointer = null; scene.classList.remove("is-dragging");
  }
  scene.addEventListener("pointerup", release);
  scene.addEventListener("pointercancel", release);
  scene.addEventListener("lostpointercapture", release);
  function reset() { yaw = 0; pitch = 0; show(); }
  scene.addEventListener("dblclick", reset);
  scene.addEventListener("keydown", event => {
    if (event.key === "Home") { event.preventDefault(); reset(); return; }
    const delta = { ArrowLeft: [-25, 0], ArrowRight: [25, 0], ArrowUp: [0, 25], ArrowDown: [0, -25] }[event.key];
    if (!delta) return;
    event.preventDefault(); yaw += delta[0]; pitch += delta[1]; show();
  });
})();

(() => {
  if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  document.documentElement.classList.add("reveal-ready");
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add("is-visible"); observer.unobserve(entry.target); }
  }), { threshold: .12 });
  document.querySelectorAll("[data-reveal]").forEach(item => observer.observe(item));
})();

(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  document.querySelectorAll("#stories .narrative-frame").forEach(frame => {
    const slides = [...frame.querySelectorAll(".narrative-slide")];
    if (slides.length < 2) return;
    const breath = frame.querySelector(".narrative-breath");
    let current = 0, visible = !("IntersectionObserver" in window), timer, breathing;
    function show(index) {
      current = (index + slides.length) % slides.length;
      slides.forEach((slide, i) => slide.classList.toggle("is-current", i === current));
    }
    function schedule() {
      clearTimeout(timer);
      if (breathing) { breathing.cancel(); breathing = null; }
      if (!visible || reduce.matches || document.hidden) return;
      const advance = () => { show(current+1); schedule(); };
      if (typeof breath.animate !== "function") {
        timer = setTimeout(advance, 5000);
        return;
      }
      breathing = breath.animate([
        { transform: "scale(.75)", opacity: .45, boxShadow: "0 0 5px #f3d1a455", offset: 0 },
        { transform: "scale(1.45)", opacity: 1, boxShadow: "0 0 20px 7px #f3d1a477", offset: .5 },
        { transform: "scale(.75)", opacity: .45, boxShadow: "0 0 5px #f3d1a455", offset: 1 }
      ], { duration: 5000, easing: "ease-in-out", fill: "forwards" });
      breathing.finished.then(advance).catch(() => {});
    }
    reduce.addEventListener("change", schedule);
    document.addEventListener("visibilitychange", schedule);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(entries => { visible = entries[0].isIntersecting; schedule(); }, { threshold: .1 }).observe(frame);
    }
    schedule();
  });
})();

(() => {
  const root = document.getElementById("stories");
  const buttons = [...root.querySelectorAll("[data-story]")];
  const moment = root.querySelector(".story-moment");
  const data = {
    new: { time: "初到这里", title: "已经很努力地融入了，\n还是有点想家。", detail: "新的节奏、新的关系，需要一点时间熟悉。今晚，不用急着变得游刃有余。", response: "慢一点也没关系，我陪你适应。" },
    busy: { time: "放不下明天", title: "明天的事情还没来，\n心已经先忙起来了。", detail: "任务、消息和期待一起涌上来。先把今晚还在脑海里的事，轻轻放一放。", response: "不用今晚解决所有事，我们先缓一缓。" },
    alone: { time: "房间安静下来", title: "有些话说不清楚，\n也不想打扰谁。", detail: "不是每一种情绪都需要立刻找到答案。你可以不解释，只是给自己留一点空间。", response: "不想说也可以，我在这里。" }
  };
  function choose(name) {
    const item = data[name];
    buttons.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.story === name)));
    moment.querySelector(".story-time").textContent = item.time;
    moment.querySelector("h3").textContent = item.title;
    moment.querySelector(".story-description").textContent = item.detail;
    moment.querySelector(".story-response strong").textContent = item.response;
  }
  buttons.forEach(button => button.addEventListener("click", () => choose(button.dataset.story)));
  root.querySelector(".story-next").addEventListener("click", () => {
    const target = document.querySelector('#experience [data-select="listen"]');
    target.click();
    document.getElementById("experience").scrollIntoView({behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"});
  });
})();

(() => {
  const root = document.getElementById("experience");
  const stage = root.querySelector(".scene-stage");
  const choices = [...root.querySelectorAll("[data-select]")];
  const casts = [...root.querySelectorAll("[data-person]")];
  const photos = [...root.querySelectorAll("[data-photo]")];
  const action = root.querySelector(".scene-action");
  const reply = root.querySelector(".scene-reply");
  const breatheLabel = root.querySelector(".scene-breathe-label");
  const goodnightLabel = root.querySelector(".scene-goodnight-label");
  const index = root.querySelector(".scene-index");
  const heading = root.querySelector(".scene-copy h3");
  const detail = root.querySelector(".scene-detail");
  const copy = {
    listen: ["01 / 03", "有话就说一句。", "白天还在心里的事，可以轻轻说出来。", "播放对话"],
    breathe: ["02 / 03", "安静一会儿。", "跳过输入，按自己的节奏慢慢呼吸。", "开始放松"],
    finish: ["03 / 03", "今晚，就到这里。", "想停的时候，随时可以放下手机。", "结束今晚"]
  };
  let selected = "listen";
  let person = "woman";
  let replyTimer;
  function showPhoto() {
    for (const photo of photos) {
      const visible = photo.dataset.photo === person + "-" + selected;
      photo.classList.toggle("scene-visible", visible);
      photo.setAttribute("aria-hidden", String(!visible));
    }
  }
  function select(scene) {
    if (scene === selected) return;
    selected = scene;
    clearTimeout(replyTimer);
    reply.hidden = false;
    reply.classList.remove("scene-enter");
    stage.classList.remove("scene-playing", "scene-finished");
    choices.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.select === scene)));
    showPhoto();
    root.querySelectorAll("[data-view]").forEach(view => { view.hidden = view.dataset.view !== scene; });
    [index.textContent, heading.textContent, detail.textContent, action.textContent] = copy[scene];
    breatheLabel.textContent = "跟着自己的节奏";
    goodnightLabel.textContent = "什么时候结束，由你决定。";
    action.removeAttribute("aria-disabled");
  }
  for (const button of choices) {
    const activate = () => select(button.dataset.select);
    button.addEventListener("pointerenter", event => {
      if (event.pointerType === "mouse") activate();
    });
    button.addEventListener("focus", () => {
      if (button.matches(":focus-visible")) activate();
    });
    button.addEventListener("click", activate);
  }
  for (const button of casts) {
    button.addEventListener("click", () => {
      person = button.dataset.person;
      for (const cast of casts) {
        cast.setAttribute("aria-pressed", String(cast === button));
      }
      showPhoto();
    });
  }
  action.addEventListener("click", () => {
    if (action.getAttribute("aria-disabled") === "true") return;
    if (selected === "listen") {
      clearTimeout(replyTimer);
      reply.classList.remove("scene-enter");
      reply.hidden = true;
      stage.classList.add("scene-playing");
      replyTimer = setTimeout(() => {
        reply.hidden = false;
        reply.classList.add("scene-enter");
        stage.classList.remove("scene-playing");
        action.textContent = "再看一次";
      }, 950);
    } else if (selected === "breathe") {
      const playing = stage.classList.toggle("scene-playing");
      breatheLabel.textContent = playing ? "慢慢呼吸" : "已暂停";
      action.textContent = playing ? "暂停放松" : "继续放松";
    } else {
      stage.classList.add("scene-finished");
      goodnightLabel.textContent = "好，今晚就到这里。晚安。";
      action.textContent = "已结束";
      action.setAttribute("aria-disabled", "true");
    }
  });
})();

const styles = [...document.querySelectorAll("[data-style]")];
const reply = document.querySelector("#style-reply");
const replies = {
  listen: "「那句话到了晚上还在心里。你可以只说到这里。」",
  warm: "「明明已经回到家了，心里却还卡在那一刻。今晚可以先歇一歇。」",
  direct: "「那句话还让你在意。今晚可以先说到这里。」"
};

styles.forEach((button) => {
  button.addEventListener("click", () => {
    styles.forEach((style) => style.setAttribute("aria-pressed", String(style === button)));
    reply.textContent = replies[button.dataset.style];
  });
});

// Keep each entry on the working application address, independent of the showcase host.
(() => {
 const address='https://yuni-free-cloud-20261103.onrender.com/';
 document.querySelectorAll('a[href="'+address+'"]').forEach(link=>link.classList.add('app-link'));
})();
