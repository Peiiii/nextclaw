const camera = document.querySelector("#camera");
const companion = document.querySelector(".companion");
const creature = document.querySelector("#creature");
const speech = document.querySelector("#speech");
const shutter = document.querySelector("#shutter");
const tapScreen = document.querySelector("#tap-screen");
const previous = document.querySelector("#previous");
const dialog = document.querySelector("#info");
const planPanel = document.querySelector("#plan-panel");
const openPlan = document.querySelector("#open-plan");
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const frames = [
  { time: "01 / 看全局", headline: ["你说一件事。", "我多想几步。"], theme: "把你的事情，放在一起考虑", caption: "你的新计划，与已有项目和空闲时间一起安排。", action: "看看下一面", speech: "周四收尾，周五做成作品。帮你接上了。", content: ".request" },
  { time: "02 / 自己接着做", headline: ["不用一直催。", "我有下一步。"], theme: "自己规划，按时接着做", caption: "安排检查、发现变化、调整下一步。每一步都不必等你重新开口。", action: "再看一面", speech: "发现延期了。我会重新核查，再告诉你影响。", content: ".focus-note" },
  { time: "03 / 当下修正", headline: ["发现想偏了。", "自己改回来。"], theme: "发现问题，更新自己的工作准则", caption: "这次发现的偏差，写进自己的工作手册，改变下一次的做法。", action: "它还会复盘", speech: "我给自己补了一条：先确认期限，再展开方案。", content: ".away" },
  { time: "04 / 主动复盘", headline: ["没人提醒。", "也会复盘。"], theme: "回看结果，改善下一次", caption: "自己发现反复出现的问题，让下一次的做法真正不同。", action: "再看一遍", speech: "这周重复提醒太多。以后合并，只报重要变化。", content: ".result" }
];
let frame = 0;
let exposing = false;
let changeTimer;
let releaseTimer;
let greetingTimer;
let sceneAnimations = [];
let gestureStart = null;
let suppressTouchClick = false;
let handoff = null;
function animateScene(index, entering, direction) {
  const selectors = [frames[index].content];
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    let keyframes = entering
      ? [
          {
            opacity: 0,
            translate: `${direction * 42}px 8px`,
            filter: "blur(2px)",
          },
          {
            opacity: 1,
            translate: `${direction * -2}px 0px`,
            filter: "blur(0px)",
            offset: 0.8,
          },
          { opacity: 1, translate: "0px 0px", filter: "blur(0px)" },
        ]
      : [
          { opacity: 1, translate: "0px 0px", filter: "blur(0px)" },
          {
            opacity: 0,
            translate: `${direction * -30}px -3px`,
            filter: "blur(2px)",
          },
        ];
    if (!entering && index === 0 && direction === 1) {
      const paper = element.getBoundingClientRect();
      const target = creature.getBoundingClientRect();
      const dx = target.left + target.width / 2 - paper.left - paper.width / 2;
      const dy = target.top + target.height / 2 - paper.top - paper.height / 2;
      keyframes = [
        { opacity: 1, translate: "0px 0px", scale: 1, rotate: "0deg" },
        { opacity: 1, translate: "-8px 5px", scale: 1.025, rotate: "-3deg", offset: .18 },
        { opacity: 0, translate: `${dx}px ${dy}px`, scale: .08, rotate: "12deg" },
      ];
    }
    if (entering && index === 3) {
      keyframes = [
        { opacity: 0, translate: "25px -28px", rotate: "-7deg", scale: .94 },
        { opacity: 1, translate: "-3px 5px", rotate: "1deg", scale: 1.01, offset: .72 },
        { opacity: 1, translate: "0px 0px", rotate: "0deg", scale: 1 },
      ];
    }
    sceneAnimations.push(
      element.animate(keyframes, {
        duration: entering ? 540 : 240,
        easing: entering ? "cubic-bezier(.2,.75,.2,1)" : "ease-in",
        fill: "both",
      }),
    );
  }
}
function clearSceneAnimations() {
  sceneAnimations.forEach((animation) => animation.cancel());
  sceneAnimations = [];
}
let playbackId;
function stopPlayback() {
  cancelAnimationFrame(playbackId);
}
function playCurrentScene() {
  stopPlayback();
  const scene = document.querySelector(frames[frame].content);
  const title = scene.querySelector("h2");
  const fullText = title.dataset.fullText || title.textContent;
  title.dataset.fullText = fullText;
  const userInput = frame === 0 || frame === 2;
  let text;
  if (userInput) {
    title.setAttribute("aria-label", fullText);
    const conversation = title.closest(".chat-conversation");
    text = conversation.querySelector(".typed-text");
    if (!text) {
      const composer = document.createElement("div");
      composer.className = "chat-composer";
      composer.setAttribute("aria-hidden", "true");
      text = document.createElement("span");
      text.className = "typed-text";
      const send = document.createElement("span");
      send.className = "demo-send";
      send.textContent = "发送 ↑";
      composer.append(text, send);
      conversation.append(composer);
    }
  }
  const stages = [[2000,2700,4100,5400,6800],[1200,2300,3500,4800,6200],[1100,2000,3000,3900,4800],[1200,2600,4000,5400,6800]][frame];
  let elapsed = 0;
  let previousTime;
  function draw(time) {
    if (previousTime !== undefined && !document.hidden) elapsed += Math.min(time - previousTime, 100);
    previousTime = time;
    const done = reduced.matches || elapsed >= stages[4];
    const stage = done ? 5 : stages.filter(at => elapsed >= at).length;
    const changed = scene.dataset.step !== String(stage);
    scene.dataset.step = String(stage);
    if (changed || elapsed === 0) {
      speech.textContent = stage >= 4 ? frames[frame].speech : ["在呢，想聊什么？", "我看看今天的安排。", "让我再看一眼这个方案。", "翻开今天的复盘笔记。 "][frame];
    }
    if (frame === 1) {
      document.querySelector("#desk-time").textContent = stage === 0 ? "08:59" : "09:00";
      document.querySelector("#desk-status").textContent = stage === 0 ? "还有一分钟" : stage < 3 ? "到点，开始检查" : "本次检查完成";
      document.querySelector("#desk-result").textContent = stage < 2 ? "等待检查" : stage < 3 ? "正在核查…" : "素材延期了";
      document.querySelector("#desk-message").textContent = stage < 3 ? "到点我会自己检查，你不用守着。" : stage < 4 ? "发现延期。让我把后续重新安排一下。" : "新的检查已安排，我先做不用等的部分。";
    }
    if (frame === 3) {
      const lines = [...scene.querySelectorAll(".journal-line")];
      const pen = scene.querySelector(".journal-pen");
      let active;
      lines.forEach((line, index) => {
        const progress = done ? 1 : Math.max(0, Math.min(1, (elapsed - 2000 - index * 1200) / 1000));
        line.style.opacity = progress > 0 ? "1" : "0";
        line.style.clipPath = "none";
        const paragraph = line.querySelector("p");
        paragraph.style.clipPath = `inset(0 ${(1-progress)*100}% 0 0)`;
        if (progress > 0 && progress < 1) active = { paragraph, progress };
      });
      pen.style.opacity = active ? "1" : "0";
      if (active) {
        const paper = scene.querySelector(".notebook-paper");
        const line = active.paragraph;
        pen.style.left = `${line.offsetLeft + line.clientWidth * active.progress}px`;
        pen.style.top = `${line.offsetTop + line.clientHeight - 3}px`;
        paper.style.position = "relative";
      }
    }
    if (userInput) {
      text.textContent = done ? fullText : fullText.slice(0, Math.floor(fullText.length * Math.min(1, elapsed / 1700)));

    }
    if (!done) playbackId = requestAnimationFrame(draw);
  }
  draw(performance.now());
}
const replay = document.createElement("button");
replay.id = "replay-scene";
replay.textContent = "↻ 重播这一幕";
replay.addEventListener("click", () => { if (!exposing) playCurrentScene(); });
document.querySelector("#viewfinder").append(replay);
function render() {
  const current = frames[frame];
  playCurrentScene();
  openPlan.hidden = frame !== 3;
  planPanel.hidden = true;
  dialog.hidden = true;
  openPlan.setAttribute("aria-expanded", "false");
  document.querySelector("#keyboard-hint").hidden = frame === 3;
  camera.dataset.frame = String(frame);
  document.body.dataset.scene = String(frame);
  document.querySelector("#headline-start").textContent = current.headline[0];
  document.querySelector("#headline-end").textContent = current.headline[1];
  document.querySelector("#scene-number").textContent = String(frame + 1).padStart(2, "0");
  document.querySelectorAll(".film-progress i").forEach((segment, index) => {
    segment.classList.toggle("visited", index <= frame);
    segment.classList.toggle("current", index === frame);
  });
  document.querySelector("#timecode").textContent = current.time;
  document.querySelector("#frame-theme").textContent =
    String(frame + 1).padStart(2, "0") + " / " + current.theme;
  document.querySelector("#frame-counter").textContent =
    String(frame + 1).padStart(2, "0") + " — 04";
  document.querySelector("#caption").textContent = current.caption;
  document.querySelector("#next-label").textContent =
    current.action;
  const touchHint = matchMedia("(pointer: coarse)").matches;
  document.querySelector("#screen-hint").textContent = frame === 3
    ? "轻点，重看故事 ↻ · 示例"
    : `${touchHint ? "轻点或左滑" : "轻点继续"} → · 示例`;
  shutter.setAttribute(
    "aria-label",
    current.action,
  );
  tapScreen.setAttribute(
    "aria-label",
    frame === 3 ? "从第一帧重看故事" : "点击取景画面，看下一帧",
  );
  if (reduced.matches) speech.textContent = current.speech;
  creature.setAttribute("aria-label", frame === 0 ? "把这件事交给 Bibo" : "和 Bibo 打个招呼");
  previous.disabled = frame === 0;
  for (const item of frames)
    document
      .querySelector(item.content)
      .setAttribute("aria-hidden", String(item !== current));
}
function moveTo(next, direction = next > frame ? 1 : -1) {
  if (exposing || next < 0 || next >= frames.length) return;
  stopPlayback();
  cancelHandoff();
  clearTimeout(greetingTimer);
  companion.classList.remove("hello");
  if (reduced.matches) {
    frame = next;
    render();
    return;
  }
  exposing = true;
  for (const control of [shutter, tapScreen, previous])
    control.setAttribute("aria-disabled", "true");
  camera.style.setProperty("--turn", String(direction));
  camera.classList.add("exposing");
  animateScene(frame, false, direction);
  changeTimer = setTimeout(() => {
    frame = next;
    render();
    clearSceneAnimations();
    animateScene(frame, true, direction);
  }, 240);
  releaseTimer = setTimeout(() => {
    exposing = false;
    camera.classList.remove("exposing");
    for (const control of [shutter, tapScreen, previous])
      control.removeAttribute("aria-disabled");
    previous.disabled = frame === 0;
    clearSceneAnimations();
  }, 800);
}
function advance() {
  if (exposing) return;
  if (frame === 3) {
    moveTo(0, 1);
    return;
  }
  moveTo(frame + 1, 1);
}
openPlan.addEventListener("click", () => {
  planPanel.hidden = !planPanel.hidden;
  openPlan.setAttribute("aria-expanded", String(!planPanel.hidden));
  if (!planPanel.hidden) document.querySelector("#close-plan").focus({ preventScroll: true });
});
function closePlan() {
  planPanel.hidden = true;
  openPlan.setAttribute("aria-expanded", "false");
  openPlan.focus({ preventScroll: true });
}
document.querySelector("#close-plan").addEventListener("click", closePlan);
planPanel.addEventListener("keydown", event => {
  if (event.key === "Escape") { event.stopPropagation(); closePlan(); }
});
shutter.addEventListener("click", advance);
tapScreen.addEventListener("click", (event) => {
  if (suppressTouchClick && event.detail !== 0) return;
  advance();
});
tapScreen.addEventListener("pointerdown", (event) => {
  suppressTouchClick = false;
  gestureStart = null;
  if (event.pointerType === "mouse" && event.button === 0 && frame === 0 && !exposing) {
    const note = document.querySelector(".request").getBoundingClientRect();
    if (event.clientX >= note.left && event.clientX <= note.right && event.clientY >= note.top && event.clientY <= note.bottom) {
      handoff = { id: event.pointerId, x: event.clientX, y: event.clientY, ghost: null };
      tapScreen.setPointerCapture(event.pointerId);
    }
    return;
  }
  if (event.pointerType !== "touch" || !event.isPrimary || exposing) return;
  gestureStart = { id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp };
  tapScreen.setPointerCapture(event.pointerId);
});
tapScreen.addEventListener("pointerup", (event) => {
  if (handoff && event.pointerId === handoff.id) {
    const moved = Boolean(handoff.ghost);
    const accepted = isOverCompanion(event);
    cancelHandoff();
    if (moved) {
      suppressTouchClick = true;
      if (accepted) advance();
    }
    return;
  }
  const start = gestureStart;
  gestureStart = null;
  if (!start || event.pointerId !== start.id) return;
  const dx = event.clientX - start.x;
  const dy = event.clientY - start.y;
  if (Math.abs(dx) < 40 || Math.abs(dx) <= Math.abs(dy) * 1.3 || event.timeStamp - start.time > 700) return;
  suppressTouchClick = true;
  if (dx < 0) advance();
  else moveTo(frame - 1);
});
tapScreen.addEventListener("pointercancel", () => {
  gestureStart = null;
  if (handoff?.ghost) suppressTouchClick = true;
  cancelHandoff();
});
function isOverCompanion(event) {
  const rect = creature.getBoundingClientRect();
  return event.clientX >= rect.left - 20 && event.clientX <= rect.right + 20 && event.clientY >= rect.top - 20 && event.clientY <= rect.bottom + 20;
}
function cancelHandoff() {
  handoff?.ghost?.remove();
  handoff = null;
  camera.classList.remove("handing-over", "ready-to-receive");
  speech.textContent = frames[frame].speech;
}
tapScreen.addEventListener("pointermove", (event) => {
  if (!handoff || handoff.id !== event.pointerId) return;
  if (!handoff.ghost && Math.hypot(event.clientX - handoff.x, event.clientY - handoff.y) < 8) return;
  if (!handoff.ghost) {
    handoff.ghost = document.createElement("div");
    handoff.ghost.className = "handoff-note";
    handoff.ghost.textContent = "给 Bibo\n想学做网站，也想做好眼前的项目。";
    handoff.ghost.setAttribute("aria-hidden", "true");
    document.body.append(handoff.ghost);
    camera.classList.add("handing-over");
  }
  handoff.ghost.style.left = `${event.clientX - 80}px`;
  handoff.ghost.style.top = `${event.clientY - 25}px`;
  const ready = isOverCompanion(event);
  camera.classList.toggle("ready-to-receive", ready);
  const message = ready ? "接住了，松手就好。" : "对，拖到我这里。";
  if (speech.textContent !== message) speech.textContent = message;
});
previous.addEventListener("click", () => moveTo(frame - 1));
camera.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && handoff) {
    suppressTouchClick = true;
    cancelHandoff();
    return;
  }
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === "ArrowRight") {
    event.preventDefault();
    advance();
  }
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    moveTo(frame - 1);
  }
});
creature.addEventListener("click", () => {
  if (frame === 0) { advance(); return; }
  clearTimeout(greetingTimer);
  companion.classList.add("hello");
  speech.textContent = "在呢。按一下快门，我陪你看。";
  greetingTimer = setTimeout(() => {
    companion.classList.remove("hello");
    speech.textContent = frames[frame].speech;
  }, 2000);
});
document.addEventListener("pointermove", (event) => {
  if (reduced.matches || event.pointerType !== "mouse") return;
  const rect = creature.getBoundingClientRect();
  creature.style.setProperty(
    "--eye-x",
    Math.max(
      -7,
      Math.min(7, (event.clientX - rect.left - rect.width / 2) / 35),
    ) + "px",
  );
  creature.style.setProperty(
    "--eye-y",
    Math.max(
      -6,
      Math.min(6, (event.clientY - rect.top - rect.height / 2) / 40),
    ) + "px",
  );
});
document.querySelector("#about").addEventListener("click", () => {
  dialog.hidden = false;
  document.querySelector("#close").focus({ preventScroll: true });
});
function closeInfo() {
  dialog.hidden = true;
  document.querySelector("#about").focus({ preventScroll: true });
}
for (const id of ["close", "back"]) document.querySelector("#" + id).addEventListener("click", closeInfo);
dialog.addEventListener("keydown", event => { if (event.key === "Escape") { event.stopPropagation(); closeInfo(); } });
window.addEventListener("pagehide", () => {
  stopPlayback();
  cancelHandoff();
  gestureStart = null;
  suppressTouchClick = false;
  clearSceneAnimations();
  clearTimeout(changeTimer);
  clearTimeout(releaseTimer);
  clearTimeout(greetingTimer);
});
window.addEventListener("pageshow", (event) => {
  if (!event.persisted) return;
  exposing = false;
  camera.classList.remove("exposing");
  for (const control of [shutter, tapScreen, previous])
    control.removeAttribute("aria-disabled");
  render();
});

render();
