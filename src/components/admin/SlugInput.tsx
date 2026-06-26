import * as React from "react";
import { AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { isSlug, normalizeSlugInput } from "@/lib/slug";

export interface SlugInputProps {
  value: string;
  onChange: (next: string) => void;
  label?: string;
  hint?: string;
  placeholder?: string;
  /** Allow empty (auto-generated on save). Default true. */
  allowEmpty?: boolean;
  id?: string;
  className?: string;
  /** Notifies parent of validity (debounced to onBlur + onChange). */
  onValidityChange?: (valid: boolean, message: string | null) => void;
  /**
   * External error message (e.g. duplicate slug detected). Takes precedence
   * over the format validator and is displayed even before the user blurs.
   */
  externalError?: string | null;
}

/**
 * Validates a slug value and returns a localized error message or null.
 * Centralizes the rule used across all admin forms.
 */
export function validateSlugValue(value: string, allowEmpty = true): string | null {
  const v = (value ?? "").trim();
  if (!v) return allowEmpty ? null : "El slug és obligatori";
  if (v.length > 80) return "Massa llarg (màx. 80 caràcters)";
  if (!isSlug(v)) {
    return "Només minúscules, números i guions; no pot començar/acabar amb guió";
  }
  return null;
}

/**
 * Reusable slug input with live normalization + inline validation.
 * - Live typing: strips invalid chars (keeps trailing dash while typing).
 * - On blur: runs strict validation and surfaces an inline error.
 */
export function SlugInput({
  value,
  onChange,
  label,
  hint,
  placeholder,
  allowEmpty = true,
  id,
  className,
  onValidityChange,
  externalError,
}: SlugInputProps) {
  const [touched, setTouched] = React.useState(false);
  const formatError = touched ? validateSlugValue(value, allowEmpty) : null;
  const error = externalError || formatError;

  React.useEffect(() => {
    if (!onValidityChange) return;
    const msg = validateSlugValue(value, allowEmpty);
    onValidityChange(msg === null, msg);
  }, [value, allowEmpty, onValidityChange]);

  const inputId = id ?? React.useId();

  return (
    <div className={className}>
      {label ? <Label htmlFor={inputId}>{label}</Label> : null}
      <Input
        id={inputId}
        value={value}
        onChange={(e) => onChange(normalizeSlugInput(e.target.value))}
        onBlur={() => setTouched(true)}
        placeholder={placeholder}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-err` : undefined}
        className={cn(error && "border-destructive focus-visible:ring-destructive")}
      />
      {error ? (
        <p
          id={`${inputId}-err`}
          className="mt-1 flex items-center gap-1 text-[11px] text-destructive"
        >
          <AlertCircle className="h-3 w-3" /> {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
