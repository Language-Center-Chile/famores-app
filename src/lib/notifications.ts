import { db } from './commerce';
// Durable outbox. The receiving n8n workflow must deduplicate on eventId.
// No credentials or customer details are included in notifications.
export async function dispatchNotifications() {
  const target = process.env.FAMORES_NOTIFICATION_WEBHOOK;
  const secret = process.env.FAMORES_NOTIFICATION_TOKEN;
  if (!target || !secret) return { sent: 0, pending: true };
  if (new URL(target).protocol !== 'https:') throw new Error('Las notificaciones requieren HTTPS.');
  const pending = db().prepare('SELECT * FROM notifications WHERE deliveredAt IS NULL ORDER BY createdAt LIMIT 20').all();
  let sent = 0;
  for (const event of pending) {
    const response = await fetch(target, { method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${secret}`}, body:JSON.stringify({ eventId:event.id, type:event.type, createdAt:event.createdAt, data:JSON.parse(String(event.payload)) }), signal:AbortSignal.timeout(5000), redirect:'error' });
    if (!response.ok) throw new Error('No fue posible entregar la notificación.');
    db().prepare('UPDATE notifications SET deliveredAt=? WHERE id=?').run(Date.now(),String(event.id)); sent++;
  }
  const remaining = db().prepare('SELECT 1 FROM notifications WHERE deliveredAt IS NULL LIMIT 1').get();
  return { sent, pending: Boolean(remaining) };
}
