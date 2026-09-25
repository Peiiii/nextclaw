/* Both entry points project this one local demo file collection. No host disk access. */
(() => {
  const storageKey = 'bibo-studio-files-v1';
  const seed = [
    { id: 'notes', parent: '', name: '笔记', kind: 'folder' },
    { id: 'work', parent: '', name: '工作', kind: 'folder' },
    { id: 'life', parent: '', name: '生活', kind: 'folder' },
    { id: 'idea', parent: 'notes', name: 'Bibo 的几个新想法.md', kind: 'note', body: '一个好的个人助手，应该让生活更从容。\n\n让对话成为自然的入口，让信息在需要时出现。\n少一点打扰，多一点理解。\n\n想到什么就记下来，整理可以晚一点。', modified: '2026-09-25T09:00:00' },
    { id: 'walk', parent: 'notes', name: '给周末留一点空白.md', kind: 'note', body: '去河边走走，看看那家新开的书店。\n\n不需要每件事都有结果。', modified: '2026-09-24T15:00:00' },
    { id: 'trip', parent: 'life', name: '京都旅行的灵感.md', kind: 'note', body: '清晨的鸭川，雨天的旧书店。\n\n想留两天，不做任何计划。', modified: '2026-09-23T10:00:00' },
    { id: 'plan', parent: 'work', name: 'Bibo 产品方案.md', kind: 'document', body: 'Bibo · 你的长期搭档\n\n概览帮助了解今天；对话一起思考；文件保留值得继续完善的成果。\n\n笔记是文件的专用入口，两处操作同一份内容。', modified: '2026-09-25T08:00:00', source: true },
    { id: 'chart', parent: 'work', name: '本周时间分布.svg', kind: 'chart', modified: '2026-09-25T08:30:00', source: true }
  ];
  let files = seed;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(saved) && saved.every(f => typeof f.id === 'string' && typeof f.name === 'string')) files = saved;
  } catch { toast('无法读取本地保存，当前展示示例内容'); }
  let folder = '', selected = 'idea', query = '', mode = 'document';
  let tabs = [], activeTab = null, treeHidden = false;
  let expanded = new Set(['notes', 'work']);
  try {
    const state = JSON.parse(localStorage.getItem('bibo-file-workspace'));
    if (state) {
      tabs = (state.tabs || []).filter(id=>files.some(f=>f.id===id&&f.kind!=='folder'));
      activeTab = tabs.includes(state.activeTab) ? state.activeTab : tabs[0] || null;
      expanded = new Set(state.expanded || []);
      treeHidden = matchMedia('(min-width:651px)').matches && !!state.treeHidden;
    }
  } catch { /* Start with a usable empty workspace when preferences cannot be read. */ }
  function saveWorkspace() {
    try { localStorage.setItem('bibo-file-workspace', JSON.stringify({tabs,activeTab,expanded:[...expanded],treeHidden})); }
    catch { toast('工作区布局无法保存，当前文件内容不受影响'); }
  }
  function revealFile(id) {
    let file = files.find(f=>f.id===id);
    while(file?.parent) { expanded.add(file.parent); file=files.find(f=>f.id===file.parent); }
  }
  function openFile(id) {
    if (!tabs.includes(id)) tabs.push(id);
    selected=id;activeTab=id;revealFile(id);
    if(matchMedia('(max-width:650px)').matches) treeHidden=true;
    saveWorkspace();render();
  }
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const find = id => files.find(f => f.id === id);
  const title = file => file.name.replace(/\.[^.]+$/, '');
  const path = id => { const f = find(id); return f ? `${path(f.parent)}/${f.name}` : ''; };
  const date = file => file.modified ? new Date(file.modified).toLocaleDateString('zh-CN', {month:'short',day:'numeric'}) : '—';
  const persist = () => {
    try { localStorage.setItem(storageKey, JSON.stringify(files)); return true; }
    catch { toast('保存失败：浏览器存储不可用。请复制内容后再离开。'); return false; }
  };
  const folderIcon = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2 5h6l2 2h8v10H2Z"/></svg>';
  const fileButton = document.createElement('button');
  fileButton.className = 'nav'; fileButton.dataset.view = 'files';
  fileButton.innerHTML = `${folderIcon}<span>文件</span>`;
  $('nav').append(fileButton);
  const taskNav = $('nav').querySelector('[data-view="tasks"] span');
  taskNav.textContent='任务';
  const taskStatuses={todo:'待开始',doing:'进行中',done:'已完成',cancelled:'已取消'};
  let tasks=[
    {id:'design',title:'打磨 Bibo 的文件工作区',description:'让目录、文档和 AI 的产物在一个空间里自然衔接。',project:'Bibo',priority:'高',status:'doing',due:'2026-09-28',subtasks:[{title:'明确目录树和标签行为',done:true},{title:'检查桌面与手机体验',done:false}]},
    {id:'review',title:'准备产品体验评审',description:'整理本轮方案，记录还需要确认的体验。',project:'Bibo',priority:'中',status:'todo',due:'2026-09-29',subtasks:[]},
    {id:'read',title:'读完 Alex 推荐的文章',description:'记下和个人助手有关的启发。',project:'个人',priority:'低',status:'todo',due:'',subtasks:[]}
  ];
  try {const saved=JSON.parse(localStorage.getItem('bibo-studio-tasks'));if(Array.isArray(saved))tasks=saved;}catch{toast('任务本地记录读取失败，展示示例');}
  let taskId=null, taskLayout='list', taskQuery='', taskProject='全部项目';
  const saveTasks=()=>{try{localStorage.setItem('bibo-studio-tasks',JSON.stringify(tasks));return true;}catch{toast('任务保存失败，请保留当前页面');return false;}};
  function taskCard(task) {
    return `<button class="task-card" data-task="${escape(task.id)}"><span class="task-status-dot ${task.status}"></span><span><strong>${escape(task.title)}</strong><small>${escape(task.project)} · ${escape(task.priority)}优先级${task.due?' · '+escape(task.due):''}</small></span><em>${taskStatuses[task.status]}</em></button>`;
  }
  function taskDetail(task) {
    if(!task)return '';
    return `<aside class="task-detail"><div class="task-detail-top"><span>${task.id==='new'?'新建任务':'任务详情'}</span><button data-close-task aria-label="关闭任务详情">×</button></div><form id="task-form"><label>名称<input id="task-title" aria-label="任务名称" required value="${escape(task.title)}" placeholder="想完成什么？"></label><div class="task-fields"><label>状态<select id="task-status">${Object.entries(taskStatuses).map(([value,label])=>`<option value="${value}" ${task.status===value?'selected':''}>${label}</option>`).join('')}</select></label><label>优先级<select id="task-priority">${['高','中','低'].map(p=>`<option ${task.priority===p?'selected':''}>${p}</option>`).join('')}</select></label><label>项目<input id="task-project" value="${escape(task.project)}"></label><label>截止日期<input id="task-due" type="date" value="${escape(task.due)}"></label></div><label>描述<textarea id="task-description" rows="4" placeholder="补充背景、目标或验收条件…">${escape(task.description)}</textarea></label><div class="task-subheading">子任务 <small>${task.subtasks.filter(s=>s.done).length} / ${task.subtasks.length}</small></div>${task.subtasks.map((s,i)=>`<label class="subtask-row"><input type="checkbox" data-subtask="${i}" ${s.done?'checked':''}><span>${escape(s.title)}</span></label>`).join('')}<div class="add-subtask"><input id="subtask-title" aria-label="新子任务" placeholder="添加一个步骤"><button type="button" data-add-subtask>＋</button></div><div class="task-save"><span>保存在此浏览器</span><button class="primary" type="submit">保存任务</button></div></form></aside>`;
  }
  let newTask=null;
  function collectTask() {
    if(!$('task-form'))return true;
    const task=taskId==='new'?newTask:tasks.find(t=>t.id===taskId);
    const name=$('task-title').value.trim();
    if(!name){toast('请填写任务名称，或关闭以取消新建');return false;}
    task.title=name;task.description=$('task-description').value;task.project=$('task-project').value.trim()||'个人';task.priority=$('task-priority').value;task.due=$('task-due').value;task.status=$('task-status').value;
    document.querySelectorAll('[data-subtask]').forEach(input=>task.subtasks[Number(input.dataset.subtask)].done=input.checked);
    if(taskId==='new'){task.id=crypto.randomUUID();tasks.push(task);taskId=task.id;newTask=null;}
    return saveTasks();
  }
  function renderTasks() {
    const filtered=tasks.filter(t=>(taskProject==='全部项目'||t.project===taskProject)&&`${t.title} ${t.description}`.includes(taskQuery));
    $('other').className='library task-module';
    $('other').innerHTML=`<header class="library-head"><h1>任务 <small>${tasks.filter(t=>!['done','cancelled'].includes(t.status)).length} 项进行中与待开始</small></h1><button class="primary" data-new-task>＋ 新建任务</button></header><div class="task-toolbar"><div class="task-switch"><button data-task-layout="list" class="${taskLayout==='list'?'chosen':''}">列表</button><button data-task-layout="board" class="${taskLayout==='board'?'chosen':''}">看板</button></div><input id="task-search" aria-label="搜索任务" placeholder="搜索任务" value="${escape(taskQuery)}"><select id="task-filter" aria-label="筛选项目">${['全部项目',...new Set(tasks.map(t=>t.project))].map(p=>`<option ${p===taskProject?'selected':''}>${escape(p)}</option>`).join('')}</select></div><div class="task-workspace ${taskId?'with-detail':''}"><div class="task-collection">${taskLayout==='list'?filtered.map(taskCard).join(''):`<div class="task-board">${Object.entries(taskStatuses).map(([status,label])=>`<section><h2>${label} <small>${filtered.filter(t=>t.status===status).length}</small></h2>${filtered.filter(t=>t.status===status).map(taskCard).join('')||'<p class="empty-column">暂无任务</p>'}</section>`).join('')}</div>`}${filtered.length?'':'<p class="file-empty">没有匹配的任务。修改搜索或项目筛选试试。</p>'}</div>${taskDetail(taskId==='new'?newTask:tasks.find(t=>t.id===taskId))}</div><footer class="library-notice">任务管理概念演示 · 列表、看板与概览共用任务数据；未接入真实 AI 执行或提醒。</footer>`;
    $('task-search').onchange=e=>{if(!collectTask())return;taskQuery=e.target.value;renderTasks();};
    $('task-filter').onchange=e=>{if(!collectTask())return;taskProject=e.target.value;renderTasks();};
  }
  const sidebarToggle = document.createElement('button');
  sidebarToggle.className = 'sidebar-toggle';
  sidebarToggle.innerHTML = icon('panel');
  document.querySelector('.sidebar').prepend(sidebarToggle);
  function setSidebar(collapsed) {
    $('app').classList.toggle('sidebar-collapsed', collapsed);
    sidebarToggle.setAttribute('aria-label', collapsed ? '展开侧边栏' : '收起侧边栏');
    sidebarToggle.setAttribute('aria-expanded', String(!collapsed));
    sidebarToggle.title = collapsed ? '展开侧边栏' : '收起侧边栏';
  }
  try { setSidebar(localStorage.getItem('bibo-sidebar-collapsed') === 'true'); }
  catch { setSidebar(false); }
  sidebarToggle.onclick = () => {
    const collapsed = !$('app').classList.contains('sidebar-collapsed');
    setSidebar(collapsed);
    try { localStorage.setItem('bibo-sidebar-collapsed', String(collapsed)); }
    catch { toast('侧栏状态仅在本次页面保留'); }
  };
  document.querySelectorAll('.nav').forEach(button => {
    const label = button.querySelector('span')?.textContent;
    button.title = label;
    button.setAttribute('aria-label', label);
  });

  function saveEditor() {
    const body = $('file-body'), name = $('file-title'), file = find(selected);
    if (!body || !name || !file) return true;
    const value = name.value.trim();
    if (!value || /[\\/]/.test(value)) { toast('名称不能为空或包含斜杠'); return false; }
    const extension = file.name.match(/\.[^.]+$/)?.[0] || '';
    const nextName = value + extension;
    if (files.some(f => f.id !== file.id && f.parent === file.parent && f.name === nextName)) {
      toast('此文件夹已有同名文件，请换一个名称'); return false;
    }
    if (file.name !== nextName || file.body !== body.value) {
      file.name = nextName; file.body = body.value; file.modified = new Date().toISOString();
    }
    return persist();
  }

  function editor(file) {
    if (!file) return '<div class="file-empty">选择一篇笔记，或者写下新的想法。</div>';
    const meta = `<div class="editor-meta">${mode==='document'?'<button class="mobile-back" data-note-list>← 笔记列表</button>':''}<span>${escape(path(file.parent) || '/')} /</span>${mode === 'document' ? '<button data-locate>在文件中查看 ↗</button>' : '<button data-directory>返回所在文件夹</button>'}${file.source ? '<button data-view="chat">来自与 Bibo 的对话 ↗</button>' : ''}</div>`;
    if (file.kind === 'chart') return `<div class="file-editor">${meta}<h2 class="preview-title">本周，时间花在哪里</h2><p class="subtitle">Bibo 整理 · 示例图表</p><div class="chart-preview">${[['专注',65,13],['会议',30,6],['生活',85,17]].map(([label,width,hours])=>`<div class="chart-row"><span>${label}</span><div class="chart-bar" style="width:${width}%"></div><span>${hours} h</span></div>`).join('')}</div><p class="subtitle" style="margin-top:20px">SVG 图表 · 当前为预览</p></div>`;
    return `<div class="file-editor">${meta}<input class="title-input" id="file-title" aria-label="文件标题" value="${escape(title(file))}"><textarea class="note-body" id="file-body" aria-label="文件正文">${escape(file.body || '')}</textarea><div class="editor-bottom"><span id="save-status">${date(file)} · Markdown</span><div class="library-actions"><select id="move-folder" aria-label="移动到文件夹"><option value="">文件根目录</option>${files.filter(f=>f.kind==='folder').map(f=>`<option value="${escape(f.id)}" ${f.id===file.parent?'selected':''}>${escape(path(f.id))}</option>`).join('')}</select><button data-move>移动</button><button class="primary" data-save>保存</button></div></div></div>`;
  }

  function noteList() {
    return files.filter(f=>f.kind==='note' && `${f.name} ${f.body}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>b.modified.localeCompare(a.modified)).map(f=>`<button class="note-entry ${selected===f.id?'active':''}" data-file="${escape(f.id)}"><strong>${escape(title(f))}</strong><p>${escape(f.body || '还没有内容')}</p><small>${date(f)} · ${escape(find(f.parent)?.name || '文件')}</small></button>`).join('') || '<div class="file-empty">没有找到笔记</div>';
  }

  function render() {
    const host = $('other'); host.className = 'library';
    const notes = mode === 'document';
    host.innerHTML = `<header class="library-head"><h1>${notes?'笔记':`<button data-toggle-tree aria-label="${treeHidden?'展开':'收起'}目录树" aria-expanded="${!treeHidden}">${icon('panel')}</button> 文件`}</h1><div class="library-actions">${notes?'<input class="library-search" id="note-search" aria-label="搜索笔记" placeholder="搜索笔记">':''}<button class="primary" ${notes?'data-new-note':'data-new-folder'}>${notes?'＋ 写笔记':'＋ 新建文件夹'}</button></div></header>${notes?`<div class="notes-layout"><aside class="note-list"><small>最近编辑</small><div id="note-items">${noteList()}</div></aside>${editor(find(selected))}</div>`:fileWorkspace()}<footer class="library-notice">本地概念演示 · 笔记与文件共用内容，保存在此浏览器；未连接电脑文件系统。</footer>`;
    if (notes) { $('note-search').value = query; $('note-search').oninput = e => { query=e.target.value; $('note-items').innerHTML=noteList(); }; }
    host.querySelectorAll('#file-title,#file-body').forEach(el=>el.addEventListener('input',()=>{$('save-status').textContent='编辑中 · 离开时保存';}));
  }

  function treeRows(parent='', depth=0) {
    const children=files.filter(f=>f.parent===parent).sort((a,b)=>(a.kind==='folder'?0:1)-(b.kind==='folder'?0:1)||a.name.localeCompare(b.name,'zh-CN'));
    return children.map(f=>`<div><button class="tree-row ${f.id===selected?'selected':''}" style="padding-left:${12+depth*16}px" title="${escape(path(f.id))}" ${f.kind==='folder'?`data-tree-folder="${escape(f.id)}" aria-expanded="${expanded.has(f.id)}"`:`data-file="${escape(f.id)}"`}><span class="tree-arrow">${f.kind==='folder'?(expanded.has(f.id)?'⌄':'›'):''}</span>${f.kind==='folder'?folderIcon:icon('document')}<span>${escape(f.name)}</span></button>${f.kind==='folder'&&expanded.has(f.id)?`<div>${treeRows(f.id,depth+1)||'<small class="tree-empty">空文件夹</small>'}</div>`:''}</div>`).join('');
  }
  function fileWorkspace() {
    return `<div class="file-workbench ${treeHidden?'tree-hidden':''}"><aside class="file-tree" aria-label="文件目录树"><div class="tree-heading">我的文件 <small>目录</small></div>${treeRows()}</aside><section class="file-stage"><div class="file-tabs" role="tablist" aria-label="已打开文件">${tabs.map(id=>{const f=find(id);return `<div class="file-tab ${id===selected?'active':''}"><button role="tab" aria-selected="${id===selected}" data-file="${escape(id)}" title="${escape(path(id))}">${icon('document')}<span>${escape(f.name)}</span></button><button data-close-tab="${escape(id)}" aria-label="关闭 ${escape(f.name)}">×</button></div>`;}).join('')}</div><form id="folder-form" class="folder-form hidden"><span>位置：${escape(path(folder)||'/')}</span><input id="folder-name" aria-label="文件夹名称" placeholder="文件夹名称" required><button class="primary">创建</button><button type="button" data-cancel-folder>取消</button></form>${selected?editor(find(selected)):'<div class="workspace-empty">'+icon('document')+'<h2>把想法，慢慢展开。</h2><p>从目录选择文件，在这里继续编辑。<br>笔记、文档和 Bibo 的成果，都在同一个空间。</p><button data-toggle-tree class="mobile-back">查看目录</button></div>'}</section></div>`;
  }

  function directory() {
    if (selected) return editor(find(selected));
    const ancestors=[]; let current=find(folder);
    while(current){ ancestors.unshift(current); current=find(current.parent); }
    const children=files.filter(f=>f.parent===folder).sort((a,b)=>(a.kind==='folder'?0:1)-(b.kind==='folder'?0:1)||a.name.localeCompare(b.name,'zh-CN'));
    return `<div class="breadcrumbs"><button data-folder="">文件</button>${ancestors.map(f=>`<span>/</span><button data-folder="${escape(f.id)}">${escape(f.name)}</button>`).join('')}</div><form id="folder-form" class="folder-form hidden"><input id="folder-name" aria-label="文件夹名称" placeholder="文件夹名称" required><button class="primary">创建</button><button type="button" data-cancel-folder>取消</button></form><table class="file-table"><thead><tr><th>名称</th><th>类型</th><th>最近修改</th></tr></thead><tbody>${children.map(f=>`<tr><td><button class="file-name" ${f.kind==='folder'?`data-folder="${escape(f.id)}"`:`data-file="${escape(f.id)}"`}>${f.kind==='folder'?folderIcon:icon('document')}${escape(f.name)}</button></td><td>${({folder:'文件夹',note:'笔记',document:'文档',chart:'图表'})[f.kind]}</td><td>${date(f)}</td></tr>`).join('')}</tbody></table>${children.length?'':'<div class="file-empty">这个文件夹还是空的。</div>'}`;
  }

  const baseView = view;
  view = function(id) {
    if(!collectTask())return;
    if (!saveEditor()) return;
    if(id==='tasks'){
      active='tasks';document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.view===id));
      $('conversation').classList.add('hidden');workspace(false);renderTasks();return;
    }
    if (id === 'home') {
      baseView(id);
      renderOverview();
      return;
    }
    if (!['document','files'].includes(id)) return baseView(id);
    active=id; mode=id;
    document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.view===id));
    $('conversation').classList.add('hidden'); workspace(false);
    if(id==='files') selected=activeTab;
    else if(find(selected)?.kind!=='note') selected=files.find(f=>f.kind==='note')?.id;
    render();
  };

  function renderOverview() {
    const recent = files.filter(f=>f.kind==='note').sort((a,b)=>b.modified.localeCompare(a.modified))[0];
    $('other').className='overview refined-overview';
    $('other').innerHTML=`<div class="overview-heading"><div><div class="eyebrow">9 月 25 日 · 星期五</div><h1>最近，你在忙这些。</h1><p>事情有条不紊，也留一点时间给自己。</p></div><span class="weather">晴 &nbsp; 24°</span></div>
    <div class="overview-brief"><span class="mini-mark"></span><div><strong>下午可以轻一点。</strong><p>产品讨论结束后没有其他安排。林悦的评审邀请还等你决定，我把回复草稿准备好了。</p></div><button data-view="chat" aria-label="继续与 Bibo 的对话">接着聊 ↗</button></div>
    <div class="overview-columns"><div class="overview-primary"><section class="overview-block"><div class="block-heading"><button data-view="inbox">等你回应 <span>3</span></button><small>值得先看一眼</small></div><button class="overview-mail" data-view="inbox"><span class="sender-avatar">悦</span><span><strong>林悦 <small>设计评审邀请</small></strong><p>今天 16:00 的评审，要不要挪到下周一？</p></span><span class="unread-dot"></span></button><button class="overview-mail" data-view="inbox"><span class="sender-avatar pale">A</span><span><strong>Alex <small>新方案的参考资料</small></strong><p>两篇文章，和我们上午聊到的想法有关。</p></span></button></section>
    <section class="project-overview"><div class="block-heading"><span>正在推进</span><small>BIBO / 产品设计</small></div><h2>让 Bibo，更像你的搭档。</h2><p>从一次自然的对话，到一份可以继续完善的成果。</p><div class="project-steps"><div class="done"><i></i><strong>方向确定</strong><small>已完成</small></div><div class="current"><i></i><strong>打磨原型</strong><small>正在进行</small></div><div><i></i><strong>体验评审</strong><small>下一步</small></div></div><button data-project-file>产品方案 <span>↗</span></button></section>
    <section class="overview-block overview-note"><div class="block-heading"><button data-view="document">最近的笔记</button><small>${recent?date(recent):''}</small></div><button data-recent-note><h2>${recent?escape(title(recent)):'记下一个新想法'}</h2><p>${recent?escape(recent.body.slice(0,105)):'不急着整理，先把想法留下。'}</p></button><div class="note-caption">留在这里，下次接着想。</div></section></div>
    <div class="overview-secondary"><section class="overview-block"><div class="block-heading"><button data-view="calendar">今天的节奏</button><small>3 个安排</small></div><div class="overview-agenda"><div class="past"><time>09:30</time><span>团队晨会<small>已结束 · 30 分钟</small></span></div><div class="past"><time>11:00</time><span>和 Alex 聊聊新想法<small>已结束 · 60 分钟</small></span></div><div><time>14:00</time><span>Bibo 产品讨论<small>60 分钟 · 线上</small></span></div><div class="open-time"><time>15:30</time><span>接下来，留给自己<small>散步，读书，或者什么都不做。</small></span></div></div></section>
    <section class="overview-block"><div class="block-heading"><button data-view="tasks">手边的几件事</button><small id="overview-task-count">0 / 3</small></div>${['整理产品讨论草稿','读完 Alex 推荐的文章','给阳台的植物浇水'].map((t,i)=>`<label class="overview-task"><input type="checkbox" data-overview-task="${i}"><span>${t}</span></label>`).join('')}</section><div class="quiet-moment"><span>☀</span><p>今天日落在 18:12。<br>五点出门，刚刚好。</p></div></div></div><div class="overview-demo-note">概念演示 · 日程、邮件及项目均为示例；笔记来自本地文件空间。</div>`;
    $('other').querySelector('[data-project-file]').onclick=()=>{view('files');openFile('plan');};
    const summary=$('overview-task-count').closest('section');
    summary.innerHTML=`<div class="block-heading"><button data-view="tasks">任务进展</button><small>${tasks.filter(t=>t.status==='doing').length} 项进行中</small></div>${tasks.filter(t=>!['done','cancelled'].includes(t.status)).slice(0,3).map(taskCard).join('')||'<p>当前任务都已告一段落。</p>'}`;
    $('other').querySelector('[data-recent-note]').onclick=()=>{view('document');if(recent)selected=recent.id;render();};
    $('other').querySelectorAll('[data-overview-task]').forEach(input=>input.addEventListener('change',()=>{
      $('overview-task-count').textContent=`${$('other').querySelectorAll('[data-overview-task]:checked').length} / 3`;
    }));
  }

  $('other').addEventListener('click', e => {
    const taskButton=e.target.closest('button');
    if(taskButton?.hasAttribute('data-task')){if(!collectTask()||!saveEditor())return;const nextTask=taskButton.dataset.task;view('tasks');taskId=nextTask;renderTasks();return;}
    if(active==='tasks'&&taskButton){
      if(taskButton.hasAttribute('data-close-task')){if(taskId!=='new'&&!collectTask())return;taskId=null;newTask=null;renderTasks();return;}
      if(!collectTask())return;
      if(taskButton.hasAttribute('data-new-task')){taskId='new';newTask={id:'new',title:'',description:'',project:'个人',status:'todo',priority:'中',due:'',subtasks:[]};renderTasks();$('task-title').focus();}
      if(taskButton.hasAttribute('data-task-layout')){taskLayout=taskButton.dataset.taskLayout;renderTasks();}
      if(taskButton.hasAttribute('data-add-subtask')){const text=$('subtask-title').value.trim();if(text){tasks.find(t=>t.id===taskId).subtasks.push({title:text,done:false});saveTasks();renderTasks();}}
      return;
    }
    if(!['document','files'].includes(active)) return;
    const button=e.target.closest('button'); if(!button) return;
    if(button.hasAttribute('data-save')) { if(saveEditor()){toast('已保存，笔记和文件已同步');render();} return; }
    if(button.hasAttribute('data-cancel-folder')) {$('folder-form').classList.add('hidden');return;}
    if(!saveEditor()) return;
    if(button.hasAttribute('data-new-note')) {
      selected=crypto.randomUUID(); let name='未命名笔记', n=1;
      while(files.some(f=>f.parent==='notes'&&f.name===`${name}.md`)) name=`未命名笔记 ${++n}`;
      files.push({id:selected,parent:'notes',name:`${name}.md`,kind:'note',body:'',modified:new Date().toISOString()}); persist();render();$('file-title').focus();$('file-title').select();
    } else if(button.hasAttribute('data-note-list')) {selected=null;render();}
    else if(button.hasAttribute('data-file')) {if(mode==='files')openFile(button.dataset.file);else {selected=button.dataset.file;render();}}
    else if(button.hasAttribute('data-toggle-tree')) {treeHidden=!treeHidden;saveWorkspace();render();}
    else if(button.hasAttribute('data-tree-folder')) {folder=button.dataset.treeFolder;if(expanded.has(folder))expanded.delete(folder);else expanded.add(folder);saveWorkspace();render();}
    else if(button.hasAttribute('data-close-tab')) {
      const id=button.dataset.closeTab,index=tabs.indexOf(id);tabs=tabs.filter(t=>t!==id);
      if(selected===id)selected=tabs[index]||tabs[index-1]||null;
      activeTab=selected;saveWorkspace();render();
    }
    else if(button.hasAttribute('data-folder')) {folder=button.dataset.folder;selected=null;render();}
    else if(button.hasAttribute('data-directory')) {folder=find(selected).parent;revealFile(selected);treeHidden=false;saveWorkspace();render();}
    else if(button.hasAttribute('data-locate')) {const id=selected;folder=find(id).parent;view('files');openFile(id);}
    else if(button.hasAttribute('data-move')) {
      const file=find(selected), destination=$('move-folder').value;
      if(files.some(f=>f.id!==file.id&&f.parent===destination&&f.name===file.name)) return toast('目标文件夹已有同名文件');
      file.parent=destination;file.modified=new Date().toISOString();revealFile(selected);if(persist()){toast('已移动，两处入口保持一致');render();}
    } else if(button.hasAttribute('data-new-folder')) {
      if(selected){folder=find(selected).parent;}
      if(matchMedia('(max-width:650px)').matches){treeHidden=true;render();}
      $('folder-form').classList.remove('hidden');$('folder-name').focus();
    }
  });
  $('other').addEventListener('submit',e=>{
    if(e.target.id==='task-form'){e.preventDefault();if(collectTask()){toast('任务已保存');renderTasks();}return;}
    if(e.target.id!=='folder-form')return; e.preventDefault(); const name=$('folder-name').value.trim();
    if(!name || /[\\/]/.test(name))return toast('请输入不含斜杠的文件夹名称');
    if(files.some(f=>f.parent===folder&&f.name===name))return toast('这个名称已存在');
    files.push({id:crypto.randomUUID(),parent:folder,name,kind:'folder'});if(persist())render();
  });
  window.addEventListener('beforeunload',e=>{if(!saveEditor()||!collectTask()){e.preventDefault();e.returnValue='';}});
  view('home');
})();
