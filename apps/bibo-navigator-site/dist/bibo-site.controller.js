const stage = document.querySelector("#playground");
const speech = document.querySelector("#speech");
const character = document.querySelector("#character");
const label = document.querySelector("#stage-label");
const title = document.querySelector("#result-title");
const detail = document.querySelector("#result-detail");
const deliveryLabel = document.querySelector("#delivery-label");
const tags = document.querySelector("#result-tags");
const taskButtons = [...document.querySelectorAll("[data-task]")];
const initialSpeech = speech.textContent;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
let completionTimer;
let greetingTimer;
let currentTask = null;
const tasks = {
  research: {
    reply: "收到。我去找重点，你不用翻一堆网页。",
    working: "正在比较三个产品的差异…",
    title: "3 款产品，先看这 2 个区别。",
    detail:
      "示例：A 适合轻量协作；B 的自动化更完整，但配置更复杂。按你的小团队背景，先试 A，再验证权限是否够用。",
    tags: ["对比表已整理", "关键取舍已标出", "下一步：试用 A"],
  },
  trip: {
    reply: "记得你不喜欢赶路。给周末留点空白。",
    working: "正在把偏好变成一份轻松的计划…",
    title: "周六，只安排两件开心的事。",
    detail:
      "示例：10:00 去河边散步，14:00 找一家安静的咖啡馆。其余时间留白。雨天改去美术馆；未进行任何预订。",
    tags: ["慢节奏", "有雨天备选", "没有预订"],
  },
  follow: {
    reply: "我来盯。有值得你知道的，再找你。",
    working: "正在筛选与发布有关的更新…",
    title: "5 条更新，只有 1 条值得打扰你。",
    detail:
      "示例：竞品简化了首次使用流程，与你下周的发布有关。其他 4 条属于企业功能，暂时不用分心。建议评审一下首次引导。",
    tags: ["1 条相关变化", "4 条噪音已略过", "建议：评审引导"],
  },
};
function clearTimers() {
  clearTimeout(completionTimer);
  clearTimeout(greetingTimer);
  character.classList.remove("greeting");
}
function reset() {
  clearTimers();
  currentTask = null;
  stage.dataset.state = "idle";
  label.textContent = "等待你的任务";
  speech.textContent = initialSpeech;
  deliveryLabel.textContent = "给它方向，它会带着结果回来。";
  title.textContent = "想法不用排队，现在就能开始。";
  detail.textContent =
    "点上面任意一项，体验从交办到交付。这里使用预设示例，不执行真实任务。";
  tags.replaceChildren();
  taskButtons.forEach((button) => button.setAttribute("aria-pressed", "false"));
}
function runTask(key) {
  clearTimers();
  currentTask = key;
  const task = tasks[key];
  stage.dataset.state = "working";
  label.textContent = "示例任务进行中";
  speech.textContent = task.reply;
  deliveryLabel.textContent = "Bibo 接住了你的任务";
  title.textContent = task.working;
  detail.textContent = "先理解你的背景，再整理成可以使用的结果。";
  tags.replaceChildren();
  taskButtons.forEach((button) =>
    button.setAttribute("aria-pressed", String(button.dataset.task === key)),
  );
  completionTimer = setTimeout(
    () => {
      stage.dataset.state = "done";
      label.textContent = "示例结果已就绪";
      speech.textContent = "好了。重点在这里，你来决定下一步。";
      deliveryLabel.textContent = "✓ 已整理 · 示例结果";
      title.textContent = task.title;
      detail.textContent = task.detail;
      task.tags.forEach((text) => {
        const tag = document.createElement("span");
        tag.className = "result-tag";
        tag.textContent = text;
        tags.append(tag);
      });
    },
    reducedMotion.matches ? 0 : 1500,
  );
}
taskButtons.forEach((button) =>
  button.addEventListener("click", () => runTask(button.dataset.task)),
);
document.querySelector("#reset").addEventListener("click", reset);
character.addEventListener("click", () => {
  clearTimeout(greetingTimer);
  character.classList.remove("greeting");
  character.classList.add("greeting");
  speech.textContent =
    stage.dataset.state === "working"
      ? "在呢，正忙着把你的事办好。"
      : "收到你的招呼。现在，给我一件正事？";
  greetingTimer = setTimeout(() => {
    character.classList.remove("greeting");
    speech.textContent =
      stage.dataset.state === "done"
        ? "好了。重点在这里，你来决定下一步。"
        : currentTask
          ? tasks[currentTask].reply
          : initialSpeech;
  }, 1800);
});
stage.addEventListener("pointermove", (event) => {
  if (reducedMotion.matches || event.pointerType !== "mouse") return;
  const rect = character.getBoundingClientRect();
  const x = Math.max(
    -5,
    Math.min(5, (event.clientX - rect.left - rect.width / 2) / 35),
  );
  const y = Math.max(
    -3,
    Math.min(3, (event.clientY - rect.top - rect.height / 2) / 45),
  );
  character.style.setProperty("--look-x", x + "px");
  character.style.setProperty("--look-y", y + "px");
});
stage.addEventListener("pointerleave", () => {
  character.style.setProperty("--look-x", "0px");
  character.style.setProperty("--look-y", "0px");
});
reset();
