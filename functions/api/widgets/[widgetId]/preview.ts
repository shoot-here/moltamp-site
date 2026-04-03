interface Env {
  DB: D1Database;
}

/**
 * Dark theme CSS variables injected into widget previews so they render
 * with reasonable defaults even outside the MOLTamp shell.
 */
const THEME_CSS = `
<style>
  :root {
    --c-bg: #0a0a0f;
    --c-text: #e4e4e7;
    --c-text-dim: #71717a;
    --c-border: #27272a;
    --c-accent: #4d9fff;
    --c-accent-hover: #6bb3ff;
    --c-hover: rgba(255,255,255,0.04);
    --c-surface: #111118;
    --t-foreground: #e4e4e7;
    --t-background: #0a0a0f;
    --font-terminal: 'Berkeley Mono', 'JetBrains Mono', 'Fira Code', monospace;
    --font-chrome: 'Inter', -apple-system, sans-serif;
  }
  html, body {
    margin: 0;
    padding: 0;
    background: var(--c-bg);
    color: var(--c-text);
    font-family: var(--font-chrome);
    overflow: hidden;
  }
</style>
`;

/**
 * No-op MOLTamp SDK stub so widgets that call moltamp.call() etc.
 * don't throw errors in the preview iframe.
 */
const SDK_STUB = `
<script>
  window.moltamp = {
    call: function() { return Promise.resolve(null); },
    on: function() {},
    off: function() {},
    emit: function() {},
    getConfig: function() { return Promise.resolve({}); },
    setConfig: function() { return Promise.resolve(); },
    getState: function() { return Promise.resolve({}); },
    subscribe: function() { return function() {}; },
  };
</script>
`;

/**
 * GET /api/widgets/:widgetId/preview
 * Returns the widget's index.html with injected theme variables and SDK stub,
 * suitable for loading in a sandboxed iframe.
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const widgetId = (context.params as Record<string, string>).widgetId;
  const { DB } = context.env;

  const widget = await DB.prepare(
    `SELECT html_content FROM community_widgets
     WHERE widget_id = ? AND status = 'active'
     LIMIT 1`,
  )
    .bind(widgetId)
    .first<{ html_content: string | null }>();

  if (!widget || !widget.html_content) {
    return new Response(
      '<html><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0a0f;color:#71717a;font-family:monospace;font-size:12px;">Preview not available</body></html>',
      {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      },
    );
  }

  // Inject theme CSS and SDK stub before the closing </head> tag,
  // or before the first <script>/<style>/<body> if no </head> exists.
  let html = widget.html_content;
  const injection = THEME_CSS + SDK_STUB;

  if (html.includes('</head>')) {
    html = html.replace('</head>', injection + '</head>');
  } else if (html.includes('<body')) {
    html = html.replace('<body', injection + '<body');
  } else {
    // Fallback: prepend to the document
    html = injection + html;
  }

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; img-src 'self' data: blob:; font-src 'self' data:;",
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
