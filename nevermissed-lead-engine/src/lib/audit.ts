import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/** Append-only audit trail for anything that changes state. Never throws. */
export async function audit(
  userId: string | null | undefined,
  action: string,
  entity?: { type: string; id: string },
  meta?: Prisma.InputJsonValue,
) {
  try {
    await prisma.auditLog.create({
      data: { userId: userId ?? null, action, entityType: entity?.type, entityId: entity?.id, meta },
    });
  } catch (e) {
    console.error("audit log failed", e);
  }
}
