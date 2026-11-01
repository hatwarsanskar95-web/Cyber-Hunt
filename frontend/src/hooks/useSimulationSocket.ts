"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { SimulationEvent } from "@/types/dashboard";
import { getWebSocketUrl, replayEvents } from "@/lib/api";

interface UseSimulationSocketOptions {
  simulationId: string | null;
  onEvent: (event: SimulationEvent) => void;
}

interface SocketState {
  connected: boolean;
  reconnecting: boolean;
  lastSequence: number;
}

const PING_INTERVAL_MS = 25_000;
const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

export function useSimulationSocket({
  simulationId,
  onEvent,
}: UseSimulationSocketOptions): SocketState {
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const lastSequenceRef = useRef(0);
  const [lastSequence, setLastSequence] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const backoffRef = useRef(INITIAL_BACKOFF_MS);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const clearPing = () => {
    if (pingRef.current) {
      clearInterval(pingRef.current);
      pingRef.current = null;
    }
  };

  const clearReconnect = () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  const connect = useCallback((simId: string) => {
    if (unmountedRef.current) return;

    // Replay missed events first, then open WebSocket
    replayEvents(simId, lastSequenceRef.current)
      .then(({ events }) => {
        if (unmountedRef.current) return;
        events.forEach((evt) => {
          if (evt.sequence_number > lastSequenceRef.current) {
            lastSequenceRef.current = evt.sequence_number;
            onEventRef.current(evt);
          }
        });
        setLastSequence(lastSequenceRef.current);
      })
      .catch(() => {/* ignore replay errors — WS will catch up */});

    const url = getWebSocketUrl(simId);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmountedRef.current) { ws.close(); return; }
      setConnected(true);
      setReconnecting(false);
      backoffRef.current = INITIAL_BACKOFF_MS;

      // Heartbeat ping
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, PING_INTERVAL_MS);
    };

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data as string);
        // Ignore pong frames
        if (data?.type === "pong") return;
        const evt = data as SimulationEvent;
        if (evt.sequence_number > lastSequenceRef.current) {
          lastSequenceRef.current = evt.sequence_number;
          setLastSequence(evt.sequence_number);
          onEventRef.current(evt);
        }
      } catch {/* malformed frame — skip */}
    };

    ws.onclose = () => {
      clearPing();
      if (unmountedRef.current) return;
      setConnected(false);
      setReconnecting(true);
      // Exponential backoff reconnect
      const delay = Math.min(backoffRef.current, MAX_BACKOFF_MS);
      backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);
      reconnectTimerRef.current = setTimeout(() => {
        if (!unmountedRef.current) connect(simId);
      }, delay);
    };

    ws.onerror = () => {
      ws.close(); // triggers onclose → reconnect
    };
  }, []);

  useEffect(() => {
    unmountedRef.current = false;
    if (!simulationId) {
      setConnected(false);
      setReconnecting(false);
      return;
    }
    connect(simulationId);

    return () => {
      unmountedRef.current = true;
      clearPing();
      clearReconnect();
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [simulationId, connect]);

  return { connected, reconnecting, lastSequence };
}

