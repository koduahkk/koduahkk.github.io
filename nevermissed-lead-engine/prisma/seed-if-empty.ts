/**
 * Runs during the Vercel build (`vercel-build`). Loads the demo data ONLY when
 * SEED_DEMO_DATA=true and the database has no users yet, so redeploys never
 * wipe anything. Remove SEED_DEMO_DATA before going live with real data.
 */
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

async function main() {
  if (process.env.SEED_DEMO_DATA !== "true") return console.log("[seed] SEED_DEMO_DATA not set, skipping demo data.");
  const prisma = new PrismaClient();
  const users = await prisma.user.count();
  await prisma.$disconnect();
  if (users > 0) return console.log(`[seed] Database already has ${users} user(s), skipping demo data.`);
  console.log("[seed] Empty database: loading demo data…");
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit" });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
