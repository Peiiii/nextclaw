import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { formatNextClawAppInstallCommand } from "@nextclaw/shared";
import { AppCover } from "@/features/app-marketplace/components/app-cover.js";
import type { AppItemDetail } from "@/features/app-marketplace/types/app-marketplace.types.js";
import { formatAppPlatformLabel } from "@/features/app-marketplace/utils/app-platform-label.utils.js";

export function AppDetailPage(props: {
  app: AppItemDetail | null;
  onRetry: () => void;
  readme: string | null;
  status: "loading" | "ready" | "error";
}) {
  if (props.status === "loading") {
    return (
      <div className="page-stack page-stack--detail">
        <section className="section-panel detail-loading">
          <div className="detail-loading__icon" />
          <div><span /><span /><span /></div>
        </section>
      </div>
    );
  }
  if (props.status === "error" || !props.app) {
    return <div className="page-stack page-stack--detail"><section className="notice-state"><b>无法打开这个应用</b><span>应用可能已下架，或网络暂时不可用。</span><button type="button" className="button-link button-link--ghost" onClick={props.onRetry}>重新载入</button><Link className="text-link" to="/apps">返回应用库 →</Link></section></div>;
  }

  const { app } = props;
  const description = localized(app.descriptionI18n, app.description ?? app.summary);
  return (
    <div className="page-stack page-stack--detail">
      <Link className="back-link" to="/apps">← 返回应用库</Link>
      <section className="detail-intro">
        <AppCover
          accentColor={app.accentColor}
          className="detail-cover"
          coverUrl={app.coverUrl}
          loading="eager"
          name={app.name}
        />
        <div className="detail-hero">
          <AppDetailArtwork app={app} />
          <div className="detail-hero__copy">
            <div className="detail-publisher"><span className="verified-dot">✓</span>{app.publisher.name}</div>
            <h1>{app.name}</h1>
            <p>{description}</p>
            <div className="detail-meta">
              <span>v{app.latestVersion}</span><span>本机安装</span><span>发布于 {formatDate(app.publishedAt)}</span>
            </div>
          </div>
          <CopyInstallButton command={formatNextClawAppInstallCommand(app.install.spec)} />
        </div>
      </section>

      <div className="detail-layout">
        <section className="section-panel readme-section">
          <div className="section-heading">
            <div><p className="section-eyebrow">应用说明</p><h2>它能为你做什么</h2></div>
          </div>
          <div className="markdown-content">{renderReadme(props.readme)}</div>
        </section>

        <aside className="detail-sidebar">
          <section className="sidebar-card">
            <p className="section-eyebrow">访问范围</p>
            <h2>安装前看清权限</h2>
            <div className="permission-list">{permissionRows(app).map((row) => <div key={row.title}><span>✓</span><p><b>{row.title}</b><small>{row.detail}</small></p></div>)}</div>
          </section>
          <section className="sidebar-card">
            <p className="section-eyebrow">应用信息</p>
            <dl className="app-facts">
              <div><dt>应用 ID</dt><dd>{app.appId}</dd></div>
              <div><dt>组件</dt><dd>{componentSummary(app)}</dd></div>
              <div><dt>支持平台</dt><dd>{formatAppPlatformLabel(app.availability)}</dd></div>
              <div><dt>需要 NextClaw</dt><dd>{app.manifest.engines?.nextclaw ?? "未声明"}</dd></div>
              <div><dt>历史版本</dt><dd>{app.versions.length}</dd></div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}

function AppDetailArtwork({ app }: { app: AppItemDetail }) {
  const [failedIcon, setFailedIcon] = useState<string>();
  const failed = failedIcon === app.iconUrl;
  return <div className="app-artwork app-artwork--large">{app.iconUrl && !failed
    ? <img src={app.iconUrl} alt="" onError={() => setFailedIcon(app.iconUrl)} />
    : <span>{app.name.slice(0, 1)}</span>}</div>;
}

function CopyInstallButton({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };
  return <button type="button" className="detail-install-button" onClick={() => void copy()}><span>{copied ? "安装命令已复制" : "复制安装命令"}</span><small>{command}</small></button>;
}

function localized(values: Record<string, string> | undefined, fallback: string): string {
  const language = document.documentElement.lang.toLowerCase();
  return language.startsWith("zh")
    ? values?.["zh-CN"] ?? values?.zh ?? fallback
    : values?.["en-US"] ?? values?.en ?? fallback;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
}

function componentSummary(app: AppItemDetail): string {
  const components = app.manifest.components ?? [];
  const panels = components.filter((item) => item.kind === "panel").length;
  const services = components.filter((item) => item.kind === "service").length;
  if (components.length === 0) return "独立应用";
  return [panels ? `${panels} 个面板` : "", services ? `${services} 个服务` : ""].filter(Boolean).join(" · ");
}

function permissionRows(app: AppItemDetail): Array<{ title: string; detail: string }> {
  const rows = (app.permissions.documentAccess ?? []).map((entry) => ({
    title: entry.mode === "read" ? "读取授权目录" : "访问授权目录",
    detail: entry.description ?? entry.id,
  }));
  if ((app.permissions.allowedDomains ?? []).length > 0) rows.push({ title: "访问网络", detail: app.permissions.allowedDomains?.join("、") ?? "" });
  if (app.permissions.storage?.namespace) rows.push({ title: "保存本地数据", detail: "数据保存在这个应用自己的空间中" });
  if (app.permissions.capabilities?.hostBridge) rows.push({ title: "使用 NextClaw 能力", detail: "通过受控桥接与 NextClaw 交互" });
  return rows.length > 0 ? rows : [{ title: "无需额外权限", detail: "安装前不需要授权目录或网络访问" }];
}

function renderReadme(readme: string | null): ReactNode[] {
  if (!readme?.trim()) return [<p key="empty">发布者暂未提供更详细的应用说明。</p>];
  const nodes: ReactNode[] = [];
  let inCode = false;
  let codeLines: string[] = [];
  readme.split("\n").forEach((line, index) => {
    if (line.trim().startsWith("```")) {
      if (inCode) {
        nodes.push(<pre key={`code-${index}`}><code>{codeLines.join("\n")}</code></pre>);
        codeLines = [];
      }
      inCode = !inCode;
      return;
    }
    if (inCode) {
      codeLines.push(line);
      return;
    }
    if (line.startsWith("### ")) nodes.push(<h3 key={index}>{inlineCode(line.slice(4))}</h3>);
    else if (line.startsWith("## ")) nodes.push(<h2 key={index}>{inlineCode(line.slice(3))}</h2>);
    else if (line.startsWith("# ")) nodes.push(<h2 key={index}>{inlineCode(line.slice(2))}</h2>);
    else if (/^[-*] /.test(line)) nodes.push(<div className="markdown-bullet" key={index}><span>•</span><p>{inlineCode(line.slice(2))}</p></div>);
    else if (line.trim()) nodes.push(<p key={index}>{inlineCode(line)}</p>);
  });
  if (codeLines.length > 0) nodes.push(<pre key="code-final"><code>{codeLines.join("\n")}</code></pre>);
  return nodes;
}

function inlineCode(value: string): ReactNode[] {
  return value.split(/(`[^`]+`|\*\*[^*]+\*\*)/).filter(Boolean).map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}
