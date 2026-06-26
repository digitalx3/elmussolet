import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";
import { TOASTER_CONFIG } from "@/lib/notify";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Global toast renderer. All visual configuration lives in
 * `src/lib/notify.ts` (`TOASTER_CONFIG`). Do not override here.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      {...TOASTER_CONFIG}
      {...props}
    />
  );
};

export { Toaster };
// Re-export `toast` from the central helper to keep legacy imports working.
export { toast } from "@/lib/notify";
