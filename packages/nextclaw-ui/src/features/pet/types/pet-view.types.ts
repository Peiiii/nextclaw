/** UI 视图层皮结构（独立于 core 契约，UI 不直接依赖 @nextclaw/core）。 */
export type PetDockPetView = {
  id: string;
  name: string;
  description: string;
  emoji: string;
  vibe: string;
  catchphrase?: string;
};

/** 桌宠浮层可展开的展示状态（UI 视图层）。 */
export type PetDockView = {
  /** 当前激活皮（缺失时由调用方回退内置默认皮） */
  pet: PetDockPetView | null;
  /** 浮层是否展开（收起时只留小图标） */
  expanded: boolean;
  /** 简化状态帧：闲时/运行中（UI 仅按会话状态提示） */
  state: "idle" | "working";
};

export type PetDockLayoutPreferences = {
  expanded: boolean;
  /** 拖动后的位置（百分比 0-100，桌面浮层锚点） */
  xPercent: number;
  yPercent: number;
};
