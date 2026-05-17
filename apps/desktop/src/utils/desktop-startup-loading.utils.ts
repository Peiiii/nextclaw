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
      }

      main {
        display: flex;
        align-items: center;
        gap: 14px;
        font-size: 15px;
        font-weight: 600;
      }

      .mark {
        width: 42px;
        height: 42px;
        border-radius: 10px;
        display: grid;
        place-items: center;
        background: #1f1d1a;
        color: #f8c646;
        font-size: 24px;
        font-weight: 800;
      }
    </style>
  </head>
  <body>
    <main>
      <div class="mark">Y</div>
      <span>Starting NextClaw...</span>
    </main>
  </body>
</html>`;

export function createStartupLoadingUrl(): string {
  return `data:text/html;charset=utf-8,${encodeURIComponent(startupLoadingHtml)}`;
}
