import { supportAutoReplyHtml, sendEmail } from './_shared/emails';

interface Env {
  RESEND_API_KEY: string;
}

/**
 * POST /api/support-inbound — Resend inbound email webhook.
 *
 * When someone emails support@moltamp.com, Resend forwards the payload here.
 * We send a branded auto-reply so the user knows their message was received.
 *
 * Setup in Resend dashboard:
 *   Domain → moltamp.com → Inbound → Add webhook → https://moltamp.com/api/support-inbound
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { RESEND_API_KEY } = context.env;

  if (!RESEND_API_KEY) {
    return new Response('Email not configured', { status: 503 });
  }

  let payload: {
    from: string;
    to: string;
    subject: string;
    text?: string;
    html?: string;
  };

  try {
    payload = await context.request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const senderEmail = payload.from;
  if (!senderEmail || !senderEmail.includes('@')) {
    return new Response('No sender', { status: 400 });
  }

  // Don't auto-reply to no-reply addresses, other automated senders, or our own domain
  const lowerFrom = senderEmail.toLowerCase();
  if (
    lowerFrom.includes('noreply') ||
    lowerFrom.includes('no-reply') ||
    lowerFrom.includes('mailer-daemon') ||
    lowerFrom.endsWith('@moltamp.com')
  ) {
    return new Response('Skipped auto-reply', { status: 200 });
  }

  try {
    await sendEmail(RESEND_API_KEY, {
      from: 'MOLTamp Support <support@moltamp.com>',
      to: senderEmail,
      subject: 'Re: ' + (payload.subject || 'Your message to MOLTamp'),
      html: supportAutoReplyHtml(),
    });
    console.log(`Auto-reply sent to ${senderEmail}`);
  } catch (err) {
    console.error('Failed to send auto-reply:', err);
  }

  return new Response('ok', { status: 200 });
};
