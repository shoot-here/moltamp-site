/**
 * Extract skin colors from raw CSS text.
 * Ported from moltamp/src/lib/skin-colors.ts for Cloudflare Workers.
 */

export interface ExtractedColors {
  accent: string;
  chromeBg: string;
  chromeBorder: string;
  chromeDim: string;
  chromeText: string;
  chromeHover: string;
  foreground: string;
  background: string;
  cursor: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
  scanlines: boolean;
  glow: boolean;
  crt: boolean;
  glowColor: string;
}

function extractVar(css: string, varName: string): string | null {
  const escaped = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*:\\s*([^;]+);`));
  return match ? match[1].trim() : null;
}

/** Default colors matching the obsidian (default) skin. */
const DEFAULTS: ExtractedColors = {
  accent: '#d4a036',
  chromeBg: '#0a0a0f',
  chromeBorder: '#1a1a2e',
  chromeDim: '#606070',
  chromeText: '#9898a8',
  chromeHover: '#1e1e32',
  foreground: '#e0e0e8',
  background: '#0a0a0f',
  cursor: '#d4a036',
  black: '#1a1a2e',
  red: '#d43636',
  green: '#36d480',
  yellow: '#d4a036',
  blue: '#3678d4',
  magenta: '#a036d4',
  cyan: '#36b5d4',
  white: '#e0e0e8',
  brightBlack: '#3a3a52',
  brightRed: '#ff5555',
  brightGreen: '#50fa7b',
  brightYellow: '#f1c232',
  brightBlue: '#6299e6',
  brightMagenta: '#c678dd',
  brightCyan: '#56d4ef',
  brightWhite: '#ffffff',
  scanlines: false,
  glow: false,
  crt: false,
  glowColor: 'rgba(212,160,54,0.15)',
};

/** CSS variable name → ExtractedColors key mapping. */
const VAR_MAP: Record<string, keyof ExtractedColors> = {
  '--c-chrome-accent': 'accent',
  '--c-chrome-bg': 'chromeBg',
  '--c-chrome-border': 'chromeBorder',
  '--c-chrome-dim': 'chromeDim',
  '--c-chrome-text': 'chromeText',
  '--c-chrome-hover': 'chromeHover',
  '--t-foreground': 'foreground',
  '--t-background': 'background',
  '--t-cursor': 'cursor',
  '--t-black': 'black',
  '--t-red': 'red',
  '--t-green': 'green',
  '--t-yellow': 'yellow',
  '--t-blue': 'blue',
  '--t-magenta': 'magenta',
  '--t-cyan': 'cyan',
  '--t-white': 'white',
  '--t-bright-black': 'brightBlack',
  '--t-bright-red': 'brightRed',
  '--t-bright-green': 'brightGreen',
  '--t-bright-yellow': 'brightYellow',
  '--t-bright-blue': 'brightBlue',
  '--t-bright-magenta': 'brightMagenta',
  '--t-bright-cyan': 'brightCyan',
  '--t-bright-white': 'brightWhite',
};

export function extractColorsFromCSS(css: string): ExtractedColors {
  const colors = { ...DEFAULTS };

  for (const [cssVar, key] of Object.entries(VAR_MAP)) {
    const value = extractVar(css, cssVar);
    if (value) {
      (colors as Record<string, string | boolean>)[key] = value;
    }
  }

  // Effects
  const scanlines = extractVar(css, '--effect-scanlines');
  if (scanlines) colors.scanlines = parseFloat(scanlines) > 0;

  const glow = extractVar(css, '--effect-glow');
  if (glow) colors.glow = parseFloat(glow) > 0;

  const crt = extractVar(css, '--effect-crt');
  if (crt) colors.crt = parseFloat(crt) > 0;

  const glowColor = extractVar(css, '--c-glow');
  if (glowColor) colors.glowColor = glowColor;

  return colors;
}
