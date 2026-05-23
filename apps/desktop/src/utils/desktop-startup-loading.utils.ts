const startupLoadingHtml = String.raw`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>NextClaw Desktop</title>
    <style>
      html,
      body {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
        background: #f9f8f5;
        color: #33332f;
        font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      body {
        display: flex;
        align-items: center;
        justify-content: center;
        user-select: none;
        -webkit-app-region: drag;
        app-region: drag;
      }

      main {
        display: flex;
        align-items: center;
        font-size: 15px;
        font-weight: 600;
      }
    </style>
  </head>
  <body>
    <main>
      <span>Starting NextClaw...</span>
    </main>
  </body>
</html>`;

export function createStartupLoadingUrl(): string {
  return `data:text/html;charset=utf-8,${encodeURIComponent(startupLoadingHtml)}`;
}
