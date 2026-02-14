type LogoMap = Record<string, string>;

const PROVIDER_LOGOS: LogoMap = {
  openrouter: "openrouter.svg",
  aihubmix: "aihubmix.png",
  anthropic: "anthropic.svg",
  openai: "openai.svg",
  gemini: "gemini.svg",
  deepseek: "deepseek.png",
  zhipu: "zhipu.svg",
  dashscope: "dashscope.png",
  moonshot: "moonshot.svg",
  minimax: "minimax.svg",
  vllm: "vllm.svg",
  groq: "groq.svg"
};

const CHANNEL_LOGOS: LogoMap = {
  telegram: "telegram.svg",
  slack: "slack.svg",
  discord: "discord.svg",
  whatsapp: "whatsapp.svg",
  qq: "qq.svg",
  feishu: "feishu.svg",
  dingtalk: "dingtalk.svg",
  mochat: "mochat.svg",
  email: "email.svg"
};

function resolveLogo(map: LogoMap, name: string): string | null {
  const key = name.toLowerCase();
  const file = map[key];
  return file ? `/logos/${file}` : null;
}

export function getProviderLogo(name: string): string | null {
  return resolveLogo(PROVIDER_LOGOS, name);
}

export function getChannelLogo(name: string): string | null {
  return resolveLogo(CHANNEL_LOGOS, name);
}
