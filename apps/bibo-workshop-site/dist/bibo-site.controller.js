const desk = document.querySelector("#desk");
const thoughts = document.querySelector(".thoughts");
const cards = [...document.querySelectorAll("[data-thought]")];
const organized = document.querySelector("#organized");
const resultList = document.querySelector("#result-list");
const organize = document.querySelector("#organize");
const count = document.querySelector("#selection-count");
const help = document.querySelector("#selection-help");
const speech = document.querySelector("#speech");
const character = document.querySelector("#greet");
const step = document.querySelector(".desk-top > span");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const selected = new Set(["research", "weekend"]);
const results = {
  research: {
    kind: "先查清楚",
    title: "先比较，别急着选。",
    detail:
      "从价格、上手成本、协作方式三项对比竞品。下一步：你提供三个产品名，Bibo 才能开始实际研究。",
  },
  weekend: {
    kind: "需要你决定",
    title: "先留白，再安排。",
    detail:
      "把周末留给散步和咖啡，不排满行程。下一步：告诉 Bibo 出发城市和预算，再准备具体选择。",
  },
  follow: {
    kind: "持续关注",
    title: "重要变化再来找你。",
    detail:
      "只关注影响本次发布的变化，略过不相关更新。下一步：先确定关注对象、截止日期和提醒方式。",
  },
  learn: {
    kind: "现在就能做",
    title: "今天只拍一束光。",
    detail:
      "找一扇窗，从三个角度拍同一件物品，选出最喜欢的一张。下一步：从这个十分钟的小练习开始。",
  },
};
let timer;
let greetTimer;
function updateSelection() {
  count.textContent = "已选 " + selected.size + " 个念头";
  help.textContent = selected.size
    ? "点纸片增减。杂一点，也没关系。"
    : "先选一个念头，再交给 Bibo。";
  organize.disabled = selected.size === 0;
  cards.forEach((card) => {
    const isSelected = selected.has(card.dataset.thought);
    card.setAttribute("aria-pressed", String(isSelected));
    card.querySelector("i").textContent = isSelected ? "✓" : "+";
  });
}
function reopen() {
  clearTimeout(timer);
  clearTimeout(greetTimer);
  desk.dataset.phase = "scattered";
  thoughts.hidden = false;
  organized.hidden = true;
  cards.forEach((card) => (card.disabled = false));
  organize.hidden = false;
  organize.innerHTML = 'Bibo，帮我理一理 <span aria-hidden="true">↗</span>';
  step.textContent = "01 — 给点方向";
  speech.textContent = "不用先想清楚。我们可以一起理。";
  updateSelection();
  organize.focus({ preventScroll: true });
}
function deliver() {
  resultList.replaceChildren();
  for (const key of selected) {
    const result = results[key];
    const row = document.createElement("article");
    row.className = "result-row";
    const kind = document.createElement("span");
    kind.className = "result-kind";
    kind.textContent = result.kind;
    const content = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = result.title;
    const detail = document.createElement("p");
    detail.textContent = result.detail;
    content.append(title, detail);
    row.append(kind, content);
    resultList.append(row);
  }
  thoughts.hidden = true;
  organized.hidden = false;
  desk.dataset.phase = "organized";
  organize.hidden = true;
  step.textContent = "03 — 下一步，清楚了";
  count.textContent = selected.size + " 个念头，都有了下一步";
  help.textContent = "想改主意？随时重新摊开。";
  speech.textContent = "能先做的先做，需要你决定的，我会问。";
  document.querySelector("#reopen").focus({ preventScroll: true });
}
cards.forEach((card) =>
  card.addEventListener("click", () => {
    const key = card.dataset.thought;
    if (selected.has(key)) selected.delete(key);
    else selected.add(key);
    updateSelection();
  }),
);
organize.addEventListener("click", () => {
  if (!selected.size || desk.dataset.phase !== "scattered") return;
  clearTimeout(greetTimer);
  desk.dataset.phase = "gathering";
  cards.forEach((card) => (card.disabled = true));
  organize.disabled = true;
  organize.textContent = "接住了，正在理清…";
  step.textContent = "02 — 把线索理出来";
  speech.textContent = "先找下一步，再分清什么值得一直惦记。";
  timer = setTimeout(deliver, reducedMotion.matches ? 0 : 1200);
});
document.querySelector("#reopen").addEventListener("click", reopen);
character.addEventListener("click", () => {
  clearTimeout(greetTimer);
  character.classList.remove("greet");
  character.classList.add("greet");
  speech.textContent =
    desk.dataset.phase === "gathering"
      ? "在呢，正帮你把这些事理顺。"
      : "我是 Bibo。你负责有想法，我帮你往前走。";
  greetTimer = setTimeout(() => {
    character.classList.remove("greet");
    speech.textContent =
      desk.dataset.phase === "organized"
        ? "能先做的先做，需要你决定的，我会问。"
        : "不用先想清楚。我们可以一起理。";
  }, 2000);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && desk.dataset.phase !== "scattered") {
    reopen();
    organize.focus({ preventScroll: true });
  }
});
updateSelection();
