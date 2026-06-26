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

export const TOAST_DEFAULTS = {
  /** Standard auto-dismiss duration in ms. */
  duration: 3000,
  /** Longer duration for destructive / error messages so users can read them. */
  errorDuration: 5000,
  /** Persistent toasts (loading states) should not auto-close. */
  loadingDuration: Infinity,
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
export type NotifyOptions = Omit<ExternalToast, "closeButton">;

/** Return type of every imperative toast call (sonner toast id). */
export type NotifyId = string | number;

function withDefaults(
  opts?: NotifyOptions,
  duration: number = TOAST_DEFAULTS.duration,
): ExternalToast {
  return {
    duration,
    closeButton: TOAST_DEFAULTS.closeButton,
    ...opts,
  };
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
  success: (message, opts) => sonnerToast.success(message, withDefaults(opts)),
  info: (message, opts) => sonnerToast.info(message, withDefaults(opts)),
  warning: (message, opts) => sonnerToast.warning(message, withDefaults(opts)),
  error: (message, opts) =>
    sonnerToast.error(message, withDefaults(opts, TOAST_DEFAULTS.errorDuration)),
  message: (message, opts) => sonnerToast(message, withDefaults(opts)),
  loading: (message, opts) =>
    sonnerToast.loading(message, { ...opts, duration: TOAST_DEFAULTS.loadingDuration }),
  promise: sonnerToast.promise.bind(sonnerToast),
  dismiss: sonnerToast.dismiss.bind(sonnerToast),
};

// Re-export the raw toast and sonner option types for edge cases.
export { sonnerToast as toast };
export type { ExternalToast };

