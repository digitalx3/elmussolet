import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      richColors
      closeButton
      visibleToasts={3}
      duration={3000}
      gap={12}
      expand={false}
      // Center vertically in the viewport (sonner has no native center-center).
      style={{
        top: "50%",
        left: "50%",
        right: "auto",
        bottom: "auto",
        transform: "translate(-50%, -50%)",
        width: "min(90vw, 420px)",
      }}
      toastOptions={{
        duration: 3000,

        classNames: {
          toast:
            "group toast group-[.toaster]:shadow-2xl group-[.toaster]:border group-[.toaster]:rounded-xl group-[.toaster]:p-4 group-[.toaster]:text-base group-[.toaster]:animate-in group-[.toaster]:fade-in-0 group-[.toaster]:zoom-in-95 group-[.toaster]:slide-in-from-top-2 data-[swipe=move]:transition-transform data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          title: "group-[.toast]:text-base group-[.toast]:font-semibold",
          description: "group-[.toast]:text-sm group-[.toast]:opacity-90",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          closeButton: "group-[.toast]:bg-background group-[.toast]:text-foreground group-[.toast]:border-border",
        },
      }}

      {...props}
    />
  );
};

export { Toaster, toast };
