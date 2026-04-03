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
    /* Site variables */
    --c-bg: #0a0a0f;
    --c-text: #e4e4e7;
    --c-text-dim: #71717a;
    --c-border: #27272a;
    --c-accent: #4d9fff;
    --c-accent-hover: #6bb3ff;
    --c-hover: rgba(255,255,255,0.04);
    --c-surface: #111118;

    /* MOLTamp chrome variables (what widgets actually use) */
    --c-chrome-bg: #0a0a0f;
    --c-chrome-text: #e4e4e7;
    --c-chrome-accent: #4d9fff;
    --c-chrome-border: #27272a;
    --c-chrome-dim: #71717a;
    --c-chrome-hover: rgba(255,255,255,0.04);

    /* MOLTamp terminal/ANSI colors */
    --t-foreground: #e4e4e7;
    --t-background: #0a0a0f;
    --t-black: #1a1a2e;
    --t-red: #f87171;
    --t-green: #4ade80;
    --t-yellow: #facc15;
    --t-blue: #60a5fa;
    --t-magenta: #c084fc;
    --t-cyan: #22d3ee;
    --t-white: #e4e4e7;

    /* Fonts */
    --font-terminal: 'Berkeley Mono', 'JetBrains Mono', 'Fira Code', monospace;
    --font-chrome: 'Inter', -apple-system, sans-serif;
    --font-mono: 'Berkeley Mono', 'JetBrains Mono', 'Fira Code', monospace;

    color-scheme: dark;
  }
  html, body {
    margin: 0;
    padding: 8px;
    background: var(--c-chrome-bg);
    color: var(--c-chrome-text);
    font-family: var(--font-terminal);
    font-size: 11px;
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
  window.__MOLTAMP_WIDGET_ID__ = 'preview';
  window.moltamp = {
    call: function() { return Promise.resolve(null); },
    subscribe: function(s, sel, cb) { return function() {}; },
    settings: { read: function() { return Promise.resolve({}); }, write: function() { return Promise.resolve(); } },
    onKeyDown: function() {},
    onKeyUp: function() {},
    meta: { id: 'preview', name: 'Preview', context: 'preview' },
    el: function(tag, s, ch) {
      var n = document.createElement(tag);
      if (s) for (var k in s) n.style[k] = s[k];
      if (ch != null) { if (Array.isArray(ch)) ch.forEach(function(c) { n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }); else if (typeof ch === 'string') n.textContent = ch; else n.appendChild(ch); }
      return n;
    },
    poll: function(ms, fn) { try { fn(); } catch(e) {} var id = setInterval(function() { try { fn(); } catch(e) {} }, ms); return function() { clearInterval(id); }; },
    fmt: {
      number: function(n, d) { d = d || 0; return Number(n).toFixed(d); },
      bytes: function(b) { if (b < 1024) return b + ' B'; if (b < 1048576) return (b/1024).toFixed(1) + ' KB'; return (b/1048576).toFixed(1) + ' MB'; },
      duration: function(s) { var m = Math.floor(s/60); s = Math.floor(s%60); return m > 0 ? m+'m '+s+'s' : s+'s'; },
      pct: function(n, d) { return (n * 100).toFixed(d || 1) + '%'; }
    }
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
