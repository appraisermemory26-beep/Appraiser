"use client";

import { useEffect, useRef, useCallback } from "react";

export type WsEvent =
  | { type: "connected"; user_id: number }
  | { type: "subscribed"; conversation_id: number }
  | { type: "pong" }
  | { type: "message_new"; message: Record<string, unknown> }
  | { type: "message_updated"; message: Record<string, unknown> }
  | { type: "conversation_new"; conversation: Record<string, unknown> }
  | { type: "conversation_updated"; conversation: Record<string, unknown> }
  | { type: "unread_count"; unread_count: number };

function buildWsUrl(token: string): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const u = new URL(apiUrl);
  const proto = u.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${u.host}/ws/messaging/?token=${encodeURIComponent(token)}`;
}

export function useMessagingWs(onEvent: (e: WsEvent) => void) {
  const handlerRef = useRef(onEvent);
  const socketRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const pingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    handlerRef.current = onEvent;
  }, [onEvent]);

  const connect = useCallback(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("access_token");
    if (!token) return;

    const ws = new WebSocket(buildWsUrl(token));
    socketRef.current = ws;

    ws.onopen = () => {
      retryRef.current = 0;
      pingTimerRef.current = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ action: "ping" }));
        }
      }, 25_000);
    };

    ws.onmessage = (ev) => {
      try {
        const data: WsEvent = JSON.parse(ev.data);
        handlerRef.current(data);
      } catch {
        // ignore malformed payloads
      }
    };

    const cleanup = () => {
      if (pingTimerRef.current) {
        window.clearInterval(pingTimerRef.current);
        pingTimerRef.current = null;
      }
    };

    ws.onclose = (ev) => {
      cleanup();
      socketRef.current = null;
      // Don't auto-reconnect on auth failure
      if (ev.code === 4401) return;
      const delay = Math.min(30_000, 1_000 * 2 ** retryRef.current);
      retryRef.current += 1;
      reconnectTimerRef.current = window.setTimeout(connect, delay);
    };

    ws.onerror = () => {
      // close handler will trigger reconnect
      try { ws.close(); } catch { /* noop */ }
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      if (pingTimerRef.current) window.clearInterval(pingTimerRef.current);
      const s = socketRef.current;
      socketRef.current = null;
      if (s && (s.readyState === WebSocket.OPEN || s.readyState === WebSocket.CONNECTING)) {
        try { s.close(); } catch { /* noop */ }
      }
    };
  }, [connect]);

  const subscribe = useCallback((conversationId: number) => {
    const s = socketRef.current;
    if (!s || s.readyState !== WebSocket.OPEN) return;
    s.send(JSON.stringify({ action: "subscribe", conversation_id: conversationId }));
  }, []);

  return { subscribe };
}
