export function createPageRenderers({ state, mails, notes, link, escapeHtml }) {
  function renderChat() {
    const reference = state.chatReference
      ? `<div class="context-reference"><div><small>带入的内容</small><strong>${escapeHtml(state.chatReference.title)}</strong></div>${link(state.chatReturn || "overview", "查看来源 ↗")}</div>`
      : "";
    const conversations = {
      launch: ["网站上线与今天的安排", "今天 · 继续讨论"],
      portfolio: ["作品集从哪里开始", "星期三 · 2 条消息"],
      weekend: ["周末留点时间", "上周 · 4 条消息"],
      new: ["新对话", "刚刚"],
    };
    const panelSections = {
      mail: `<small>关联邮件 · ${mails[state.selectedMail].from}</small><h3>${mails[state.selectedMail].title}</h3><p>${mails[state.selectedMail].text}</p><div class="workspace-fact">Bibo 找到的关联<br><strong>${mails[state.selectedMail].context}</strong></div><button type="button" class="workspace-draft-link" data-chat-panel="draft">准备回复草稿</button>${link("inbox", "在收件箱中处理 ↗", "workspace-full-link")}`,
      calendar: `<small>关联日程 · 9 月 25 日</small><h3>评审时间，等待确认。</h3><div class="workspace-schedule"><time>14:00</time><span>预留 15 分钟准备 · Bibo 建议</span></div><div class="workspace-schedule pending"><time>14:30</time><span>方案评审 · 尚未确认</span></div><p>17:30 以后已留给你自己。建议不会自动写入日历。</p>${link("calendar", "在日程中决定 ↗", "workspace-full-link")}`,
      tasks: `<small>关联待办 · 网站上线</small><h3>上线前的两件事。</h3><div class="workspace-task">○ 确认网站的两处文案</div><div class="workspace-task">○ 回复林悦评审时间</div><p>先处理文案，再答复时间，能减少临时改动。</p>${link("tasks", "查看完整待办 ↗", "workspace-full-link")}`,
      note: `<small>关联笔记 · 作品集</small><h3>${escapeHtml(notes[state.selectedNote].title)}</h3><blockquote>${escapeHtml(state.noteContents[state.selectedNote])}</blockquote>${link("notes", "在笔记中继续 ↗", "workspace-full-link")}`,
      draft: `<small>邮件草稿 · 尚未发送</small><h3>给林悦的回复</h3><label for="chat-draft-text">草稿内容</label><textarea id="chat-draft-text" rows="8">${escapeHtml(state.chatDraft)}</textarea><button type="button" id="save-chat-draft">保存草稿</button><p id="chat-draft-status">只保留在本次演示中，不会发送邮件。</p><button type="button" class="workspace-draft-link" data-chat-panel="mail">返回原邮件</button>`,
    };
    const panelTitles = {
      mail: "邮件",
      calendar: "日程",
      tasks: "待办",
      note: "笔记",
      draft: "草稿",
    };
    const panel = state.chatPanelOpen
      ? `<aside class="chat-workspace" aria-label="对话右侧内容区"><div class="workspace-heading"><span>${panelTitles[state.chatPanel]}</span><button type="button" data-toggle-chat-panel aria-label="收起右侧内容区">×</button></div><div class="workspace-content">${panelSections[state.chatPanel]}</div></aside>`
      : "";
    const title = conversations[state.conversation][0];
    const seed =
      state.conversation === "launch"
        ? `<div class="message from-user">我想周五把网站上线，但下午的评审可能提前。</div><div class="message from-bibo"><b>✳ Bibo</b><p>先确认文案，再答复评审时间。林悦的邮件提到下午，你 14:00–15:00 有空档；这还不是已确认日程。</p><div class="source-links"><button type="button" data-chat-panel="mail" data-chat-mail="lin">✉ 林悦的邮件</button><button type="button" data-chat-panel="calendar">◷ 今天的日程</button><button type="button" data-chat-panel="tasks">✓ 上线待办</button></div><p class="agent-status">待你确认评审时间 · 日程尚未改动</p></div>`
        : state.conversation === "portfolio"
          ? '<div class="message from-user">网站做完以后，我该怎么整理成作品集？</div><div class="message from-bibo"><b>✳ Bibo</b><p>先把决定过程记录下来，完成上线后再挑选一个最能代表你的片段。</p></div>'
          : state.conversation === "weekend"
            ? '<div class="message from-user">周末我想留一点真正属于自己的时间。</div><div class="message from-bibo"><b>✳ Bibo</b><p>好。我会把未确认的安排留作提醒，不替你做决定。</p></div>'
            : '<div class="message from-bibo"><b>✳ Bibo</b><p>我们从什么开始？</p></div>';
    return `<div class="chat-page ${state.chatPanelOpen ? "has-workspace" : ""}"><aside class="conversation-list"><div class="list-title">最近的对话 <button type="button" id="new-conversation" aria-label="新对话">＋</button></div>${Object.entries(
      conversations,
    )
      .filter(([id]) => id !== "new" || state.conversation === "new")
      .map(
        ([id, [name, meta]]) =>
          `<button class="conversation ${state.conversation === id ? "selected" : ""}" data-conversation="${id}" type="button"><strong>${name}</strong><span>${meta}</span></button>`,
      )
      .join(
        "",
      )}</aside><section class="conversation-room"><div class="conversation-heading"><strong>${title}</strong>${state.chatPanelOpen ? "" : '<button type="button" data-toggle-chat-panel aria-expanded="false">显示关联内容</button>'}</div><div class="message-flow" id="message-flow">${seed}${reference}${state.messages.map(([role, message]) => `<div class="message ${role}">${escapeHtml(message)}</div>`).join("")}</div><form id="conversation-form" class="conversation-form"><label class="sr-only" for="conversation-input">和 Bibo 对话</label><textarea id="conversation-input" rows="2" placeholder="和 Bibo 说说你在想什么……" required></textarea><div><span>预设演示 · 不会发送到真实 AI</span><button type="submit">发送 ↑</button></div></form></section>${panel}</div>`;
  }

  function renderInbox() {
    const visibleMails = Object.entries(mails).filter(([key]) => {
      if (state.mailFilter === "done") return state.processedMail.has(key);
      if (state.processedMail.has(key)) return false;
      return state.mailFilter === "pending" ? key !== "zhe" : key === "zhe";
    });
    const selectedKey = visibleMails.some(([key]) => key === state.selectedMail)
      ? state.selectedMail
      : visibleMails[0]?.[0];
    const selected = selectedKey ? mails[selectedKey] : null;
    const tabs = [
      ["pending", "待处理"],
      ["later", "稍后"],
      ["done", "已处理"],
    ];
    const list = visibleMails.length
      ? visibleMails
          .map(
            ([key, mail]) =>
              `<button class="list-item ${selectedKey === key ? "selected" : ""}" type="button" data-mail="${key}"><span>${mail.from} <small>${mail.time}</small></span><strong>${mail.title}</strong><em>${state.processedMail.has(key) ? "已处理" : "需要回应"}</em></button>`,
          )
          .join("")
      : '<p class="list-empty">这里暂时没有消息。</p>';
    const detail = selected
      ? `<article class="detail-page"><h2>${selected.title}</h2><div class="detail-meta">${selected.from} · ${selected.time} · 发给你</div><div class="mail-text"><p>${selected.text}</p><p>谢谢，<br>${selected.from}</p></div><div class="context-callout"><strong>✳ Bibo 找到的关联</strong><p>${selected.context}</p>${link("chat", "和 Bibo 讨论这封信", "text-link")}</div><div class="mail-actions"><button type="button" id="reply-draft">准备回复草稿</button><button type="button" id="mark-processed" data-selected-mail="${selectedKey}">${state.processedMail.has(selectedKey) ? "恢复待处理" : "标记已处理"}</button></div><div class="draft-area" id="draft-area" hidden><label for="reply-text">示例草稿 · 这里不会发送邮件</label><textarea id="reply-text" rows="3">可以，14:30 开始怎么样？我会提前看一遍方案。</textarea></div></article>`
      : '<article class="detail-page empty-detail"><h2>现在可以先放下收件箱。</h2><p>需要处理的消息会出现在这里。</p></article>';
    return `<div class="split-page"><aside class="item-list"><div class="list-title">收到的消息 <span>${Object.keys(mails).length} 封来信</span></div><div class="segment">${tabs.map(([id, label]) => `<button class="${state.mailFilter === id ? "selected" : ""}" data-mail-filter="${id}" type="button">${label}</button>`).join("")}</div>${list}</aside>${detail}</div>`;
  }

  function renderCalendar() {
    const events = {
      copy: {
        time: "09:30",
        duration: "45 分钟",
        title: "整理上线文案",
        status: "已安排",
        kind: "scheduled",
        top: 84,
        height: 48,
        detail: "先确认网站上线前的两处文案。完成后可以给团队一个明确答复。",
      },
      prep: {
        time: "14:00",
        duration: "15 分钟",
        title: "预留评审准备时间",
        status: state.acceptedTime ? "已保留" : "Bibo 的建议",
        kind: state.acceptedTime ? "scheduled" : "suggested",
        top: 336,
        height: 28,
        detail:
          "Bibo 根据林悦的邮件发现下午有空档，建议先留 15 分钟看方案。你可以决定是否保留。",
      },
      review: {
        time: "14:30",
        duration: "60 分钟",
        title: "方案评审 · 待确认",
        status: "等待你回复",
        kind: "pending",
        top: 364,
        height: 64,
        detail:
          "林悦提出把评审提前到下午。这个时间尚未确认，也不会自动写进你的日历。",
      },
      personal: {
        time: "17:30",
        duration: "90 分钟",
        title: "自己的时间",
        status: "已安排",
        kind: "personal",
        top: 532,
        height: 78,
        detail: "这段时间属于你。Bibo 会在建议新安排时避开它。",
      },
    };
    for (const event of state.customEvents) events[event.id] = event;
    const chosen = events[state.selectedEvent];
    const eventButton = ([id, event]) =>
      `<button type="button" class="time-event ${event.kind} ${state.selectedEvent === id ? "active" : ""}" data-event="${id}" style="top:${event.top}px;height:${event.height}px"><span class="time-event-time">${event.time} · ${event.duration}</span><strong>${escapeHtml(event.title)}</strong><small>${event.status}</small></button>`;
    const day = `<div class="calendar-grid"><div class="time-axis">${Array.from({ length: 12 }, (_, i) => `<span>${String(i + 8).padStart(2, "0")}:00</span>`).join("")}</div><div class="day-lane"><div class="day-lane-label"><strong>25</strong><span>星期五 · 今天</span></div><div class="time-canvas">${Object.entries(events).map(eventButton).join("")}</div></div></div>`;
    const days = [
      ["一", "21", [["09:00", "整理本周目标"]]],
      ["二", "22", [["10:30", "产品同步"]]],
      ["三", "23", [["14:00", "记录评审原则"]]],
      ["四", "24", [["11:00", "网站检查"]]],
      [
        "五",
        "25",
        [
          ["09:30", "整理上线文案"],
          ["14:00", "准备评审"],
          ["14:30", "评审待确认"],
          ["17:30", "自己的时间"],
        ],
      ],
      ["六", "26", [["18:00", "聚餐待确认"]]],
      ["日", "27", []],
    ];
    days[4][2].push(
      ...state.customEvents.map((event) => [event.time, event.title]),
    );
    const week = `<div class="week-calendar"><div class="week-axis"><div class="week-axis-head"></div><div class="week-axis-times">${Array.from({ length: 12 }, (_, i) => `<span>${String(i + 8).padStart(2, "0")}:00</span>`).join("")}</div></div>${days
      .map(
        ([name, date, items]) =>
          `<div class="week-day ${date === "25" ? "today" : ""}"><div class="week-day-head"><small>周${name}</small><strong>${date}</strong></div><div class="week-time-canvas">${items
            .map(([time, title]) => {
              const [hour, minute] = time.split(":").map(Number);
              const top = (hour - 8) * 56 + (minute / 60) * 56;
              const kind = title.includes("待确认")
                ? "pending"
                : title.includes("准备评审")
                  ? "suggested"
                  : title.includes("自己的")
                    ? "personal"
                    : "";
              return `<div class="week-event ${kind}" style="top:${top}px"><time>${time}</time><span>${escapeHtml(title)}</span></div>`;
            })
            .join("")}</div></div>`,
      )
      .join("")}</div>`;
    const editor = `<div class="event-detail-label">新建安排</div><h2>把时间留给重要的事。</h2><form id="event-add-form" class="event-add"><label for="event-title">安排名称</label><input id="event-title" required placeholder="例如：整理方案"><label for="event-time">开始时间</label><input id="event-time" type="time" min="08:00" max="19:30" value="16:00" required><button type="submit">加入今天</button><button type="button" id="cancel-event">取消</button></form><p class="quiet">只在本次演示中保留，不会写入真实日历。</p>`;
    const detail = `<div class="event-detail-label">${chosen.status}</div><div class="event-detail-time">星期五 ${chosen.time} · ${chosen.duration}</div><h2>${escapeHtml(chosen.title)}</h2><p>${escapeHtml(chosen.detail)}</p>${state.selectedEvent === "review" || state.selectedEvent === "prep" ? link("inbox", "查看林悦的邮件 ↗", "text-link") : state.selectedEvent === "copy" ? link("tasks", "查看相关待办 ↗", "text-link") : ""}${state.selectedEvent === "prep" ? `<button type="button" id="accept-time">${state.acceptedTime ? "已保留准备时间 ✓" : "保留这 15 分钟"}</button>` : ""}<div class="event-detail-divider"></div><p class="quiet">日程中的建议和待确认事项不会自动变成已确认安排。此处仅改变演示状态。</p>`;
    return `<div class="calendar-page"><div class="calendar-toolbar"><div><strong>${state.calendarMode === "day" ? "9 月 25 日，星期五" : "9 月 21 日 — 27 日"}</strong><span>已安排、待确认和 Bibo 的建议分开呈现</span></div><div class="calendar-controls"><button type="button" id="new-event">＋ 新建安排</button><div class="segment" aria-label="日历视图"><button type="button" data-calendar-mode="day" class="${state.calendarMode === "day" ? "selected" : ""}">日视图</button><button type="button" data-calendar-mode="week" class="${state.calendarMode === "week" ? "selected" : ""}">周视图</button></div></div></div><div class="calendar-body"><section class="calendar-workspace" aria-label="${state.calendarMode === "day" ? "9 月 25 日时间安排" : "本周时间安排"}">${state.calendarMode === "day" ? day : week}</section><aside class="event-detail">${state.calendarCreating ? editor : detail}</aside></div></div>`;
  }

  function renderTasks() {
    const tasks = [
      ["copy", "确认网站的两处文案", "网站上线 · 今天"],
      ["reply", "回复林悦评审时间", "网站上线 · 今天"],
      ["launch", "检查上线清单", "网站上线 · 周五前"],
      ["review", "记录评审结论", "网站上线 · 评审后"],
    ];
    return `<div class="tasks-page"><div class="tasks-intro"><div><small>正在推进</small><h2>网站上线，最后一段路。</h2></div><div class="progress-number">${state.done.size} / ${tasks.length + state.addedTasks.length} <span>已完成</span></div></div><form class="task-add" id="task-add-form"><label class="sr-only" for="task-add-input">添加待办</label><span>＋</span><input id="task-add-input" placeholder="添加一件要做的事" required><button type="submit">添加</button></form><div class="task-groups"><section><h3>今天</h3>${[...tasks.slice(0, 2), ...state.addedTasks].map(taskRow).join("")}</section><section><h3>接下来</h3>${tasks.slice(2).map(taskRow).join("")}</section></div><aside class="task-sources"><strong>相关内容</strong>${link("inbox", "✉ 与林悦、陈一的邮件")}${link("calendar", "◷ 周五的安排")}${link("notes", "▤ 网站做完以后")}${link("chat", "✳ 和 Bibo 讨论下一步")}</aside></div>`;
    function taskRow([id, title, meta]) {
      return `<label class="task-row ${state.done.has(id) ? "done" : ""}"><input type="checkbox" data-task="${id}" ${state.done.has(id) ? "checked" : ""}><span><strong>${escapeHtml(title)}</strong><small>${meta}</small></span></label>`;
    }
  }

  function renderNotes() {
    const note = notes[state.selectedNote];
    return `<div class="notes-page"><aside class="notes-list"><div class="list-title">我的笔记 <button type="button" id="new-note" aria-label="新建笔记">＋</button></div><input type="search" id="note-search" placeholder="搜索笔记" aria-label="搜索笔记">${Object.entries(
      notes,
    )
      .map(
        ([id, item]) =>
          `<button class="list-item ${state.selectedNote === id ? "selected" : ""}" type="button" data-note="${id}"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.meta)}</small></button>`,
      )
      .join(
        "",
      )}</aside><article class="note-document"><div class="detail-eyebrow">${escapeHtml(note.meta)}</div><label class="sr-only" for="note-title">笔记标题</label><input id="note-title" class="note-title-input" value="${escapeHtml(note.title)}"><label class="sr-only" for="note-editor">笔记正文</label><textarea id="note-editor" rows="10">${escapeHtml(state.noteContents[state.selectedNote] || "")}</textarea><div class="note-actions"><button type="button" id="save-note">保存本次修改</button><button type="button" id="discuss-note">和 Bibo 讨论这篇笔记</button><span id="note-status" role="status">仅在本次演示中保留</span></div></article></div>`;
  }

  function renderProject() {
    const coreTasks = ["copy", "reply", "launch", "review"];
    const finished = coreTasks.filter((id) => state.done.has(id)).length;
    return `<div class="project-page"><div class="project-intro"><div><small>ACTIVE PROJECT / 01</small><h2>网站上线</h2><p>把邮件、日程、待办和笔记放回同一件事。先完成眼前的决定，再整理值得留下的过程。</p></div><div class="project-progress"><strong>${finished} / 4</strong><span>关键待办已完成</span><div class="project-progress-track"><i style="width:${finished * 25}%"></i></div></div></div><div class="project-section-label">围绕这件事</div><div class="project-sources">${link("inbox", "<small>✉ 收件箱</small><strong>两封等待回应的邮件</strong><span>陈一的文案确认 · 林悦的评审时间</span>", "project-source")}${link("calendar", "<small>◷ 日程</small><strong>周五下午的评审</strong><span>14:30 待确认；14:00 可留出准备时间</span>", "project-source")}${link("tasks", `<small>✓ 待办</small><strong>${finished} / 4 项已完成</strong><span>从确认文案开始，再处理评审答复</span>`, "project-source")}${link("notes", "<small>▤ 笔记</small><strong>网站做完以后</strong><span>先上线，再挑一个值得讲的片段</span>", "project-source")}</div><div class="project-next"><div><small>✳ Bibo 的观察</small><p>这两封邮件关系到同一次上线。先给文案一个结论，再决定评审时间，今天的安排会清楚很多。</p></div>${link("chat", "和 Bibo 讨论这个项目 ↗")}</div></div>`;
  }

  return {
    chat: renderChat,
    inbox: renderInbox,
    calendar: renderCalendar,
    tasks: renderTasks,
    notes: renderNotes,
    project: renderProject,
  };
}
