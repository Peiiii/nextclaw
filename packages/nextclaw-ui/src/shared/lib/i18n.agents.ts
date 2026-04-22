export const AGENT_LABELS: Record<string, { zh: string; en: string }> = {
  agentsPageTitle: { zh: 'Agent 管理', en: 'Agents' },
  agentsPageDescription: {
    zh: '管理可对话的 Agent 身份。每个 Agent 都有自己的主目录、设定、记忆与技能。',
    en: 'Manage conversational agent identities. Each agent owns its home directory, setup, memory, and skills.'
  },
  agentsHeroEyebrow: { zh: 'Agent 管理台', en: 'Agent Gallery' },
  agentsHeroTitle: {
    zh: '让每个 Agent 都像真正的协作者一样存在',
    en: 'Give every agent the presence of a real collaborator'
  },
  agentsHeroDescription: {
    zh: '在这里浏览、创建并切换不同的 Agent 身份。每个 Agent 都有自己的头像、名称、主目录，以及独立的记忆与技能空间。',
    en: 'Browse, create, and choose distinct agent identities. Every agent carries its own avatar, name, home directory, memory, and skills space.'
  },
  agentsCreateButton: { zh: '新增 Agent', en: 'New Agent' },
  agentsCreateDialogTitle: { zh: '创建新的 Agent 身份', en: 'Create a new agent identity' },
  agentsCreateDialogDescription: {
    zh: '默认逻辑保持简单。只填必要信息，其余能力继续走统一配置与主目录模板。',
    en: 'Keep the flow simple. Provide only the essentials and let shared defaults plus the home directory template do the rest.'
  },
  agentsCreateDialogHint: {
    zh: '如果你希望让 AI 自动完成全部自定义，也可以继续使用 `nextclaw agents new`。',
    en: 'If you want AI to automate the full setup, you can still use `nextclaw agents new`.'
  },
  agentsCreateTitle: { zh: '创建 Agent', en: 'Create Agent' },
  agentsCreateDescription: {
    zh: '这里提供轻量入口。完整自动化创建链路也可通过 `nextclaw agents new` 使用。',
    en: 'This is the lightweight UI entry. The full automation path is also available through `nextclaw agents new`.'
  },
  agentsFormIdPlaceholder: { zh: 'Agent ID，例如 engineer', en: 'Agent ID, for example engineer' },
  agentsFormNamePlaceholder: { zh: '显示名称，可选', en: 'Display name, optional' },
  agentsFormDescriptionPlaceholder: { zh: '角色描述，可选', en: 'Role description, optional' },
  agentsFormAvatarPlaceholder: { zh: '头像 URL 或本地路径，可选', en: 'Avatar URL or local path, optional' },
  agentsFormHomePlaceholder: { zh: '主目录，可选', en: 'Home Directory, optional' },
  agentsFormRuntimePlaceholder: { zh: 'Runtime（如 native 或 codex，可选）', en: 'Runtime (e.g. native or codex, optional)' },
  agentsRuntimeSelectPlaceholder: { zh: '选择 Runtime', en: 'Select runtime' },
  agentsRuntimeUnavailableHelp: {
    zh: '当前 Runtime 已不在可用列表中；建议改选一个已安装且可用的 Runtime。',
    en: 'This runtime is no longer available in the current list. Switch to an installed and available runtime.'
  },
  agentsCreateAction: { zh: '创建 Agent', en: 'Create Agent' },
  agentsEditAction: { zh: '编辑', en: 'Edit' },
  agentsEditDialogTitle: { zh: '编辑 Agent 身份', en: 'Edit agent identity' },
  agentsEditDialogDescription: {
    zh: '更新名称、角色描述与头像。Agent ID 与主目录保持稳定，避免影响既有记忆、技能与会话。',
    en: 'Update the name, role description, and avatar. The agent ID and home directory stay stable to protect existing memory, skills, and sessions.'
  },
  agentsEditHomeReadonly: { zh: '主目录保持不变', en: 'Home directory stays unchanged' },
  agentsEditHomeReadonlyHint: {
    zh: '如需迁移主目录，请走独立配置迁移流程，避免意外丢失 Agent 上下文。',
    en: 'Use a dedicated config migration flow to move the home directory and avoid losing agent context unexpectedly.'
  },
  agentsEditSaveAction: { zh: '保存编辑', en: 'Save edits' },
  agentsRemoveAction: { zh: '移除', en: 'Remove' },
  agentsNewChat: { zh: '新建会话', en: 'New Chat' },
  agentsLoading: { zh: '正在加载 Agent...', en: 'Loading agents...' },
  agentsEmpty: { zh: '当前还没有附加 Agent', en: 'No extra agents yet' },
  agentsEmptyDescription: {
    zh: '先创建第一个专职 Agent，让它拥有自己的名字、头像与主目录。',
    en: 'Create the first specialist agent with its own name, avatar, and home directory.'
  },
  agentsBuiltIn: { zh: '内建', en: 'Built-in' },
  agentsCustom: { zh: '自定义', en: 'Custom' },
  agentsOverviewTotal: { zh: '全部 Agent', en: 'Conversational agents' },
  agentsOverviewBuiltIn: { zh: '系统主 Agent', en: 'System main agents' },
  agentsOverviewCustom: { zh: '专职 Agent', en: 'Specialist agents' },
  agentsCardBuiltInSummary: {
    zh: '系统主 Agent，适合作为默认入口与总控协作者。',
    en: 'The built-in main agent, ideal as the default entry and coordinating collaborator.'
  },
  agentsCardCustomSummary: {
    zh: '专属 Agent 身份，可沉淀自己的记忆、技能与角色风格。',
    en: 'A dedicated identity with its own memory, skills, and role style.'
  },
  agentsCardRuntimeLabel: { zh: 'Runtime', en: 'Runtime' },
  agentsCardHomeLabel: { zh: '主目录', en: 'Home Directory' },
  agentsCardAvatarLabel: { zh: 'Avatar', en: 'Avatar' },
  agentsCardStartChat: { zh: '开始对话', en: 'Start Chat' },
  agentsCardBuiltInTag: { zh: '系统主', en: 'Main Agent' },
  agentsCardCustomTag: { zh: '专职', en: 'Specialist' },
  chatDraftAgentTitle: { zh: '本次会话 Agent', en: 'Draft agent' },
  chatDraftAgentDescription: { zh: '创建后不可切换', en: 'Locked after creation' },
  chatDraftAgentCurrent: { zh: '当前 Agent', en: 'Current Agent' }
};
