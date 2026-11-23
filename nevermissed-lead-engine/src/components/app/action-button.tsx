"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action";

export function toastResult(r: ActionResult<unknown>) {
  if (r.ok) toast.success(r.message ?? "Done");
  else toast.error(r.error);
}

/** A button that runs a server action, shows a spinner, toasts the result, and refreshes. */
export function ActionButton({
  action,
  children,
  confirm,
  ...props
}: Omit<ButtonProps, "onClick" | "action"> & { action: () => Promise<ActionResult<unknown>>; confirm?: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      {...props}
      disabled={pending || props.disabled}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        start(async () => {
          const r = await action();
          toastResult(r);
          router.refresh();
        });
      }}
    >
      {pending ? <Loader2 className="animate-spin" /> : null}
      {children}
    </Button>
  );
}
