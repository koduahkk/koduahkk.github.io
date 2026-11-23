-- AlterTable
ALTER TABLE "Territory" ADD COLUMN     "centerLat" DOUBLE PRECISION,
ADD COLUMN     "centerLng" DOUBLE PRECISION,
ADD COLUMN     "exhaustedAt" TIMESTAMP(3),
ADD COLUMN     "sourcingCursor" JSONB;

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "sourcing" JSONB;

-- CreateTable
CREATE TABLE "SourcingRun" (
    "id" TEXT NOT NULL,
    "runDate" TEXT NOT NULL,
    "found" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "trigger" TEXT NOT NULL DEFAULT 'schedule',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourcingRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SourcingRun_runDate_idx" ON "SourcingRun"("runDate");

-- Same lockdown as 20261123210000_supabase_rls: server-only access through Prisma.
ALTER TABLE "SourcingRun" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN EXECUTE 'REVOKE ALL ON "SourcingRun" FROM anon'; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN EXECUTE 'REVOKE ALL ON "SourcingRun" FROM authenticated'; END IF;
END $$;
