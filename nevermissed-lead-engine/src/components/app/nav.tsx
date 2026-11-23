"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BarChart3, CalendarClock, Inbox, ListChecks, Menu, PhoneCall, PhoneMissed, Settings, Users, Workflow, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/calls", label: "Today's Calls", icon: CalendarClock },
  { href: "/queue", label: "Call Queue", icon: PhoneCall },
  { href: "/sequences", label: "Sequences", icon: Workflow },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/settings", label: "Settings", icon: Settings },
];

function Links({ onNavigate, badges }: { onNavigate?: () => void; badges: Record<string, number> }) {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.map((n) => {
        const active = path === n.href || path.startsWith(n.href + "/");
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={onNavigate}
            className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors", active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground")}
          >
            <n.icon className="h-4 w-4" aria-hidden />
            <span className="flex-1">{n.label}</span>
            {badges[n.href] ? <span className="rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">{badges[n.href]}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2 px-2 font-semibold">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <PhoneMissed className="h-4 w-4" />
      </span>
      <span className="leading-tight">
        NeverMissed
        <span className="block text-xs font-normal text-muted-foreground">Lead Engine</span>
      </span>
    </Link>
  );
}

type Me = { name: string; role: string };

export function Sidebar({ me, badges, signOut }: { me: Me; badges: Record<string, number>; signOut: () => Promise<void> }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-card p-3 lg:flex">
      <div className="mb-5 mt-1">
        <Brand />
      </div>
      <Links badges={badges} />
      <UserBox me={me} signOut={signOut} />
    </aside>
  );
}

function UserBox({ me, signOut }: { me: Me; signOut: () => Promise<void> }) {
  return (
    <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
      <div className="min-w-0 px-2 text-sm">
        <p className="truncate font-medium">{me.name}</p>
        <p className="text-xs capitalize text-muted-foreground">{me.role.toLowerCase()}</p>
      </div>
      <form action={signOut}>
        <Button variant="ghost" size="icon" aria-label="Sign out">
          <LogOut />
        </Button>
      </form>
    </div>
  );
}

export function MobileBar({ me, badges, signOut }: { me: Me; badges: Record<string, number>; signOut: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-card/95 px-3 backdrop-blur lg:hidden">
      <Brand />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Open menu">
            <Menu />
          </Button>
        </DialogTrigger>
        <DialogContent title="Menu" side="left" className="flex flex-col">
          <div className="mb-4 mt-1">
            <Brand />
          </div>
          <Links badges={badges} onNavigate={() => setOpen(false)} />
          <UserBox me={me} signOut={signOut} />
        </DialogContent>
      </Dialog>
    </header>
  );
}
