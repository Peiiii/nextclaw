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
    theme: "一句交代",
    caption: "你说方向，我记住重点。",
    speech: "来，看我们的一天。",
    content: ".request",
  },
  {
    time: "10:08 AM",
    theme: "结合你的背景",
    caption: "不是多找一点，是找对重点。",
    speech: "记得。小团队，先把首发做好。",
    content: ".focus-note",
  },
  {
    time: "02:36 PM",
    theme: "你忙你的",
    caption: "你不在场，事情也往前走。",
    speech: "你忙。我还在看着呢。",
    content: ".away",
  },
  {
    time: "05:20 PM",
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
function animateScene(index, entering, direction) {
  const selectors = [frames[index].content];
  if (index === 1) selectors.push(".sources");
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    const keyframes = entering
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
    frame === 3 ? "再看我们的一天" : "按一下，下一帧";
  shutter.setAttribute(
    "aria-label",
    frame === 3 ? "按快门，从第一帧重看" : "按快门，看下一帧",
  );
  tapScreen.setAttribute(
    "aria-label",
    frame === 3 ? "点击取景画面，从第一帧重看" : "点击取景画面，看下一帧",
  );
  speech.textContent = current.speech;
  previous.disabled = frame === 0 || exposing;
  for (const item of frames)
    document
      .querySelector(item.content)
      .setAttribute("aria-hidden", String(item !== current));
}
function moveTo(next, direction = next > frame ? 1 : -1) {
  if (exposing || next < 0 || next >= frames.length) return;
  clearTimeout(greetingTimer);
  companion.classList.remove("hello");
  if (reduced.matches) {
    frame = next;
    render();
    return;
  }
  exposing = true;
  shutter.disabled = true;
  tapScreen.disabled = true;
  previous.disabled = true;
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
    shutter.disabled = false;
    tapScreen.disabled = false;
    previous.disabled = frame === 0;
    clearSceneAnimations();
  }, 600);
}
function advance() {
  moveTo((frame + 1) % frames.length, 1);
}
shutter.addEventListener("click", advance);
tapScreen.addEventListener("click", advance);
previous.addEventListener("click", () => moveTo(frame - 1));
camera.addEventListener("keydown", (event) => {
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
  clearSceneAnimations();
  clearTimeout(changeTimer);
  clearTimeout(releaseTimer);
  clearTimeout(greetingTimer);
});
window.addEventListener("pageshow", (event) => {
  if (!event.persisted) return;
  exposing = false;
  camera.classList.remove("exposing");
  shutter.disabled = false;
  tapScreen.disabled = false;
  render();
});
render();
