/**
 * Cross-Tab Synchronization via BroadcastChannel & Storage Events.
 * Simulates real-time collaboration between multiple open browser tabs.
 */

export interface BroadcastMessage {
  type: string;
  payload: any;
  timestamp: number;
  tabId: string;
}

let channel: BroadcastChannel | null = null;

try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    channel = new BroadcastChannel('taskflow_pro_sync_channel');
  }
} catch {
  console.warn('TaskFlow: BroadcastChannel not supported in this environment');
}

export function broadcastEvent(type: string, payload: any): void {
  const message: BroadcastMessage = {
    type,
    payload,
    timestamp: Date.now(),
    tabId: Math.random().toString(36).substring(7),
  };

  if (channel) {
    try {
      channel.postMessage(message);
    } catch (err) {
      console.warn('TaskFlow: broadcast error', err);
    }
  }
}

export function subscribeToBroadcast(callback: (data: BroadcastMessage) => void): () => void {
  if (!channel) return () => {};

  const handler = (event: MessageEvent<BroadcastMessage>) => {
    if (event.data) {
      callback(event.data);
    }
  };

  channel.addEventListener('message', handler);
  return () => {
    channel?.removeEventListener('message', handler);
  };
}
