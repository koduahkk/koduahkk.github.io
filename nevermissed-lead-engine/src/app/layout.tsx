import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "NeverMissed Lead Engine", template: "%s · NeverMissed Lead Engine" },
  description: "Find salons, prove they miss calls, and run outreach for the NeverMissed AI Receptionist.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#4f46e5" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        {children}
        <Toaster richColors position="top-center" closeButton />
      </body>
    </html>
  );
}
