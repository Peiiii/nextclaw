type LogoMap = Record<string, string>;

const CHANNEL_LOGOS: LogoMap = {
  telegram: "telegram.svg",
  slack: "slack.svg",
  discord: "discord.svg",
  whatsapp: "whatsapp.svg",
  qq: "qq.svg",
  feishu: "feishu.svg",
  dingtalk: "dingtalk.svg",
  wecom: "wecom.svg",
  weixin: "weixin.svg",
  mochat: "mochat.svg",
  email: "email.svg"
};

function resolveLogo(map: LogoMap, name: string): string | null {
  const key = name.toLowerCase();
  const file = map[key];
  return file ? `/logos/${file}` : null;
}

export function getChannelLogo(name: string): string | null {
  return resolveLogo(CHANNEL_LOGOS, name);
}
