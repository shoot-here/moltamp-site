/**
 * Shared MiniTerminal skin card renderer.
 * Used by gallery grid + author pages.
 * Cards are preview-dominant: MiniTerminal fills the card, name overlays at bottom.
 */

function renderSkinCard(skin) {
  const c = skin.colors;
  const screenshotUrl = `/api/skins/${skin.skin_id}/screenshots/0`;

  return `
  <a href="/skins/view?id=${skin.skin_id}" class="skin-card mt-sm" style="background:${c.chromeBg};border-color:${c.chromeBorder}">
    <div class="mini-terminal" style="background:${c.chromeBg}">
      <div class="mt-titlebar" style="border-bottom:1px solid ${c.chromeBorder}">
        <div class="mt-dots"><span style="background:#ff5f57"></span><span style="background:#febc2e"></span><span style="background:#28c840"></span></div>
        <div class="mt-title" style="color:${c.chromeDim}">${skin.name}</div>
      </div>
      <div class="mt-vibes" style="background:linear-gradient(90deg,${c.chromeBg},${c.accent}22,${c.chromeBg});border-bottom:1px solid ${c.chromeBorder}"></div>
      <div class="mt-deck">
        <div class="mt-panel-left" style="border-right:1px solid ${c.chromeBorder}">
          <div class="mt-nav-item"><span class="mt-nav-dot" style="background:${c.accent};opacity:0.8"></span><span class="mt-nav-bar" style="background:${c.accent};opacity:0.5"></span></div>
          <div class="mt-nav-item"><span class="mt-nav-dot" style="background:${c.chromeDim};opacity:0.4"></span><span class="mt-nav-bar" style="background:${c.chromeDim};opacity:0.25"></span></div>
          <div class="mt-nav-item"><span class="mt-nav-dot" style="background:${c.chromeDim};opacity:0.4"></span><span class="mt-nav-bar" style="background:${c.chromeDim};opacity:0.25"></span></div>
        </div>
        <div class="mt-term" style="background:${c.background}">
          <div class="mt-line"><span style="color:${c.green}">$</span><span style="color:${c.foreground}"> deploy </span><span style="color:${c.cyan}">--prod</span></div>
          <div class="mt-line" style="color:${c.yellow}">building...</div>
          <div class="mt-line" style="color:${c.green}">deployed</div>
          <div class="mt-ansi">
            <div class="mt-ansi-row">
              ${[c.black,c.red,c.green,c.yellow,c.blue,c.magenta,c.cyan,c.white].map(col => '<span style="background:'+col+'"></span>').join('')}
            </div>
            <div class="mt-ansi-row">
              ${[c.brightBlack,c.brightRed,c.brightGreen,c.brightYellow,c.brightBlue,c.brightMagenta,c.brightCyan,c.brightWhite].map(col => '<span style="background:'+col+'"></span>').join('')}
            </div>
          </div>
          <div class="mt-line"><span style="color:${c.accent}">></span><span style="color:${c.cursor}"> _</span></div>
        </div>
        <div class="mt-panel-right" style="border-left:1px solid ${c.chromeBorder}">
          <div class="mt-gauge" style="border-color:${c.chromeBorder};border-top-color:${c.accent}"></div>
          <div class="mt-bar-sm" style="background:${c.chromeDim};opacity:0.3"></div>
          <div class="mt-bar-sm" style="background:${c.accent};opacity:0.2;width:60%"></div>
        </div>
      </div>
      <div class="mt-status" style="border-top:1px solid ${c.chromeBorder};color:${c.chromeDim}">
        <span class="mt-status-dot" style="background:${c.accent}"></span>
        <span class="mt-status-name">${skin.skin_id}</span>
        <span class="mt-status-sep">|</span>
        <span class="mt-status-badge" style="background:${c.accent}22;color:${c.accent}">opus</span>
        <span class="mt-status-spacer"></span>
        <span class="mt-status-meter" style="background:${c.chromeDim}33"><span style="width:42%;background:${c.accent};opacity:0.6"></span></span>
      </div>
      ${c.scanlines ? '<div class="mt-scanlines"></div>' : ''}
      ${c.glow ? '<div class="mt-glow" style="box-shadow:inset 0 0 12px '+c.glowColor+'"></div>' : ''}
    </div>
    <div class="skin-card-overlay" style="background:linear-gradient(transparent 40%, ${c.chromeBg}ee 100%)">
      <span class="skin-card-name" style="color:${c.accent}">${skin.name}</span>
    </div>
    <div class="skin-card-hover" style="background:${c.chromeBg}dd">
      <span class="hover-author" style="color:${c.chromeText || c.chromeDim}">by ${skin.author_name}</span>
      <span class="hover-downloads" style="color:${c.chromeDim}">${skin.download_count > 0 ? skin.download_count + ' downloads' : 'New'}</span>
    </div>
  </a>`;
}
