// Loaded only by the isolated review launcher, never by the deployed app.
import { appendFileSync } from 'node:fs';
if (process.env.FAMORES_LOCAL_REVIEW !== 'yes' || !process.env.FAMORES_REVIEW_MAILBOX) {
  throw new Error('This preload requires the isolated local review launcher.');
}
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url || input.href);
  if (url.origin === 'https://mail.famores-review.test' && ['/accounts', '/notifications'].includes(url.pathname)) {
    const payload = JSON.parse(String(options.body || '{}'));
    if (payload.recipient && !payload.recipient.endsWith('@example.test')) {
      throw new Error('Use only fictional @example.test mailboxes in local review.');
    }
    appendFileSync(process.env.FAMORES_REVIEW_MAILBOX, JSON.stringify({ channel: url.pathname, ...payload }) + '\n', { mode: 0o600 });
    return Response.json({ capturedLocally: true });
  }
  throw new Error('Local review blocks external requests and payments. Flow Sandbox needs a separate configured environment.');
};
