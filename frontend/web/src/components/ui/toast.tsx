"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";

// --- Types ---

type ToastVariant = "success" | "error";

interface Toast {
  id: number;
  variant: ToastVariant;
  message: string;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
}

// --- Context ---

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let nextId = 0;

// --- Provider ---

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const add = useCallback(
    (variant: ToastVariant, message: string) => {
      const id = nextId++;
      setToasts((prev) => [...prev, { id, variant, message }]);
      setTimeout(() => remove(id), 3000);
    },
    [remove]
  );

  const success = useCallback((msg: string) => add("success", msg), [add]);
  const error = useCallback((msg: string) => add("error", msg), [add]);

  return (
    <ToastContext.Provider value={{ success, error }}>
      {children}

      {/* Toast container */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm animate-in slide-in-from-right-5"
            style={
              t.variant === "success"
                ? { borderColor: "rgba(74, 222, 128, 0.3)", backgroundColor: "rgba(74, 222, 128, 0.1)", color: "var(--accent)" }
                : { borderColor: "rgba(248, 81, 73, 0.3)", backgroundColor: "rgba(248, 81, 73, 0.1)", color: "var(--danger)" }
            }
          >
            {t.variant === "success" ? (
              <CheckCircle2 className="h-5 w-5 shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 shrink-0" />
            )}
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{t.message}</span>
            <button
              onClick={() => remove(t.id)}
              className="ml-2 shrink-0 cursor-pointer"
              style={{ color: "var(--text-secondary)" }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// --- Hook ---

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
