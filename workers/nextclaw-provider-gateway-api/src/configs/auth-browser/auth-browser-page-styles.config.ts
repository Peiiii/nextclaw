export const browserAuthPageStyles = `
  :root {
    color-scheme: light;
    --bg-0: #fbfcfe;
    --bg-1: #eef3f9;
    --card: rgba(255, 255, 255, 0.92);
    --card-strong: rgba(255, 255, 255, 0.96);
    --border: rgba(148, 163, 184, 0.18);
    --border-strong: rgba(148, 163, 184, 0.3);
    --text: #0f172a;
    --muted: #475569;
    --subtle: #64748b;
    --brand-50: #eef7ff;
    --brand-100: #d8ebff;
    --brand-300: #93c5fd;
    --brand-600: #2563eb;
    --brand-700: #1d4ed8;
    --brand-900: #0f172a;
    --success-bg: #ecfdf5;
    --success-border: #bbf7d0;
    --success-text: #166534;
    --error-bg: #fff1f2;
    --error-border: #fecdd3;
    --error-text: #be123c;
    font-family: "SF Pro Text", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif;
    background:
      radial-gradient(circle at top left, rgba(37, 99, 235, 0.16) 0%, transparent 30%),
      radial-gradient(circle at right 20%, rgba(15, 23, 42, 0.08) 0%, transparent 26%),
      linear-gradient(180deg, var(--bg-0) 0%, var(--bg-1) 100%);
    color: var(--text);
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  .shell {
    width: min(1080px, 100%);
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(360px, 0.9fr);
    border-radius: 36px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.7);
    background: rgba(255, 255, 255, 0.56);
    box-shadow: 0 40px 100px rgba(15, 23, 42, 0.12);
    backdrop-filter: blur(28px);
  }
  .hero-panel {
    position: relative;
    padding: 34px;
    background:
      linear-gradient(135deg, rgba(255, 255, 255, 0.78) 0%, rgba(255, 255, 255, 0.52) 100%);
  }
  .hero-panel::before {
    content: "";
    position: absolute;
    inset: 20px auto auto 20px;
    width: 220px;
    height: 220px;
    border-radius: 999px;
    background: radial-gradient(circle, rgba(37, 99, 235, 0.18) 0%, transparent 68%);
    pointer-events: none;
  }
  .hero-content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 28px;
    height: 100%;
  }
  .eyebrow {
    margin: 0;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.34em;
    text-transform: uppercase;
    color: var(--brand-700);
  }
  .hero-copy h1 {
    margin: 0;
    font-size: clamp(34px, 5vw, 52px);
    line-height: 1.02;
    letter-spacing: -0.045em;
  }
  .hero-copy p {
    margin: 16px 0 0;
    max-width: 580px;
    color: var(--muted);
    font-size: 17px;
    line-height: 1.78;
  }
  .highlight-list {
    display: grid;
    gap: 14px;
  }
  .highlight-card {
    border-radius: 28px;
    border: 1px solid rgba(226, 232, 240, 0.92);
    background: rgba(255, 255, 255, 0.72);
    padding: 18px 18px 16px;
  }
  .highlight-card h2 {
    margin: 0;
    font-size: 15px;
    line-height: 1.5;
  }
  .highlight-card p {
    margin: 8px 0 0;
    color: var(--muted);
    font-size: 14px;
    line-height: 1.72;
  }
  .auth-panel {
    display: flex;
    align-items: stretch;
    padding: 22px;
    background: rgba(247, 250, 252, 0.7);
  }
  .auth-card {
    width: 100%;
    border-radius: 30px;
    border: 1px solid rgba(226, 232, 240, 0.9);
    background: var(--card-strong);
    box-shadow: 0 24px 72px rgba(15, 23, 42, 0.12);
    padding: 24px;
  }
  .card-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 18px;
  }
  .locale-switcher {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: 999px;
    border: 1px solid rgba(226, 232, 240, 0.95);
    background: rgba(248, 250, 252, 0.95);
    padding: 5px;
  }
  .locale-switcher span {
    padding: 0 10px 0 12px;
    color: var(--subtle);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }
  .locale-switcher a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 34px;
    padding: 0 12px;
    border-radius: 999px;
    color: var(--muted);
    text-decoration: none;
    font-size: 12px;
    font-weight: 700;
  }
  .locale-switcher a.active {
    background: var(--brand-900);
    color: white;
  }
  .mode-switch {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    padding: 6px;
    border-radius: 28px;
    border: 1px solid rgba(226, 232, 240, 0.95);
    background: rgba(248, 250, 252, 0.96);
  }
  .mode-switch a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0 14px;
    border-radius: 22px;
    color: var(--muted);
    text-decoration: none;
    font-size: 14px;
    font-weight: 700;
    text-align: center;
  }
  .mode-switch a.active {
    background: var(--brand-900);
    color: white;
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
  }
  .section-header {
    margin: 20px 0 0;
  }
  .section-header .eyebrow {
    letter-spacing: 0.28em;
  }
  .section-header h2 {
    margin: 8px 0 0;
    font-size: 29px;
    line-height: 1.08;
    letter-spacing: -0.04em;
  }
  .section-header p {
    margin: 12px 0 0;
    color: var(--muted);
    font-size: 14px;
    line-height: 1.72;
  }
  .notice {
    margin-top: 14px;
    border-radius: 22px;
    padding: 14px 16px;
    border: 1px solid transparent;
    font-size: 14px;
    line-height: 1.68;
  }
  .notice.success {
    background: var(--success-bg);
    border-color: var(--success-border);
    color: var(--success-text);
  }
  .notice.error {
    background: var(--error-bg);
    border-color: var(--error-border);
    color: var(--error-text);
  }
  .section {
    margin-top: 18px;
    border-radius: 28px;
    border: 1px solid rgba(226, 232, 240, 0.95);
    background: rgba(248, 250, 252, 0.92);
    padding: 18px;
  }
  .section-label {
    margin: 0 0 8px;
    color: var(--brand-700);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.24em;
    text-transform: uppercase;
  }
  .section-copy {
    margin: 0 0 16px;
    color: var(--muted);
    font-size: 14px;
    line-height: 1.72;
  }
  .auth-form {
    display: grid;
    gap: 14px;
  }
  label {
    display: grid;
    gap: 8px;
    color: var(--text);
    font-size: 14px;
    font-weight: 700;
  }
  input {
    width: 100%;
    min-height: 50px;
    border-radius: 18px;
    border: 1px solid rgba(203, 213, 225, 0.96);
    background: white;
    padding: 0 16px;
    color: var(--text);
    font-size: 15px;
  }
  input:focus {
    outline: 2px solid rgba(37, 99, 235, 0.18);
    border-color: var(--brand-600);
  }
  button,
  .ghost-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 48px;
    border-radius: 18px;
    padding: 0 16px;
    font-size: 15px;
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
  }
  button {
    border: 0;
    color: white;
    background: linear-gradient(135deg, var(--brand-900) 0%, var(--brand-600) 100%);
    box-shadow: 0 16px 32px rgba(37, 99, 235, 0.16);
  }
  .secondary-actions {
    margin-top: 12px;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  .ghost-button,
  .ghost-link {
    border: 1px solid rgba(203, 213, 225, 0.96);
    background: white;
    color: var(--text);
    box-shadow: none;
  }
  .state-card {
    margin-top: 18px;
    border-radius: 28px;
    border: 1px solid rgba(226, 232, 240, 0.95);
    background: rgba(248, 250, 252, 0.92);
    padding: 18px;
  }
  .state-card p {
    margin: 0;
    color: var(--muted);
    font-size: 14px;
    line-height: 1.72;
  }
  .meta {
    margin: 14px 0 0;
    color: var(--subtle);
    font-size: 12px;
    line-height: 1.6;
  }
  strong {
    color: var(--text);
  }
  @media (max-width: 960px) {
    .shell {
      grid-template-columns: 1fr;
    }
    .hero-panel {
      padding-bottom: 20px;
    }
  }
  @media (max-width: 640px) {
    body {
      padding: 16px;
    }
    .hero-panel,
    .auth-panel {
      padding: 16px;
    }
    .auth-card {
      padding: 18px;
    }
    .card-topbar {
      flex-direction: column;
      align-items: stretch;
    }
    .mode-switch {
      grid-template-columns: 1fr;
    }
    .secondary-actions {
      grid-template-columns: 1fr;
    }
  }
`;
