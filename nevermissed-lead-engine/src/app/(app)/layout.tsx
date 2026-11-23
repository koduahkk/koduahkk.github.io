import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { MobileBar, Sidebar } from "@/components/app/nav";
import { signOut } from "@/app/actions/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const now = new Date();
  const [dueCalls, unreadReplies, openTasks] = await Promise.all([
    prisma.callAttempt.count({ where: { status: "SCHEDULED", mode: "HUMAN", scheduledAt: { lte: new Date(now.getTime() + 15 * 60_000) } } }),
    prisma.emailEvent.count({ where: { type: "REPLIED", handled: false } }),
    prisma.task.count({ where: { status: "OPEN" } }),
  ]);
  const badges = { "/queue": dueCalls, "/inbox": unreadReplies, "/tasks": openTasks };
  const me = { name: user.name ?? user.email, role: user.role };
  return (
    <div className="flex min-h-screen">
      <Sidebar me={me} badges={badges} signOut={signOut} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileBar me={me} badges={badges} signOut={signOut} />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6 sm:py-7">{children}</main>
      </div>
    </div>
  );
}
