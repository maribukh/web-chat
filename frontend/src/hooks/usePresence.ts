import { useEffect, useRef } from 'react';
import { socketService } from '../services/socket';

const AFK_TIMEOUT = 60_000; // 1 minute

/**
 * Detects user activity across tabs using BroadcastChannel.
 * Emits set_afk / set_active to the socket server.
 */
export function usePresence() {
  const statusRef = useRef<'online' | 'afk'>('online');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // BroadcastChannel to sync activity across tabs
  const channelRef = useRef<BroadcastChannel | null>(null);

  const emitStatus = (status: 'online' | 'afk') => {
    if (statusRef.current === status) return;
    statusRef.current = status;
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit(status === 'afk' ? 'set_afk' : 'set_active');
    }
  };

  const resetTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    // Tell other tabs this tab is active
    channelRef.current?.postMessage({ type: 'active' });
    emitStatus('online');
    timerRef.current = setTimeout(() => {
      // Check if AFK should be set — only if no other tab is recently active
      emitStatus('afk');
    }, AFK_TIMEOUT);
  };

  useEffect(() => {
    // BroadcastChannel for cross-tab coordination
    try {
      channelRef.current = new BroadcastChannel('web_chat_presence');
      channelRef.current.onmessage = (e) => {
        if (e.data?.type === 'active') {
          // Another tab is active — reset our local timer without emitting 
          if (timerRef.current) clearTimeout(timerRef.current);
          if (statusRef.current === 'afk') {
            statusRef.current = 'online'; // silent local update; other tab handles socket
          }
          timerRef.current = setTimeout(() => emitStatus('afk'), AFK_TIMEOUT);
        }
      };
    } catch {
      // BroadcastChannel not supported — single tab mode
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));

    resetTimer(); // initialize

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
      channelRef.current?.close();
    };
  }, []);
}
