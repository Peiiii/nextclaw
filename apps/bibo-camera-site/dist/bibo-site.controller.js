const camera = document.querySelector("#camera");
const companion = document.querySelector(".companion");
const creature = document.querySelector("#creature");
const speech = document.querySelector("#speech");
const shutter = document.querySelector("#shutter");
const tapScreen = document.querySelector("#tap-screen");
const previous = document.querySelector("#previous");
const dialog = document.querySelector("#info");
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const frames = [
  {
    time: "09:12 AM",
    headline: ["交给我。", "你去忙。"],
    theme: "一句交代",
    caption: "你说方向，我记住重点。",
    speech: "把这件事，交给我。",
    content: ".request",
  },
  {
    time: "10:08 AM",
    headline: ["记得你。", "才懂重点。"],
    theme: "结合你的背景",
    caption: "不是多找一点，是找对重点。",
    speech: "记得。小团队，先把首发做好。",
    content: ".focus-note",
  },
  {
    time: "02:36 PM",
    headline: ["你去生活。", "我在留意。"],
    theme: "你忙你的",
    caption: "你不在场，事情也往前走。",
    speech: "你忙。我还在看着呢。",
    content: ".away",
  },
  {
    time: "05:20 PM",
    headline: ["有了进展。", "带给你看。"],
    theme: "带着结果回来",
    caption: "有值得知道的，再来找你。",
    speech: "这条，与你有关。",
    content: ".result",
  },
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
  if (index === 1) selectors.push(".sources");
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
      keyframes = [
        { opacity: 1, translate: "0px 0px", scale: 1 },
        { opacity: 0, translate: "90px -160px", scale: .2 },
      ];
    }
    sceneAnimations.push(
      element.animate(keyframes, {
        duration: entering ? 440 : 160,
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
function render() {
  const current = frames[frame];
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
    frame === 0 ? "交给 Bibo" : frame === 3 ? "再看我们的一天" : "按一下，下一帧";
  const touchHint = matchMedia("(pointer: coarse)").matches;
  document.querySelector("#screen-hint").textContent = frame === 3
    ? `${touchHint ? "轻点或左滑" : "轻点"}重看 ↻ · 示例`
    : `${touchHint ? "轻点或左滑" : "轻点继续"} → · 示例`;
  shutter.setAttribute(
    "aria-label",
    frame === 3 ? "按快门，从第一帧重看" : "按快门，看下一帧",
  );
  tapScreen.setAttribute(
    "aria-label",
    frame === 3 ? "点击取景画面，从第一帧重看" : "点击取景画面，看下一帧",
  );
  speech.textContent = current.speech;
  creature.setAttribute("aria-label", frame === 0 ? "把这件事交给 Bibo" : "和 Bibo 打个招呼");
  previous.disabled = frame === 0;
  for (const item of frames)
    document
      .querySelector(item.content)
      .setAttribute("aria-hidden", String(item !== current));
}
function moveTo(next, direction = next > frame ? 1 : -1) {
  if (exposing || next < 0 || next >= frames.length) return;
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
  }, 160);
  releaseTimer = setTimeout(() => {
    exposing = false;
    camera.classList.remove("exposing");
    for (const control of [shutter, tapScreen, previous])
      control.removeAttribute("aria-disabled");
    previous.disabled = frame === 0;
    clearSceneAnimations();
  }, 600);
}
function advance() {
  moveTo((frame + 1) % frames.length, 1);
}
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
    handoff.ghost.textContent = "给 Bibo\n帮我盯住这三个竞品。";
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
  if (dialog.open || event.altKey || event.ctrlKey || event.metaKey) return;
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
document
  .querySelector("#about")
  .addEventListener("click", () => dialog.showModal());
for (const id of ["close", "back"])
  document
    .querySelector("#" + id)
    .addEventListener("click", () => dialog.close());
dialog.addEventListener("close", () =>
  document.querySelector("#about").focus({ preventScroll: true }),
);
window.addEventListener("pagehide", () => {
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
