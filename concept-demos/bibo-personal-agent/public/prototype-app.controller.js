import { createPageRenderers } from "./prototype-app.pages.js";
import { createHomePreparer } from "./prototype-app.home.js";

const variant = location.pathname.split("/").pop()?.replace(".html", "");

if (["inbox", "day", "brief", "desk"].includes(variant)) {
  document.body.classList.add(`variant-${variant}`);
  const views = [
    ["overview", "概览", "▦"],
    ["chat", "对话", "✳"],
    ["inbox", "收件箱", "✉"],
    ["calendar", "日程", "◷"],
    ["tasks", "待办", "✓"],
    ["notes", "笔记", "▤"],
  ];
  const home = document.querySelector(
    { inbox: ".app", day: ".shell", brief: ".page", desk: ".wall" }[variant],
  );
  const state = {
    selectedMail: "lin",
    selectedNote: "portfolio",
    calendarMode: "day",
    selectedEvent: "review",
    acceptedTime: false,
    calendarCreating: false,
    customEvents: [],
    nextEventId: 1,
    done: new Set(),
    addedTasks: [],
    nextTaskId: 1,
    processedMail: new Set(),
    mailFilter: "pending",
    conversation: "launch",
    noteContents: {
      portfolio:
        "这个项目也许能成为作品集的第一篇。先上线，再挑一个值得讲的片段。",
      review: "评审结束当天，尽量形成清楚的结论和下一步。",
      ideas: "这周先把网站上线。新的想法放在这里，稍后再判断是否推进。",
    },
    nextNoteId: 1,
    chatReference: null,
    chatReturn: null,
    chatPanel: "mail",
    chatPanelOpen: true,
    chatDraft: "可以，14:30 开始怎么样？我会提前看一遍方案。",
    messages: [],
  };
  const mails = {
    lin: {
      from: "林悦",
      time: "09:42",
      title: "周五的方案评审，能提前到下午吗？",
      text: "嗨，原定周五晚上的方案评审，能否提前到下午？我看你 15:00 前有一段空档。如果可以，我来更新邀请。",
      context: "日程中 14:00–15:00 有空档；17:30 后是你留给自己的时间。",
    },
    chen: {
      from: "陈一",
      time: "08:18",
      title: "网站上线前，请确认这两处文案",
      text: "两处文案需要你最终确认。我已在文档里标出差异，今天确认的话还能赶上周五上线。",
      context: "这封邮件关联网站上线项目和“确认文案”待办。",
    },
    zhe: {
      from: "阿哲",
      time: "昨天",
      title: "周末聚餐人数确认",
      text: "周末聚餐先定在六点。你和小乔能来吗？我今晚定位置。",
      context: "这需要你自己决定；Bibo 暂不代答复。",
    },
  };
  const notes = {
    portfolio: { title: "网站做完以后", meta: "作品集 · 星期三整理" },
    review: { title: "上次评审的原则", meta: "项目方法 · 上周整理" },
    ideas: { title: "这周的产品想法", meta: "未归档 · 昨天记录" },
  };
  const escapeHtml = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  const viewHref = (view) =>
    view === "overview"
      ? location.pathname
      : `${location.pathname}?view=${view}`;
  const link = (view, label, className = "") =>
    `<a class="${className}" href="${viewHref(view)}" data-view="${view}">${label}</a>`;
  const navLinks = (current) =>
    views
      .map(
        ([id, label, icon]) =>
          `<a class="${id === current ? "selected" : ""}" href="${viewHref(id)}" data-view="${id}" aria-label="${label}" title="${label}"><span class="nav-symbol">${icon}</span><span class="nav-label">${label}</span></a>`,
      )
      .join("");
  const getView = () =>
    new URL(location.href).searchParams.get("view") || "overview";

  const prepareHome = createHomePreparer({
    variant,
    home,
    navLinks,
    link,
    views,
    viewHref,
  });

  function moduleShell(view, content) {
    const title =
      view === "project"
        ? "网站上线"
        : views.find(([id]) => id === view)?.[1] || "概览";
    return `<div class="concept-shell"><aside class="concept-nav"><div class="concept-brand">bibo<span>.</span></div><nav aria-label="主要导航">${navLinks(view)}</nav><div class="concept-nav-foot">界面概念演示<br>虚构示例数据</div></aside><main class="concept-main"><h1 class="sr-only">${title}</h1><div class="concept-content">${content}</div></main></div>`;
  }

  const pageRenderers = createPageRenderers({
    state,
    mails,
    notes,
    link,
    escapeHtml,
  });

  function render() {
    const requestedView = getView();
    const view =
      requestedView === "overview" || pageRenderers[requestedView]
        ? requestedView
        : "overview";
    document.querySelector(".concept-shell")?.remove();
    home.hidden = view !== "overview";
    if (view === "overview") {
      updateHome();
      return;
    }
    const root = document.createElement("div");
    root.innerHTML = moduleShell(view, pageRenderers[view]());
    document.body.append(root.firstElementChild);
    window.scrollTo(0, 0);
  }

  function updateHome() {
    const pending = 3 - state.processedMail.size;
    if (variant === "inbox") {
      home.querySelector(".list-head .sub").textContent =
        `${pending} 件仍待回应`;
      home.querySelectorAll(".mail[data-mail]").forEach((mail) => {
        const tag = mail.querySelector(".tag");
        const labels = {
          lin: "需要决定 · 涉及日程",
          chen: "需要处理 · 项目上线",
          zhe: "需要你决定",
        };
        if (tag)
          tag.textContent = state.processedMail.has(mail.dataset.mail)
            ? "已处理"
            : labels[mail.dataset.mail];
      });
    }
    if (variant === "day") {
      const summary = home.querySelector(".aside .mini p");
      if (summary) summary.textContent = `${pending} 件值得回应`;
    }
    if (variant === "brief") {
      const count = home.querySelector(".side-item span");
      if (count) count.textContent = pending;
    }
    if (variant === "desk") {
      const badge = home.querySelector(".card.inbox .count");
      if (badge) badge.textContent = `${pending} 件待回应`;
      const project = home.querySelector(".card.project .step.active strong");
      if (project && state.done.has("copy")) project.textContent = "✓ 文案确认";
    }
  }

  function navigate(view) {
    const target = viewHref(view);
    history.pushState({ view }, "", target);
    render();
  }

  document.addEventListener("click", (event) => {
    const anchor = event.target.closest("a[data-view]");
    if (
      anchor &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey
    ) {
      event.preventDefault();
      const view = anchor.dataset.view;
      if (view === "chat" && getView() !== "overview") {
        state.chatReturn = getView();
        state.chatPanel =
          {
            inbox: "mail",
            calendar: "calendar",
            tasks: "tasks",
            notes: "note",
            project: "tasks",
          }[state.chatReturn] || state.chatPanel;
        state.chatPanelOpen = true;
        const context = {
          inbox: mails[state.selectedMail].title,
          calendar: "9 月 25 日的时间安排",
          tasks: "网站上线待办",
          notes: notes[state.selectedNote].title,
        };
        state.chatReference = {
          title: context[state.chatReturn] || "今天的概览",
        };
      }
      navigate(view);
      return;
    }
    const homeLink = event.target.closest(".home-linked");
    if (homeLink) {
      navigate(homeLink.dataset.view);
      return;
    }
    const mail = event.target.closest("[data-mail]");
    if (mail) {
      event.preventDefault();
      state.selectedMail = mail.dataset.mail;
      state.mailFilter = state.processedMail.has(state.selectedMail)
        ? "done"
        : state.selectedMail === "zhe"
          ? "later"
          : "pending";
      navigate("inbox");
      return;
    }
    const filter = event.target.closest("[data-mail-filter]");
    if (filter) {
      state.mailFilter = filter.dataset.mailFilter;
      state.selectedMail =
        state.mailFilter === "later"
          ? "zhe"
          : state.mailFilter === "done"
            ? [...state.processedMail][0] || "lin"
            : "lin";
      render();
      return;
    }
    const conversation = event.target.closest("[data-conversation]");
    if (conversation) {
      state.conversation = conversation.dataset.conversation;
      state.messages = [];
      state.chatReference = null;
      state.chatPanel = state.conversation === "portfolio" ? "note" : "mail";
      state.chatPanelOpen =
        state.conversation === "launch" || state.conversation === "portfolio";
      if (state.conversation === "portfolio") state.selectedNote = "portfolio";
      render();
      return;
    }
    const chatPanel = event.target.closest("[data-chat-panel]");
    if (chatPanel) {
      if (chatPanel.dataset.chatMail)
        state.selectedMail = chatPanel.dataset.chatMail;
      state.chatPanel = chatPanel.dataset.chatPanel;
      state.chatPanelOpen = true;
      render();
      return;
    }
    if (event.target.closest("[data-toggle-chat-panel]")) {
      state.chatPanelOpen = !state.chatPanelOpen;
      render();
      return;
    }
    if (event.target.closest("#save-chat-draft")) {
      state.chatDraft = document.querySelector("#chat-draft-text").value;
      document.querySelector("#chat-draft-status").textContent =
        "已在本次演示中保存";
      return;
    }
    const note = event.target.closest("[data-note]");
    if (note) {
      state.selectedNote = note.dataset.note;
      render();
      return;
    }
    const mode = event.target.closest("[data-calendar-mode]");
    if (mode) {
      state.calendarMode = mode.dataset.calendarMode;
      render();
      return;
    }
    const calendarEvent = event.target.closest("[data-event]");
    if (calendarEvent) {
      state.selectedEvent = calendarEvent.dataset.event;
      state.calendarCreating = false;
      render();
      return;
    }
    if (event.target.closest("#new-event")) {
      state.calendarCreating = true;
      render();
      document.querySelector("#event-title").focus();
      return;
    }
    if (event.target.closest("#cancel-event")) {
      state.calendarCreating = false;
      render();
      return;
    }
    if (event.target.closest("#reply-draft")) {
      document.querySelector("#draft-area").hidden = false;
      return;
    }
    if (event.target.closest("#mark-processed")) {
      const key = event.target.closest("#mark-processed").dataset.selectedMail;
      if (state.processedMail.has(key)) {
        state.processedMail.delete(key);
        state.mailFilter = key === "zhe" ? "later" : "pending";
      } else {
        state.processedMail.add(key);
        state.mailFilter = "done";
      }
      state.selectedMail = key;
      render();
      return;
    }
    if (event.target.closest("#accept-time")) {
      state.acceptedTime = true;
      render();
      return;
    }
    if (event.target.closest("#save-note")) {
      saveNote();
      render();
      document.querySelector("#note-status").textContent = "已在本次演示中保存";
      return;
    }
    if (event.target.closest("#discuss-note")) {
      saveNote();
      state.chatReference = { title: notes[state.selectedNote].title };
      state.chatReturn = "notes";
      state.chatPanel = "note";
      state.chatPanelOpen = true;
      navigate("chat");
      return;
    }
    if (event.target.closest("#new-note")) {
      const id = `new-${state.nextNoteId++}`;
      notes[id] = { title: "无标题笔记", meta: "新建 · 今天" };
      state.noteContents[id] = "";
      state.selectedNote = id;
      render();
      document.querySelector("#note-title").focus();
      return;
    }
    if (event.target.closest("#new-conversation")) {
      state.conversation = "new";
      state.messages = [];
      state.chatReference = null;
      state.chatPanelOpen = false;
      render();
      return;
    }
  });
  document.addEventListener("change", (event) => {
    if (event.target.matches("[data-task]")) {
      event.target.checked
        ? state.done.add(event.target.dataset.task)
        : state.done.delete(event.target.dataset.task);
      render();
    }
  });
  document.addEventListener("submit", (event) => {
    if (event.target.matches("#event-add-form")) {
      event.preventDefault();
      const title = event.target.querySelector("#event-title").value.trim();
      const time = event.target.querySelector("#event-time").value;
      const [hour, minute] = time.split(":").map(Number);
      if (title && hour >= 8 && hour <= 19) {
        const id = `custom-${state.nextEventId++}`;
        state.customEvents.push({
          id,
          time,
          duration: "30 分钟",
          title,
          status: "本次演示已安排",
          kind: "scheduled",
          top: (hour - 8) * 56 + (minute / 60) * 56,
          height: 42,
          detail: "你在当前概念演示中添加的安排。",
        });
        state.selectedEvent = id;
        state.calendarMode = "day";
        state.calendarCreating = false;
        render();
      }
      return;
    }
    if (event.target.matches("#task-add-form")) {
      event.preventDefault();
      const title = event.target.querySelector("input").value.trim();
      if (title) {
        state.addedTasks.push([
          `added-${state.nextTaskId++}`,
          title,
          "个人待办 · 今天",
        ]);
        render();
      }
      return;
    }
    if (!event.target.matches("#conversation-form")) return;
    event.preventDefault();
    const input = event.target.querySelector("textarea");
    const text = input.value.trim();
    if (!text) return;
    const flow = document.querySelector("#message-flow");
    const reply = /文案|网站|上线/.test(text)
      ? "我们先看两处待确认文案。陈一的邮件和上线待办指向同一件事；确认后，我可以帮你整理回复的要点。"
      : /评审|日程|时间/.test(text)
        ? "林悦提议把评审提前。日程显示 14:00–15:00 有空档，但邀请还没确认。你可以先留 15 分钟准备，再决定如何回复。"
        : /笔记|作品集/.test(text)
          ? "你在《网站做完以后》里写过：先上线，再挑值得讲的片段。可以等项目收尾后，从一次关键决定开始整理。"
          : "我会先把你提到的事和当前日程、消息、待办及笔记放在一起，再和你确认下一步。这是一段预设演示对话。";
    for (const [role, message] of [
      ["from-user", text],
      ["from-bibo", reply],
    ]) {
      state.messages.push([role, message]);
      const bubble = document.createElement("div");
      bubble.className = `message ${role}`;
      bubble.textContent = message;
      flow.append(bubble);
    }
    input.value = "";
    flow.scrollTop = flow.scrollHeight;
    input.focus();
  });
  document.addEventListener("input", (event) => {
    if (event.target.matches("#chat-draft-text")) {
      state.chatDraft = event.target.value;
      return;
    }
    if (!event.target.matches("#note-search")) return;
    const query = event.target.value.trim();
    document.querySelectorAll(".notes-list [data-note]").forEach((item) => {
      item.hidden = !item.textContent.includes(query);
    });
  });
  document.addEventListener("keydown", (event) => {
    if (
      event.target.matches(".home-linked") &&
      (event.key === "Enter" || event.key === " ")
    ) {
      event.preventDefault();
      navigate(event.target.dataset.view);
    }
  });
  window.addEventListener("popstate", render);

  function saveNote() {
    notes[state.selectedNote].title =
      document.querySelector("#note-title").value.trim() || "无标题笔记";
    state.noteContents[state.selectedNote] =
      document.querySelector("#note-editor").value;
  }

  prepareHome();
  render();
}
