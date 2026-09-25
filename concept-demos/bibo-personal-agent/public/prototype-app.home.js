export function createHomePreparer({
  variant,
  home,
  navLinks,
  link,
  views,
  viewHref,
}) {
  function prepareHome() {
    if (variant === "inbox") {
      const nav = home.querySelector(".nav");
      nav.innerHTML = `<div class="brand">bibo<i>.</i></div><small>个人空间</small>${navLinks("overview")}<div class="bottom">✳ 同一个 Bibo，持续了解你。</div>`;
      home.querySelector(".list-head h1").textContent = "最近来信";
      home.querySelector(".list-head .sub").textContent = "三件值得你回应的事";
      home.querySelector(".filters").remove();
      home.querySelectorAll(".mail")[3].remove();
      const overview = document.createElement("main");
      overview.className = "inbox-overview";
      overview.innerHTML = `<div class="overview-eyebrow">FRIDAY / YOUR SPACE</div><h1>今天值得留意的事。</h1><p class="overview-intro">三封来信里，两封和正在推进的项目有关。Bibo 已经帮你找出关联，具体处理留在各自的页面。</p><div class="overview-large">${link("chat", "<span>✳ Bibo 带回的观察</span><strong>先确认网站文案，再决定评审时间。</strong><small>进入对话，看看它为什么这样建议</small>")}</div><div class="overview-cards">${link("calendar", "<small>◷ 日程</small><strong>14:00–15:00 有空档</strong><span>评审时间尚未确认</span>")}${link("tasks", "<small>✓ 待办</small><strong>网站上线前还剩三步</strong><span>确认文案 · 回复评审 · 检查清单</span>")}${link("notes", "<small>▤ 笔记</small><strong>网站做完以后</strong><span>先上线，再整理作品集线索</span>")}</div>`;
      home.querySelector(".side").before(overview);
      home.querySelector(".side").innerHTML =
        `<div class="bibo"><span class="mark">✳</span>Bibo 的观察</div><h3>需要你决定的，只有两件。</h3><p>先看文案差异，再决定是否接受 14:30 的评审。其他消息今天可以稍后处理。</p><div class="evidence">你的空间</div>${views
          .slice(1)
          .map(([id, label, icon]) =>
            link(id, `${icon} ${label}`, "overview-side-link"),
          )
          .join("")}<div class="demo">概念演示 · 虚构个人信息</div>`;
      home.querySelectorAll(".mail").forEach((mail, index) => {
        const key = ["lin", "chen", "zhe"][index];
        if (!key) return;
        const anchor = document.createElement("a");
        anchor.className = mail.className;
        anchor.href = viewHref("inbox");
        anchor.dataset.mail = key;
        anchor.innerHTML = mail.innerHTML;
        mail.replaceWith(anchor);
      });
    } else if (variant === "day") {
      home
        .querySelector(".timeline")
        .insertBefore(
          home.querySelector(".event.suggestion"),
          home.querySelector(".event.active"),
        );
      home.querySelector(".rail").innerHTML =
        `<div class="logo">b.</div>${navLinks("overview")}`;
      home.querySelector(".top button").remove();
      home.querySelector("#time-button").outerHTML = link(
        "calendar",
        "显示完整日程 →",
        "day-section-link",
      );
      home.querySelector("#task-button").outerHTML = link(
        "tasks",
        "全部待办 →",
        "day-section-link",
      );
      home
        .querySelector(".top")
        .insertAdjacentHTML(
          "beforeend",
          link("chat", "✳ 继续和 Bibo 对话", "day-chat-entry"),
        );
      home.querySelectorAll(".task").forEach((button) => {
        const summary = document.createElement("div");
        summary.className = "task";
        summary.innerHTML = button.innerHTML;
        button.replaceWith(summary);
      });
      home.querySelector(".tasks").after(buildHomeStrip());
      home.querySelector(".aside").innerHTML =
        `<div class="tiny">YOUR SPACE</div><h2>时间之外，<br>还有你的节奏。</h2><p>这里是一天的概览。邮件、待办和笔记都能从各自完整页面继续处理。</p><div class="bibo"><div class="avatar">✳</div><strong>来自 Bibo 的观察</strong><p>林悦的消息可能改变下午安排。你有空档，但还没有答应。</p>${link("chat", "进入对话，看看建议 ↗", "day-chat-entry")}</div><div class="mini"><strong>收件箱</strong><p>3 件值得回应</p></div><div class="mini"><strong>最近笔记</strong><p>网站做完以后，可以成为作品集线索。</p></div><div class="demo">概念演示 · 虚构个人信息</div>`;
      home.querySelectorAll(".event").forEach((event) => {
        const target = event.classList.contains("active")
          ? "inbox"
          : "calendar";
        event.classList.add("home-linked");
        event.setAttribute("data-view", target);
        event.setAttribute("tabindex", "0");
        event.setAttribute("role", "link");
      });
    } else if (variant === "brief") {
      home.querySelector(".top nav").innerHTML = navLinks("overview");
      home.querySelector(".ask")?.remove();
      home.querySelectorAll(".side-item").forEach((item, index) => {
        item.innerHTML = link(
          ["inbox", "calendar", "tasks", "notes"][index],
          item.innerHTML,
          "brief-summary-link",
        );
      });
      const summaryCounts = ["3", "4", "4", "3"];
      home.querySelectorAll(".side-item span").forEach((count, index) => {
        count.textContent = summaryCounts[index];
      });
      home.querySelectorAll("[data-source]").forEach((button) => {
        const target = button.textContent.includes("日历")
          ? "calendar"
          : button.textContent.includes("笔记")
            ? "notes"
            : button.textContent.includes("待办")
              ? "tasks"
              : "inbox";
        const sourceLink = document.createElement("a");
        sourceLink.className = button.className;
        sourceLink.href = viewHref(target);
        sourceLink.dataset.view = target;
        sourceLink.textContent = button.textContent;
        button.replaceWith(sourceLink);
      });
      home.querySelector(".side .note").after(
        Object.assign(document.createElement("div"), {
          className: "brief-chat-entry",
          innerHTML: link("chat", "✳ 和 Bibo 继续讨论今天的事 ↗"),
        }),
      );
    } else {
      home.querySelector(".top nav").innerHTML = navLinks("overview");
      home.querySelectorAll(".todo button").forEach((button) => {
        const box = document.createElement("span");
        box.className = "todo-static-box";
        button.replaceWith(box);
      });
      const map = [
        [".card.inbox", "inbox"],
        [".card.calendar", "calendar"],
        [".card.note", "notes"],
        [".card.project", "project"],
        [".card.todos", "tasks"],
      ];
      for (const [selector, target] of map) {
        const card = home.querySelector(selector);
        const anchor = document.createElement("a");
        anchor.href = viewHref(target);
        anchor.dataset.view = target;
        anchor.className = "desk-card-link";
        while (card.firstChild) anchor.append(card.firstChild);
        card.append(anchor);
      }
      home.querySelector(".right-content .status")?.remove();
      home.querySelector("#talk")?.remove();
      home
        .querySelector(".right-content")
        .insertAdjacentHTML(
          "beforeend",
          link("chat", "继续上次对话", "desk-chat-entry"),
        );
    }
  }

  function buildHomeStrip() {
    const strip = document.createElement("section");
    strip.className = "day-home-strip";
    strip.innerHTML = `${link("inbox", "<small>✉ 收件箱</small><strong>3 件值得回应</strong><span>林悦在等评审时间</span>")}${link("notes", "<small>▤ 笔记</small><strong>网站做完以后</strong><span>作品集的第一条线索</span>")}`;
    return strip;
  }

  return prepareHome;
}
