interface Env {
  DB: D1Database;
}

/**
 * Dynamic content endpoint — called by every MOLTamp install on launch.
 * Reads from admin_content table (managed via /admin panel).
 * Falls back to hardcoded defaults if the table is empty.
 *
 * GET /api/content?v=<version>&h=<integrity_hash>
 */

// Hardcoded defaults — only used if admin_content table is empty
const DEFAULTS = {
  nag_messages: [
    { headline: "Enjoying MOLTamp?", body: "This is the free version. All features work — this popup is the only difference.", cta: "Unlock for $20" },
    { headline: "Still here?", body: "You clearly like MOLTamp. One payment, no subscriptions, no tracking — just this popup, gone forever.", cta: "Remove this popup — $20" },
    { headline: "MOLTamp is worth it.", body: "You've been using every feature for free. The only thing $20 buys is never seeing this again.", cta: "Pay once, nag never" },
    { headline: "Support indie software.", body: "MOLTamp is self-funded and built with love. $20 keeps the lights on and kills this popup.", cta: "Back the project — $20" },
    { headline: "No VC. No ads. Just vibes.", body: "MOLTamp is self-funded, open-source friendly, and community-driven. This popup is how it stays that way.", cta: "Support the craft — $20" },
    { headline: "Small team. Big vibes. One ask.", body: "No investors, no recurring fees. Just a small team that made something cool and is asking for a coffee-and-a-half.", cta: "Buy the team a coffee+ — $20" },
    { headline: "This popup is the product.", body: "Everything else is free. The skins, the panels, the terminal — all yours. You're just paying to make this go away.", cta: "$20 to never see this again" },
    { headline: "Quick math.", body: "You've spent more time dismissing this popup than it takes to buy a license. Just saying.", cta: "Fine, take my $20" },
    { headline: "We meet again.", body: "You know how this ends. You wait, you dismiss, you forget, and I come back. Break the cycle.", cta: "End the loop — $20" },
    { headline: "I'm not mad. Just disappointed.", body: "You've been using MOLTamp for free this whole time. I'm a popup. I have feelings too.", cta: "Apologize with $20" },
    { headline: "You could've bought it by now.", body: "Every time you dismiss this, you're choosing to see it again later. That's a weird flex but okay.", cta: "Make the smart choice — $20" },
    { headline: "Your cockpit deserves better.", body: "You've got the skins, the panels, the whole aesthetic dialed in — except for this popup interrupting your flow.", cta: "Complete the experience — $20" },
    { headline: "Imagine this, but without me.", body: "Picture your perfect MOLTamp session. Custom skin, panels arranged just right, terminal humming. Now remove this popup from the picture.", cta: "Make it real — $20" },
    { headline: "No subscription. No catch.", body: "One payment. Works offline. No account required. No telemetry. You own it. The only thing $20 changes is this popup disappears.", cta: "Own it for $20" },
    { headline: "Less than a month of Netflix.", body: "Except this is forever, works offline, and doesn't ask you to pick a profile every time you open it.", cta: "Better deal — $20" },
  ],
  nag_config: { interval_min: 15, interval_max: 20, dismiss_delay: 7 },
  whats_new: [],
  update: { latest: "2.7.0", notes: "You're on the latest version.", url: "https://moltamp.com" },
  notifications: [] as { id: string; type: string; message: string; url?: string; expires?: string }[],
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const version = url.searchParams.get("v") || "unknown";
  const hash = url.searchParams.get("h") || "unknown";
  const { DB } = context.env;

  // Log integrity hash for analytics (non-blocking)
  context.waitUntil(
    DB.prepare(
      `INSERT INTO integrity_log (version, hash) VALUES (?, ?)`,
    )
      .bind(version, hash)
      .run()
      .catch(() => {}),
  );

  // Read admin-managed content from D1
  let adminContent: Record<string, unknown> = {};
  try {
    const row = await DB.prepare(
      "SELECT content_json FROM admin_content WHERE id = 1",
    ).first<{ content_json: string }>();
    if (row?.content_json) {
      adminContent = JSON.parse(row.content_json);
    }
  } catch { /* use defaults */ }

  // Count total licensed users for social proof
  let userCount = 0;
  try {
    const row = await DB.prepare(
      `SELECT COUNT(*) as count FROM licenses WHERE revoked_at IS NULL`,
    ).first<{ count: number }>();
    userCount = row?.count ?? 0;
  } catch { /* non-fatal */ }

  // Merge: admin content wins over defaults, social is always live
  const content = {
    nag_messages: hasItems(adminContent.nag_messages) ? adminContent.nag_messages : DEFAULTS.nag_messages,
    nag_config: adminContent.nag_config || DEFAULTS.nag_config,
    whats_new: hasItems(adminContent.whats_new) ? adminContent.whats_new : DEFAULTS.whats_new,
    update: adminContent.update || DEFAULTS.update,
    notifications: Array.isArray(adminContent.notifications) ? adminContent.notifications : DEFAULTS.notifications,
    social: { users: userCount > 0 ? userCount : 1 },
    // Version deprecation (only if admin set it)
    ...(adminContent.min_version ? { min_version: adminContent.min_version } : {}),
    ...(adminContent.upgrade_message ? { upgrade_message: adminContent.upgrade_message } : {}),
    ...(adminContent.upgrade_url ? { upgrade_url: adminContent.upgrade_url } : {}),
    // Domain migration redirects (only if admin set them)
    ...(adminContent.redirect_content_url ? { redirect_content_url: adminContent.redirect_content_url } : {}),
    ...(adminContent.redirect_version_url ? { redirect_version_url: adminContent.redirect_version_url } : {}),
  };

  return Response.json(content, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
};

function hasItems(val: unknown): val is unknown[] {
  return Array.isArray(val) && val.length > 0;
}
