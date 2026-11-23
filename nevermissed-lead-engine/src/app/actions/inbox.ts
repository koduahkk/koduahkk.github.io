"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assertRole } from "@/lib/auth/session";
import { run } from "@/lib/action";

export async function markHandled(eventId: string, handled = true) {
  return run(async () => {
    await assertRole("CALLER");
    await prisma.emailEvent.update({ where: { id: eventId }, data: { handled } });
    revalidatePath("/inbox");
    return { message: handled ? "Marked as handled" : "Marked as unread" };
  });
}
