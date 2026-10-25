"use client";

import { useEffect, useRef, useCallback } from "react";
import type { BroadcastEvent, BroadcastEventType } from "@/lib/broadcast";

type Handler = (event: BroadcastEvent) => void;

export function useSSE(
  role: string,
  handlers: Partial<Record<BroadcastEventType | "init", Handler>>
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    let es: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let retries = 0;

    function connect() {
      es = new EventSource(`/api/events?role=${role}`);

      es.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data) as BroadcastEvent & { type: string };
          const handler = handlersRef.current[event.type as BroadcastEventType | "init"];
          if (handler) handler(event);
        } catch {}
      };

      es.onerror = () => {
        es?.close();
        retries++;
        const delay = Math.min(1000 * Math.pow(2, retries), 30000);
        retryTimeout = setTimeout(connect, delay);
      };

      es.onopen = () => { retries = 0; };
    }

    connect();

    return () => {
      es?.close();
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [role]);
}
