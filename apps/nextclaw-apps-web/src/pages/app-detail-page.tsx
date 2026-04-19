import type { AppItemDetail } from "../app.types.js";

export function AppDetailPage(props: {
  app: AppItemDetail | null;
  readme: string | null;
}) {
  if (!props.app) {
    return (
      <div className="page-stack">
        <section className="section-panel">
          <h1>Loading app…</h1>
        </section>
      </div>
    );
  }

  const { app } = props;
  return (
    <div className="page-stack">
      <section className="hero-section hero-section--compact">
        <div className="hero-copy">
          <p className="hero-eyebrow">{app.publisher.name}</p>
          <h1>{app.name}</h1>
          <p>{app.description ?? app.summary}</p>
          <div className="detail-meta">
            <span>{app.appId}</span>
            <span>v{app.latestVersion}</span>
            <span>{app.author}</span>
          </div>
          <code className="install-command install-command--large">{app.install.command}</code>
        </div>
      </section>

      <section className="section-panel">
        <div className="detail-grid">
          <div>
            <p className="section-eyebrow">Permissions</p>
            <ul className="detail-list">
              {(app.permissions.documentAccess ?? []).map((entry: NonNullable<AppItemDetail["permissions"]["documentAccess"]>[number]) => (
                <li key={entry.id}>
                  {entry.id} · {entry.mode}
                </li>
              ))}
              {(app.permissions.allowedDomains ?? []).map((domain: string) => (
                <li key={domain}>{domain}</li>
              ))}
              {app.permissions.storage?.namespace ? <li>storage: {app.permissions.storage.namespace}</li> : null}
              {app.permissions.capabilities?.hostBridge ? <li>capability: hostBridge</li> : null}
            </ul>
          </div>
          <div>
            <p className="section-eyebrow">Versions</p>
            <ul className="detail-list">
              {app.versions.map((version: AppItemDetail["versions"][number]) => (
                <li key={version.version}>
                  {version.version} · {new Date(version.publishedAt).toLocaleString()}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="section-panel">
        <div className="section-heading">
          <div>
            <p className="section-eyebrow">README</p>
            <h2>应用说明</h2>
          </div>
        </div>
        <pre className="markdown-panel">{props.readme ?? "No README published yet."}</pre>
      </section>
    </div>
  );
}
