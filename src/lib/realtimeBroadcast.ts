/**
 * realtimeBroadcast.ts — send a small "something changed" message to other browsers.
 *
 * WHY: the old code did `supabase.channel(name).subscribe(...)` for EVERY message. This Supabase
 * version returns the SAME channel object when the name already exists, and subscribing an
 * already-subscribed channel throws — so most messages were silently lost, and on pages without
 * a listener a new channel stayed open forever.
 *
 * Now:
 *  - if this tab already has that channel joined (because it is listening), we send through it;
 *  - otherwise we send ONE short HTTP request (no websocket connection, nothing left open).
 * Messages only carry small payloads (ids, status), never whole rows.
 */
import { supabase } from '../supabaseClient';

export async function sendRealtimeBroadcast(topic: string, event: string, payload: Record<string, unknown>): Promise<void> {
  try {
    const existing = supabase.getChannels().find((c: any) => c.topic === `realtime:${topic}`) as any;
    if (existing && existing.state === 'joined') {
      await existing.send({ type: 'broadcast', event, payload });
      return;
    }
    // Not joined here → one-off HTTP send, then forget the channel object.
    const temp: any = existing || supabase.channel(topic);
    try {
      if (typeof temp.httpSend === 'function') await temp.httpSend(event, payload);
      else await temp.send({ type: 'broadcast', event, payload });
    } finally {
      if (!existing) supabase.removeChannel(temp);
    }
  } catch (err) {
    // A lost "refresh hint" is not data loss: every screen also refreshes on its own timer.
    console.warn(`[realtime] broadcast "${event}" not sent:`, err);
  }
}
