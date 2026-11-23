"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { FileUp, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toastResult } from "@/components/app/action-button";
import { importCsv, importFromPlaces } from "@/app/actions/leads";
import { CSV_FIELDS, guessMapping, type CsvMapping } from "@/lib/leads/csv";
import { SALON_CATEGORIES } from "@/lib/domain";

type Territory = { id: string; name: string };

export function PlacesForm({ territories, configured }: { territories: Territory[]; configured: boolean }) {
  const [v, setV] = useState({ location: "", radiusKm: "10", category: "hair_salon", territoryId: "", maxResults: "60" });
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const router = useRouter();
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await importFromPlaces(v);
          toastResult(r);
          if (r.ok) {
            setResult(r.message ?? null);
            router.refresh();
          }
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="loc">City or ZIP</Label>
          <Input id="loc" required value={v.location} onChange={(e) => setV({ ...v, location: e.target.value })} placeholder="Atlanta, GA or 30303" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cat">Category</Label>
          <Select id="cat" value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })}>
            {SALON_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rad">Radius (km)</Label>
          <Input id="rad" type="number" min={1} max={50} value={v.radiusKm} onChange={(e) => setV({ ...v, radiusKm: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ter">Territory</Label>
          <Select id="ter" value={v.territoryId} onChange={(e) => setV({ ...v, territoryId: e.target.value })}>
            <option value="">None</option>
            {territories.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="max">Max results (Google caps at 60)</Label>
          <Input id="max" type="number" min={1} max={60} value={v.maxResults} onChange={(e) => setV({ ...v, maxResults: e.target.value })} />
        </div>
      </div>
      {!configured ? <p className="rounded-md bg-amber-50 p-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">Add a Google Places API key in Settings → Integrations to search. CSV import works without it.</p> : null}
      <Button disabled={pending || !configured}>
        {pending ? <Loader2 className="animate-spin" /> : <MapPin />} Search &amp; import
      </Button>
      {result ? <p className="text-sm text-muted-foreground">{result}</p> : null}
      <p className="text-xs text-muted-foreground">Only Google&apos;s place_id is stored permanently. Other Places fields are cached with a &quot;last refreshed&quot; date and refreshed every 30 days.</p>
    </form>
  );
}

export function CsvForm({ territories }: { territories: Territory[] }) {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<CsvMapping>({});
  const [territoryId, setTerritoryId] = useState("");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const onFile = (f: File) => {
    setError(null);
    setFileName(f.name);
    Papa.parse<Record<string, string>>(f, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const h = res.meta.fields ?? [];
        if (!h.length) return setError("Couldn't find a header row in that file.");
        setHeaders(h);
        setRows(res.data);
        setMapping(guessMapping(h));
      },
      error: (err) => setError(err.message),
    });
  };

  return (
    <div className="space-y-4">
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center hover:bg-muted/50">
        <FileUp className="h-6 w-6 text-muted-foreground" />
        <span className="text-sm font-medium">{fileName || "Choose a CSV file"}</span>
        <span className="text-xs text-muted-foreground">Needs at least a name and a phone column. Duplicates (same phone or place_id) are skipped.</span>
        <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </label>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {headers.length ? (
        <>
          <div>
            <h3 className="mb-2 text-sm font-medium">Map columns ({rows.length} rows)</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {CSV_FIELDS.map((f) => (
                <div key={f.key} className="space-y-1">
                  <Label className="text-xs">
                    {f.label}
                    {"required" in f && f.required ? <span className="text-destructive"> *</span> : null}
                  </Label>
                  <Select value={mapping[f.key] ?? ""} onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value || undefined })}>
                    <option value="">Don&apos;t import</option>
                    {headers.map((h) => <option key={h}>{h}</option>)}
                  </Select>
                </div>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="bg-muted">
                <tr>{CSV_FIELDS.filter((f) => mapping[f.key]).map((f) => <th key={f.key} className="px-2 py-1.5 text-left font-medium">{f.label}</th>)}</tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((r, i) => (
                  <tr key={i} className="border-t">{CSV_FIELDS.filter((f) => mapping[f.key]).map((f) => <td key={f.key} className="max-w-40 truncate px-2 py-1.5">{r[mapping[f.key]!]}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label>Territory</Label>
              <Select value={territoryId} onChange={(e) => setTerritoryId(e.target.value)} className="w-56">
                <option value="">None</option>
                {territories.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </div>
            <Button
              disabled={pending || !mapping.name || !mapping.phone}
              onClick={() =>
                start(async () => {
                  const r = await importCsv(rows, mapping, territoryId);
                  toastResult(r);
                  if (r.ok) router.push("/leads");
                })
              }
            >
              {pending ? <Loader2 className="animate-spin" /> : null} Import {rows.length} rows
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
