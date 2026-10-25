"use client";

import { useState, useCallback, useEffect } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

let globalAddToast: ((toast: Omit<Toast, "id">) => void) | null = null;

export function toast(t: Omit<Toast, "id">) {
  if (globalAddToast) globalAddToast(t);
}

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};
const STYLES = {
  success: "border-emerald-500/40 bg-[#0b1221] text-emerald-300 shadow-[0_0_16px_rgba(16,185,129,0.12)]",
  error:   "border-rose-500/40 bg-[#0b1221] text-rose-300 shadow-[0_0_16px_rgba(239,68,68,0.12)]",
  warning: "border-amber-500/40 bg-[#0b1221] text-amber-300 shadow-[0_0_16px_rgba(245,158,11,0.12)]",
  info:    "border-[rgba(34,211,238,0.35)] bg-[#0b1221] text-[#22d3ee] shadow-[0_0_16px_rgba(34,211,238,0.12)]",
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const add = useCallback((t: Omit<Toast, "id">) => {
    const id = `toast_${Date.now()}`;
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4500);
  }, []);

  useEffect(() => { globalAddToast = add; return () => { globalAddToast = null; }; }, [add]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => {
        const Icon = ICONS[t.type];
        return (
          <div
            key={t.id}
            className={cn(
              "flex items-start gap-3 p-4 rounded-xl border shadow-2xl backdrop-blur-sm animate-in slide-in-from-right-4",
              STYLES[t.type]
            )}
          >
            <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{t.title}</p>
              {t.message && <p className="text-xs opacity-75 mt-0.5">{t.message}</p>}
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="opacity-50 hover:opacity-100 flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
