const translations = [...document.querySelectorAll("[data-zh]")].map(
  (element) => ({ element, en: element.innerHTML, zh: element.dataset.zh }),
);
const scenarios = {
  work: {
    en: {
      prompt:
        "Keep an eye on these three competitors. Tell me what actually matters for our launch.",
      replies: [
        "I'll compare what's changed against your launch priorities. A short brief, not another reading list.",
        "I'm checking the changes and bringing the relevant details together. You can get back to your day.",
        "Here’s the part worth your attention. I’ve separated useful changes from the noise.",
      ],
      context:
        "With your context: a small team, a focused launch, no enterprise features.",
      tasks: [
        "Review product updates",
        "Compare changes with your launch priorities",
        "Prepare a brief with source links",
      ],
      title: "Your launch radar",
      kicker: "EXAMPLE BRIEF",
      description: "Three updates reviewed. One worth a closer look.",
      bullets: [
        "A simpler onboarding flow to learn from",
        "Two updates outside your current scope",
        "A short list of questions for your next review",
      ],
    },
    zh: {
      prompt: "帮我关注这三个竞品。只告诉我真正影响这次发布的变化。",
      replies: [
        "我会结合你的发布重点比较变化。给你一份简报，不再添一堆阅读任务。",
        "我在核对变化，整理与你相关的细节。你可以先去忙自己的事。",
        "这些值得你关注。我把有用的变化和暂时不相关的内容分开了。",
      ],
      context: "结合你的背景：小团队、聚焦首发、暂不做企业功能。",
      tasks: ["阅读产品更新", "对照你的发布重点", "整理附来源的简报"],
      title: "这周的发布观察",
      kicker: "示例简报",
      description: "看过三项更新，有一项值得深入了解。",
      bullets: [
        "一个值得参考的简化引导流程",
        "两项不属于本次范围的更新",
        "下次评审值得讨论的几个问题",
      ],
    },
  },
  life: {
    en: {
      prompt:
        "Help me find a quiet weekend escape. Somewhere close, with good coffee and no packed itinerary.",
      replies: [
        "A change of scenery, at your pace. I’ll look for a few places that leave room for doing nothing.",
        "I’m comparing easy trips, quieter neighborhoods, and somewhere good to stop for coffee.",
        "Three possibilities, with plenty of breathing room. Nothing booked — the choice is yours.",
      ],
      context:
        "With your preferences: quieter places, short journeys, unhurried mornings.",
      tasks: [
        "Shortlist easy weekend destinations",
        "Compare travel time and atmosphere",
        "Put together three relaxed options",
      ],
      title: "A slower kind of weekend",
      kicker: "EXAMPLE SHORTLIST",
      description: "A few directions to explore. No reservations made.",
      bullets: [
        "A small coastal town and a long walk",
        "A hillside stay with a café nearby",
        "A familiar city, seen at a different pace",
      ],
    },
    zh: {
      prompt: "找个安静的地方过周末吧。近一点，有好喝的咖啡，不要排太满。",
      replies: [
        "换个风景，按你的节奏来。我会找几个适合慢下来、什么都不做的地方。",
        "我在比较路程、安静程度，还有附近适合喝咖啡的地方。",
        "整理了三个方向，给你留了足够的空白。还没有预订，选择权在你。",
      ],
      context: "记得你的偏好：安静、路程短、早上不赶时间。",
      tasks: ["筛选适合短途的目的地", "比较路程和环境", "整理三个轻松的选择"],
      title: "把周末，过慢一点",
      kicker: "示例清单",
      description: "几个可以继续探索的方向，没有进行预订。",
      bullets: [
        "海边小镇，留出一段散步时间",
        "山边住一晚，附近就有咖啡馆",
        "熟悉的城市，换一种不赶路的节奏",
      ],
    },
  },
  learn: {
    en: {
      prompt:
        "I want to get back into photography. Can we make a little progress each week?",
      replies: [
        "Let’s make it enjoyable enough to keep going. One small idea and one thing to try, each week.",
        "I’m shaping a first week around the camera you already have and the time you want to spend.",
        "Start here: notice the light. One small practice, with room to explore. We can adjust it together.",
      ],
      context:
        "With your pace: twenty minutes, once a week. No new gear needed.",
      tasks: [
        "Start with your existing camera",
        "Choose one useful idea",
        "Turn it into a twenty-minute practice",
      ],
      title: "Week one: follow the light",
      kicker: "EXAMPLE PRACTICE",
      description: "A small step back into something you enjoy.",
      bullets: [
        "Find one window with natural light",
        "Photograph the same object from three angles",
        "Choose a favorite and notice what changed",
      ],
    },
    zh: {
      prompt: "我想重新开始学摄影。每周一点点，能陪我慢慢来吗？",
      replies: [
        "让它轻松到愿意坚持吧。每周一个小想法，再加一件可以动手试的事。",
        "我在按你现有的相机和愿意投入的时间，整理第一周的小练习。",
        "先从观察光线开始。一件小练习，留些探索空间，我们可以边做边调整。",
      ],
      context: "按你的节奏：每周一次、二十分钟，不用买新设备。",
      tasks: [
        "从你已有的相机开始",
        "选一个实用的小概念",
        "变成二十分钟就能开始的练习",
      ],
      title: "第一周：跟着光线走",
      kicker: "示例练习",
      description: "用一个小小的开始，找回喜欢的事。",
      bullets: [
        "找一扇有自然光的窗户",
        "从三个角度拍同一个物品",
        "选出最喜欢的一张，看看哪里不同",
      ],
    },
  },
};
let language = "en";
try {
  language = localStorage.getItem("bibo-language") === "zh" ? "zh" : "en";
} catch {
  /* Preferences are optional in private browsing. */
}
let scenario = "work";
let step = 0;
const tabs = [...document.querySelectorAll("[data-scenario]")];
const result = document.querySelector("#demo-result");
const menu = document.querySelector("#menu");
const navigation = document.querySelector("#navigation");

function renderScenario() {
  const content = scenarios[scenario][language];
  document.querySelector("#demo-prompt").textContent = content.prompt;
  document.querySelector("#demo-response").textContent = content.replies[step];
  result.replaceChildren();
  if (step === 0) {
    const note = document.createElement("p");
    note.className = "context-note";
    note.textContent = content.context;
    result.append(note);
  } else if (step === 1) {
    const list = document.createElement("div");
    list.className = "task-lines";
    content.tasks.forEach((task) => {
      const row = document.createElement("div");
      row.className = "task-line";
      const check = document.createElement("span");
      check.textContent = "✓";
      check.setAttribute("aria-hidden", "true");
      const text = document.createElement("span");
      text.textContent = task;
      row.append(check, text);
      list.append(row);
    });
    result.append(list);
  } else {
    const card = document.createElement("article");
    card.className = "result-card";
    const kicker = document.createElement("span");
    kicker.className = "result-kicker";
    kicker.textContent = content.kicker;
    const title = document.createElement("h4");
    title.textContent = content.title;
    const description = document.createElement("p");
    description.textContent = content.description;
    const list = document.createElement("ul");
    content.bullets.forEach((bullet) => {
      const item = document.createElement("li");
      item.textContent = bullet;
      list.append(item);
    });
    card.append(kicker, title, description, list);
    result.append(card);
  }
  const labels =
    language === "zh"
      ? ["看看 Bibo 怎么做", "看看整理的结果", "再看一次"]
      : ["See Bibo at work", "See the result", "Start again"];
  document.querySelector("#next-label").textContent = labels[step];
  document
    .querySelectorAll(".step-indicator span")
    .forEach((dot, index) => dot.classList.toggle("active", index === step));
  document
    .querySelector(".step-indicator")
    .setAttribute(
      "aria-label",
      language === "zh"
        ? `第 ${step + 1} 步，共 3 步`
        : `Step ${step + 1} of 3`,
    );
}

function selectScenario(tab) {
  scenario = tab.dataset.scenario;
  step = 0;
  tabs.forEach((item) => {
    item.setAttribute("aria-selected", String(item === tab));
    item.tabIndex = item === tab ? 0 : -1;
  });
  document
    .querySelector("#scenario-panel")
    .setAttribute("aria-labelledby", tab.id);
  renderScenario();
}

function closeMenu(returnFocus = false) {
  navigation.classList.remove("open");
  menu.setAttribute("aria-expanded", "false");
  menu.setAttribute(
    "aria-label",
    language === "zh" ? "打开导航" : "Open navigation",
  );
  if (returnFocus) menu.focus();
}

function renderLanguage() {
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  translations.forEach(({ element, en, zh }) => {
    element.innerHTML = language === "zh" ? zh : en;
  });
  const languageButton = document.querySelector("#language");
  languageButton.textContent = language === "zh" ? "EN" : "中文";
  languageButton.setAttribute(
    "aria-label",
    language === "zh" ? "Switch to English" : "切换为中文",
  );
  document.title =
    language === "zh"
      ? "Bibo — 你的想法，交给好搭档。"
      : "Bibo — Your ideas. In good hands.";
  closeMenu();
  renderScenario();
}

tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => selectScenario(tab));
  tab.addEventListener("keydown", (event) => {
    const directions = {
      ArrowRight: 1,
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1,
    };
    let next;
    if (event.key in directions)
      next = (index + directions[event.key] + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    tabs[next].focus();
    selectScenario(tabs[next]);
  });
});
document.querySelector("#demo-next").addEventListener("click", () => {
  step = (step + 1) % 3;
  renderScenario();
});
document.querySelector("#language").addEventListener("click", () => {
  language = language === "en" ? "zh" : "en";
  try {
    localStorage.setItem("bibo-language", language);
  } catch {
    /* The page still works without saved preferences. */
  }
  renderLanguage();
});
menu.addEventListener("click", () => {
  const open = menu.getAttribute("aria-expanded") !== "true";
  menu.setAttribute("aria-expanded", String(open));
  menu.setAttribute(
    "aria-label",
    language === "zh"
      ? open
        ? "关闭导航"
        : "打开导航"
      : open
        ? "Close navigation"
        : "Open navigation",
  );
  navigation.classList.toggle("open", open);
});
navigation
  .querySelectorAll("a")
  .forEach((link) => link.addEventListener("click", () => closeMenu()));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && menu.getAttribute("aria-expanded") === "true")
    closeMenu(true);
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".site-header")) closeMenu();
});
renderLanguage();
