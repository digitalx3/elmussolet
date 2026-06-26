import { toast as sonnerToast, type ExternalToast, type ToasterProps } from "sonner";

/**
 * Single source of truth for toast configuration across the app.
 *
 * - `TOASTER_CONFIG` configures the global `<Toaster />` (position, animation, styling).
 * - `notify` wraps the imperative API with consistent duration and close behaviour.
 *
 * The visual `<Toaster />` instance lives in `src/components/ui/sonner.tsx` and
 * just consumes `TOASTER_CONFIG` — never override these values inline.
 */

// ---------- Durations ----------

/** Per-variant auto-dismiss durations in milliseconds. */
export interface ToastDurations {
  success: number;
  info: number;
  warning: number;
  error: number;
  message: number;
  loading: number;
}

const DEFAULT_DURATIONS: ToastDurations = {
  success: 3000,
  info: 3500,
  warning: 4500,
  error: 5500,
  message: 3000,
  loading: Infinity, // persistent until resolved/dismissed
};

/** Live, mutable copy. Use `setToastDurations` to override at runtime. */
export const TOAST_DURATIONS: ToastDurations = { ...DEFAULT_DURATIONS };

/** Override one or more variant durations (e.g. for tests or admin settings). */
export function setToastDurations(overrides: Partial<ToastDurations>) {
  Object.assign(TOAST_DURATIONS, overrides);
}

/** Restore the original defaults. */
export function resetToastDurations() {
  Object.assign(TOAST_DURATIONS, DEFAULT_DURATIONS);
}

export const TOAST_DEFAULTS = {
  /** Standard auto-dismiss duration in ms (alias of success). */
  get duration() {
    return TOAST_DURATIONS.success;
  },
  /** Longer duration for destructive / error messages. */
  get errorDuration() {
    return TOAST_DURATIONS.error;
  },
  /** Persistent toasts (loading states). */
  get loadingDuration() {
    return TOAST_DURATIONS.loading;
  },
  /** Always allow manual close via the close button. */
  closeButton: true,
};


// ---------- Toaster visual config ----------

const TOASTER_STYLE: React.CSSProperties = {
  // Center vertically in the viewport (sonner has no native center-center).
  top: "50%",
  left: "50%",
  right: "auto",
  bottom: "auto",
  transform: "translate(-50%, -50%)",
  width: "min(90vw, 420px)",
};

const TOAST_CLASSNAMES = {
  toast:
    "group toast group-[.toaster]:shadow-2xl group-[.toaster]:border group-[.toaster]:rounded-xl group-[.toaster]:p-4 group-[.toaster]:text-base group-[.toaster]:animate-in group-[.toaster]:fade-in-0 group-[.toaster]:zoom-in-95 group-[.toaster]:slide-in-from-top-2 data-[swipe=move]:transition-transform data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
  title: "group-[.toast]:text-base group-[.toast]:font-semibold",
  description: "group-[.toast]:text-sm group-[.toast]:opacity-90",
  actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
  cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
  closeButton:
    "group-[.toast]:bg-background group-[.toast]:text-foreground group-[.toast]:border-border",
};

export const TOASTER_CONFIG: Partial<ToasterProps> = {
  position: "top-center",
  richColors: true,
  closeButton: TOAST_DEFAULTS.closeButton,
  visibleToasts: 3,
  duration: TOAST_DEFAULTS.duration,
  gap: 12,
  expand: false,
  style: TOASTER_STYLE,
  toastOptions: {
    duration: TOAST_DEFAULTS.duration,
    classNames: TOAST_CLASSNAMES,
  },
};

// ---------- Imperative API ----------

/** Message accepted by every notify.* method (string or JSX). */
export type NotifyMessage = React.ReactNode;

/** Options accepted by notify.* — mirrors sonner's `ExternalToast` minus
 *  fields we own globally (closeButton). */
export type NotifyOptions = Omit<ExternalToast, "closeButton"> & {
  /**
   * Logical key to deduplicate toasts. When provided, a new toast with the
   * same `key` replaces the previous one in place (no stacking duplicates).
   * Useful for messages like "Producto añadido" fired repeatedly in a row.
   */
  key?: string;
  /**
   * When true (default), toasts produced by `success/info/warning/error/message`
   * with the same `message` text within `dedupeWindowMs` reuse the same id.
   * Set to false to always create a fresh toast.
   */
  dedupe?: boolean;
};

/** Return type of every imperative toast call (sonner toast id). */
export type NotifyId = string | number;

/** Window during which an identical message is treated as a duplicate. */
const DEDUPE_WINDOW_MS = 1500;

type DedupeEntry = { id: NotifyId; ts: number };
const dedupeRegistry = new Map<string, DedupeEntry>();

function dedupeKey(variant: string, key: string | undefined, message: NotifyMessage): string {
  if (key) return `k:${variant}:${key}`;
  if (typeof message === "string") return `m:${variant}:${message}`;
  return ""; // non-string messages without a key are not deduplicated
}

function resolveId(variant: string, opts: NotifyOptions | undefined, message: NotifyMessage): {
  id: NotifyId | undefined;
  registryKey: string;
} {
  if (opts?.id !== undefined) return { id: opts.id, registryKey: "" };
  if (opts?.dedupe === false) return { id: undefined, registryKey: "" };
  const registryKey = dedupeKey(variant, opts?.key, message);
  if (!registryKey) return { id: undefined, registryKey: "" };
  const existing = dedupeRegistry.get(registryKey);
  if (existing && Date.now() - existing.ts < DEDUPE_WINDOW_MS) {
    return { id: existing.id, registryKey };
  }
  return { id: undefined, registryKey };
}

function rememberId(registryKey: string, id: NotifyId) {
  if (!registryKey) return;
  dedupeRegistry.set(registryKey, { id, ts: Date.now() });
}

function withDefaults(
  opts: NotifyOptions | undefined,
  duration: number,
  id: NotifyId | undefined,
): ExternalToast {
  const { key: _key, dedupe: _dedupe, ...rest } = opts ?? {};
  return {
    duration,
    closeButton: TOAST_DEFAULTS.closeButton,
    ...rest,
    ...(id !== undefined ? { id } : {}),
  };
}

function emit(
  variant: "success" | "info" | "warning" | "error" | "message" | "loading",
  fn: (m: NotifyMessage, o: ExternalToast) => NotifyId,
  message: NotifyMessage,
  opts: NotifyOptions | undefined,
  duration: number,
): NotifyId {
  const { id, registryKey } = resolveId(variant, opts, message);
  const finalId = fn(message, withDefaults(opts, duration, id));
  rememberId(registryKey, finalId);
  return finalId;
}

export interface Notify {
  success: (message: NotifyMessage, opts?: NotifyOptions) => NotifyId;
  info: (message: NotifyMessage, opts?: NotifyOptions) => NotifyId;
  warning: (message: NotifyMessage, opts?: NotifyOptions) => NotifyId;
  error: (message: NotifyMessage, opts?: NotifyOptions) => NotifyId;
  message: (message: NotifyMessage, opts?: NotifyOptions) => NotifyId;
  loading: (message: NotifyMessage, opts?: NotifyOptions) => NotifyId;
  promise: typeof sonnerToast.promise;
  dismiss: typeof sonnerToast.dismiss;
}

export const notify: Notify = {
  success: (message, opts) =>
    emit("success", sonnerToast.success, message, opts, TOAST_DURATIONS.success),
  info: (message, opts) =>
    emit("info", sonnerToast.info, message, opts, TOAST_DURATIONS.info),
  warning: (message, opts) =>
    emit("warning", sonnerToast.warning, message, opts, TOAST_DURATIONS.warning),
  error: (message, opts) =>
    emit("error", sonnerToast.error, message, opts, TOAST_DURATIONS.error),
  message: (message, opts) =>
    emit("message", (m, o) => sonnerToast(m, o), message, opts, TOAST_DURATIONS.message),
  loading: (message, opts) =>
    emit("loading", sonnerToast.loading, message, opts, TOAST_DURATIONS.loading),
  promise: sonnerToast.promise.bind(sonnerToast),
  dismiss: sonnerToast.dismiss.bind(sonnerToast),
};



// Re-export the raw toast and sonner option types for edge cases.
export { sonnerToast as toast };
export type { ExternalToast };

