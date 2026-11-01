"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cx } from "./ui";

export type ToastTone = "success" | "error" | "info";
export type Toast = {
  id: number;
  message: string;
  tone: ToastTone;
  action?: { label: string; onClick: () => void };
  duration?: number;
};

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const show = useCallback((t: Omit<Toast, "id">) => {
    const id = nextId.current++;
    // Al massimo 3 avvisi visibili
    setToasts((prev) => [...prev.slice(-2), { ...t, id }]);
    return id;
  }, []);

  return { toasts, show, dismiss };
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const duration = toast.duration ?? (toast.action ? 6000 : 4000);
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), duration);
    return () => clearTimeout(t);
  }, [toast.id, duration, onDismiss]);

  const Icon = toast.tone === "success" ? CheckCircle2 : toast.tone === "error" ? AlertTriangle : Info;
  return (
    <div
      role={toast.tone === "error" ? "alert" : "status"}
      className="anim-toast-in pointer-events-auto flex w-full items-center gap-3 rounded-xl border border-line-strong bg-panel-2 py-2 pr-2 pl-4 shadow-2xl sm:w-[400px]"
    >
      <Icon className={cx("h-5 w-5 shrink-0",
        toast.tone === "success" ? "text-ok" : toast.tone === "error" ? "text-late" : "text-ink-2")} />
      <p className="flex-1 py-1 text-sm text-ink">{toast.message}</p>
      {toast.action && (
        <button
          type="button"
          onClick={() => { toast.action!.onClick(); onDismiss(toast.id); }}
          className="min-h-10 shrink-0 rounded-lg px-3 text-sm font-semibold text-accent hover:bg-panel-3"
        >
          {toast.action.label}
        </button>
      )}
      <button type="button" aria-label="Chiudi avviso" onClick={() => onDismiss(toast.id)}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ink-3 hover:bg-panel-3 hover:text-ink">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ToastViewport({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-end sm:p-5"
    >
      {toasts.map((t) => <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />)}
    </div>
  );
}
