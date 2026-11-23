"use client";
/**
 * Twilio browser calling (Voice JS SDK), used when enabled in Settings and
 * Twilio is configured. The SDK is loaded lazily so it never weighs down the
 * default tel: flow.
 */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Phone, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";

type Call = { disconnect(): void; on(ev: string, fn: () => void): void };
type Device = { connect(o: { params: Record<string, string> }): Promise<Call>; destroy(): void };

export function BrowserDialer({ to, onBeforeCall, disabled }: { to: string; onBeforeCall: () => Promise<boolean>; disabled?: boolean }) {
  const device = useRef<Device | null>(null);
  const [call, setCall] = useState<Call | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => () => device.current?.destroy(), []);

  async function dial() {
    setBusy(true);
    try {
      if (!(await onBeforeCall())) return;
      if (!device.current) {
        const res = await fetch("/api/twilio/token", { method: "POST" });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn't get a calling token");
        const { token } = await res.json();
        const { Device } = await import("@twilio/voice-sdk");
        device.current = new Device(token, { logLevel: "error" }) as unknown as Device;
      }
      const c = await device.current.connect({ params: { To: to } });
      c.on("disconnect", () => setCall(null));
      setCall(c);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Call failed");
    } finally {
      setBusy(false);
    }
  }

  return call ? (
    <Button size="lg" variant="destructive" className="h-14 text-lg" onClick={() => call.disconnect()}>
      <PhoneOff /> Hang up
    </Button>
  ) : (
    <Button size="lg" className="h-14 text-lg" onClick={dial} disabled={busy || disabled}>
      {busy ? <Loader2 className="animate-spin" /> : <Phone />} Call in browser
    </Button>
  );
}
