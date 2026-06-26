import { toast as sonnerToast, type ExternalToast } from "sonner";

/**
 * Centralized toast configuration for the entire app.
 *
 * Duration, animation and close behaviour are defined here so every
 * success/info/error/warning notification stays consistent.
 *
 * Visual styling (position, rich colors, close button, animations)
 * is configured in `src/components/ui/sonner.tsx`.
 */

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

type ToastDuration = number;


type NotifyOptions = Omit<ExternalToast, "closeButton">;

function withDefaults(opts?: NotifyOptions, duration: ToastDuration = TOAST_DEFAULTS.duration): ExternalToast {
  return {
    duration,
    closeButton: TOAST_DEFAULTS.closeButton,
    dismissible: true,
    ...opts,
  };
}

export const notify = {
  success: (message: string, opts?: NotifyOptions) =>
    sonnerToast.success(message, withDefaults(opts)),

  info: (message: string, opts?: NotifyOptions) =>
    sonnerToast.info(message, withDefaults(opts)),

  warning: (message: string, opts?: NotifyOptions) =>
    sonnerToast.warning(message, withDefaults(opts)),

  error: (message: string, opts?: NotifyOptions) =>
    sonnerToast.error(message, withDefaults(opts, TOAST_DEFAULTS.errorDuration)),

  message: (message: string, opts?: NotifyOptions) =>
    sonnerToast(message, withDefaults(opts)),

  loading: (message: string, opts?: NotifyOptions) =>
    sonnerToast.loading(message, { ...opts, duration: TOAST_DEFAULTS.loadingDuration }),

  promise: sonnerToast.promise.bind(sonnerToast),

  dismiss: sonnerToast.dismiss.bind(sonnerToast),
};

// Re-export the raw toast for edge cases that need full sonner API.
export { sonnerToast as toast };
