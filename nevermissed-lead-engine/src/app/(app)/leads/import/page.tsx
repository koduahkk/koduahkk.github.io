import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getSecret } from "@/lib/secrets";
import { PageHeader } from "@/components/app/page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CsvForm, PlacesForm } from "./import-forms";

export const metadata = { title: "Import salons" };

export default async function ImportPage() {
  await requireUser("ADMIN");
  const [territories, key] = await Promise.all([prisma.territory.findMany({ where: { active: true }, select: { id: true, name: true } }), getSecret("GOOGLE_PLACES_API_KEY")]);
  return (
    <>
      <PageHeader title="Import salons" description="New salons are enriched automatically: we visit their website for an email, Instagram, Facebook and booking platform." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Google Places</CardTitle>
            <CardDescription>Search a city or ZIP for salons near it.</CardDescription>
          </CardHeader>
          <CardContent><PlacesForm territories={territories} configured={!!key} /></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>CSV upload</CardTitle>
            <CardDescription>Map your columns, preview, and import.</CardDescription>
          </CardHeader>
          <CardContent><CsvForm territories={territories} /></CardContent>
        </Card>
      </div>
    </>
  );
}
