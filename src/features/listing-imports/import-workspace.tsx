"use client";
import { useLatestRead } from "@/lib/hooks/use-latest-read";

import { useDropzone, type Accept } from "react-dropzone";
import {
  AlertCircle,
  ArrowRight,
  Check,
  FileArchive,
  FileUp,
  ImagePlus,
  LoaderCircle,
  Map as MapIcon,
  PauseCircle,
  Play,
  RefreshCw,
  Table2,
  UploadCloud,
} from "lucide-react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { ActionBar, MetricStrip, StatusBadge } from "@/components/premium/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { useWorkspaceReady } from "@/features/offers/use-workspace-ready";

import { validateArchiveEntries } from "./adapters/archive-safety";
import { CANONICAL_IMPORT_FIELDS, suggestMapping } from "./field-registry";
import type { WorkspaceRow } from "./import-rows-table";
import { IMPORT_LIMITS } from "./limits";
import type {
  CanonicalImportListing,
  DuplicateStrategy,
  ImportDuplicateCandidate,
  ImportJobStage,
  ImportJobSummary,
  ImportMapping,
  ImportSelection,
  ImportSourceKind,
  SourceInspection,
} from "./types";
const ImportRowsTable = dynamic(
  () => import("./import-rows-table").then(module => module.ImportRowsTable),
  { loading: () => <div className="min-h-96 rounded-lg border border-border bg-muted p-4" role="status">Loading import rows…</div> },
);
const ImportPreviewMap = dynamic(
  () => import("./import-preview-map").then((module) => module.ImportPreviewMap),
  { ssr: false, loading: () => <div className="min-h-96 animate-pulse rounded-lg border border-border bg-muted motion-reduce:animate-none" /> },
);

type AgentOption = { id: string; label: string; role: "owner" | "admin" | "agent" };
type SourceMetadata = Partial<Pick<SourceInspection, "headers" | "sheets" | "recordPaths" | "estimatedRows" | "warnings" | "adapterVersion">>;
type Configuration = {
  mapping: ImportMapping;
  defaults: Partial<CanonicalImportListing> & Record<string, unknown>;
  selection: ImportSelection;
  sourceMetadata: SourceMetadata;
  sheetName: string | null;
  recordPath: string | null;
};

const steps = [
  "Source",
  "Upload",
  "Map fields",
  "Validate",
  "Resolve",
  "Preview",
  "Commit drafts",
  "Confirm changes",
] as const;

function stageStep(stage: ImportJobStage) {
  if (stage === "source") return 1;
  if (stage === "upload") return 2;
  if (stage === "mapping") return 3;
  if (stage === "validating") return 4;
  if (stage === "resolving") return 5;
  if (stage === "preview") return 6;
  if (stage === "committing") return 7;
  return 8;
}

function sourceAccept(kind: ImportSourceKind): Accept {
  if (kind === "csv" || kind === "pasted_table") return { "text/*": [".csv", ".tsv", ".txt"] };
  if (kind === "xlsx") return { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] };
  if (kind === "xml") return { "application/xml": [".xml"], "text/xml": [".xml"] };
  return { "application/json": [".json"] };
}

async function inspectSource(kind: ImportSourceKind, file: File) {
  if (kind === "xlsx") return (await import("./adapters/xlsx")).xlsxAdapter.inspect(file);
  const source = await file.text();
  if (kind === "csv") return (await import("./adapters/csv")).csvAdapter.inspect(source);
  if (kind === "pasted_table") return (await import("./adapters/csv")).pastedTableAdapter.inspect(source);
  if (kind === "json") return (await import("./adapters/json")).jsonAdapter.inspect(source);
  if (kind === "xml") return (await import("./adapters/xml")).xmlAdapter.inspect(source);
  return (await import("./adapters/pinpoint-v1")).pinpointV1Adapter.inspect(source);
}

async function discoverHeaders(kind: ImportSourceKind, file: File, sheet?: string, recordPath?: string) {
  if (kind === "xlsx") return (await import("./adapters/xlsx")).xlsxAdapter.discoverHeaders(file, { sheet });
  const source = await file.text();
  if (kind === "json") return (await import("./adapters/json")).jsonAdapter.discoverHeaders(source, { recordPath });
  if (kind === "xml") return (await import("./adapters/xml")).xmlAdapter.discoverHeaders(source, { recordPath });
  return inspectSource(kind, file).then((inspection) => inspection.headers);
}

function StepRail({ current }: { current: number }) {
  return (
    <ol aria-label="Import progress" className="mb-6 grid grid-cols-4 gap-2 lg:grid-cols-8">
      {steps.map((label, index) => {
        const step = index + 1;
        const complete = step < current;
        const active = step === current;
        return (
          <li key={label} aria-current={active ? "step" : undefined} className="min-w-0">
            <div className={cn("h-1 rounded-full", complete || active ? "bg-forest" : "bg-border")} />
            <div className="mt-2 flex items-center gap-1.5">
              <span className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
                complete ? "border-forest bg-forest text-primary-foreground" : active ? "border-forest text-forest" : "border-border text-muted-foreground",
              )}>
                {complete ? <Check className="size-3" /> : step}
              </span>
              <span className={cn("truncate text-[11px] font-semibold", active ? "text-ink" : "text-muted-foreground")}>{label}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function SourceUpload({
  job,
  onUploaded,
}: {
  job: ImportJobSummary;
  onUploaded: (job: ImportJobSummary, configuration: Configuration) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<SourceInspection | null>(null);
  const [sheet, setSheet] = useState("");
  const [recordPath, setRecordPath] = useState("");
  const [paste, setPaste] = useState("");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const inspectionVersion = useRef(0);
  const onDrop = useCallback(async (files: File[]) => {
    const selected = files[0];
    if (!selected) return;
    const version = ++inspectionVersion.current;
    setMessage("");
    setFile(selected);
    setInspection(null);
    setSheet("");
    setRecordPath("");
    setInspecting(true);
    try {
      const result = await inspectSource(job.sourceKind, selected);
      if (version !== inspectionVersion.current) return;
      setInspection(result);
      setSheet(result.sheets?.length === 1 ? result.sheets[0]! : "");
      setRecordPath(result.recordPaths?.length === 1 ? result.recordPaths[0]! : "");
    } catch (error) {
      if (version !== inspectionVersion.current) return;
      setInspection(null);
      setMessage(error instanceof Error ? error.message : "Unable to inspect this source.");
    } finally {
      if (version === inspectionVersion.current) setInspecting(false);
    }
  }, [job.sourceKind]);
  const dropzone = useDropzone({
    onDrop,
    disabled: busy,
    multiple: false,
    maxSize: job.sourceKind === "xlsx" ? IMPORT_LIMITS.xlsxBytes : IMPORT_LIMITS.structuredSourceBytes,
    accept: sourceAccept(job.sourceKind),
  });

  const beginUpload = async () => {
    let selected = file;
    if (job.sourceKind === "pasted_table" && paste.trim()) {
      selected = new File([paste], "pasted-listings.tsv", { type: "text/tab-separated-values" });
      setFile(selected);
    }
    if (!selected) {
      setMessage("Choose a source file or paste a table first.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      let sourceInspection = inspection ?? await inspectSource(job.sourceKind, selected);
      const chosenSheet = sheet || (sourceInspection.sheets?.length === 1 ? sourceInspection.sheets[0] : undefined);
      const chosenPath = recordPath || (sourceInspection.recordPaths?.length === 1 ? sourceInspection.recordPaths[0] : undefined);
      if ((sourceInspection.sheets?.length ?? 0) > 1 && !chosenSheet) throw new Error("Choose the worksheet that contains listings.");
      if ((sourceInspection.recordPaths?.length ?? 0) > 1 && !chosenPath) throw new Error("Choose the repeating listing record path.");
      if (!sourceInspection.headers.length) {
        sourceInspection = {
          ...sourceInspection,
          headers: await discoverHeaders(job.sourceKind, selected, chosenSheet, chosenPath),
        };
      }
      const { uploadImportSource } = await import("./upload");
      const sourcePath = await uploadImportSource(job.id, selected, setProgress);
      const response = await fetch(`/api/imports/${job.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "source_uploaded",
          expectedVersion: job.version,
          sourcePath,
          sourceName: selected.name,
          sourceSizeBytes: selected.size,
          sheetName: chosenSheet ?? null,
          recordPath: chosenPath ?? null,
          inspection: {
            headers: sourceInspection.headers,
            sheets: sourceInspection.sheets,
            recordPaths: sourceInspection.recordPaths,
            estimatedRows: sourceInspection.estimatedRows,
            warnings: sourceInspection.warnings,
            adapterVersion: sourceInspection.adapterVersion,
          },
        }),
      });
      const payload = await response.json() as { ok: boolean; data?: { job: ImportJobSummary }; error?: { message: string } };
      if (!payload.ok || !payload.data) throw new Error(payload.error?.message ?? "Unable to save the source.");
      onUploaded(payload.data.job, {
        mapping: {},
        defaults: {},
        selection: { mode: "explicit", included: [] },
        sourceMetadata: {
          headers: sourceInspection.headers,
          sheets: sourceInspection.sheets,
          recordPaths: sourceInspection.recordPaths,
          estimatedRows: sourceInspection.estimatedRows,
          warnings: sourceInspection.warnings,
          adapterVersion: sourceInspection.adapterVersion,
        },
        sheetName: chosenSheet ?? null,
        recordPath: chosenPath ?? null,
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The source upload failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-panel p-4 shadow-[var(--shadow-card)] sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-forest"><UploadCloud className="size-5" /></span>
        <div>
          <h2 className="text-lg font-semibold text-ink">Upload and inspect the source</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Large files upload directly and resume after a network interruption.</p>
        </div>
      </div>
      {job.sourceKind === "pasted_table" ? (
        <div className="mt-5">
          <label htmlFor="pasted-listings" className="text-sm font-semibold text-ink">Paste rows including the header row</label>
          <Textarea id="pasted-listings" value={paste} onChange={(event) => setPaste(event.target.value)} className="mt-2 min-h-52 font-mono text-xs" />
        </div>
      ) : (
        <div
          {...dropzone.getRootProps()}
          className={cn(
            "mt-5 flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center outline-none focus-visible:ring-2 focus-visible:ring-ring",
            dropzone.isDragActive ? "border-forest bg-accent" : "border-border bg-warm-surface hover:border-forest/40",
          )}
        >
          <input {...dropzone.getInputProps()} />
          <FileUp className="size-7 text-forest" />
          <p className="mt-3 text-sm font-semibold text-ink">{file?.name ?? "Drop the source here, or choose a file"}</p>
          <p className="mt-1 text-xs text-muted-foreground">{job.sourceKind === "xlsx" ? "XLSX up to 25 MB" : "Structured files up to 100 MB"}</p>
        </div>
      )}
      {inspection?.sheets && inspection.sheets.length > 1 ? (
        <label className="mt-4 block text-sm font-semibold text-ink">
          Worksheet
          <select value={sheet} onChange={(event) => setSheet(event.target.value)} className="mt-2 h-11 w-full rounded-md border border-input bg-panel px-3 text-sm">
            <option value="">Choose a worksheet…</option>
            {inspection.sheets.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      ) : null}
      {inspection?.recordPaths && inspection.recordPaths.length > 1 ? (
        <label className="mt-4 block text-sm font-semibold text-ink">
          Repeating record path
          <select value={recordPath} onChange={(event) => setRecordPath(event.target.value)} className="mt-2 h-11 w-full rounded-md border border-input bg-panel px-3 font-mono text-sm">
            <option value="">Choose a record path…</option>
            {inspection.recordPaths.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      ) : null}
      {progress > 0 ? (
        <div className="mt-4" aria-label={`Upload ${progress}% complete`}>
          <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-forest" style={{ width: `${progress}%` }} /></div>
          <p className="mt-1 text-xs tabular-nums text-muted-foreground">{progress}% uploaded</p>
        </div>
      ) : null}
      {message ? <p role="alert" className="mt-4 text-sm font-medium text-destructive">{message}</p> : null}
      <div className="mt-5 flex justify-end">
        <Button type="button" onClick={beginUpload} disabled={busy || inspecting || (!file && !paste.trim())}>
          {busy ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /> : <UploadCloud className="size-4" />}
          {busy ? "Uploading…" : "Upload and continue"}
        </Button>
      </div>
    </section>
  );
}

function MappingStep({
  job,
  configuration,
  agents,
  onJob,
}: {
  job: ImportJobSummary;
  configuration: Configuration;
  agents: AgentOption[];
  onJob: (job: ImportJobSummary) => void;
}) {
  const headers = configuration.sourceMetadata.headers ?? [];
  const [mapping, setMapping] = useState<ImportMapping>(() => Object.keys(configuration.mapping).length ? configuration.mapping : suggestMapping(headers));
  const [agentId, setAgentId] = useState(String(configuration.defaults.responsibleAgentId ?? agents[0]?.id ?? ""));
  const [draggedHeader, setDraggedHeader] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const autosaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const versionRef = useRef(job.version);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  // A job-summary poll does not acknowledge this editor's mapping snapshot.
  // Advance its write version only after its own save succeeds or the page reloads.

  const save = useCallback((startValidation = false) => {
    if (startValidation && autosaveRef.current) clearTimeout(autosaveRef.current);
    const task = saveQueue.current.catch(() => undefined).then(async () => {
      setMessage("");
      const saveResponse = await fetch(`/api/imports/${job.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "save_mapping", expectedVersion: versionRef.current, mapping, defaults: { ...configuration.defaults, responsibleAgentId: agentId } }),
      });
      const savePayload = await saveResponse.json() as { ok: boolean; data?: { job: ImportJobSummary }; error?: { message: string } };
      if (!savePayload.ok || !savePayload.data) throw new Error(savePayload.error?.message ?? "Unable to save the mapping.");
      versionRef.current = savePayload.data.job.version;
      onJob(savePayload.data.job);
      if (!startValidation) return;
      const startResponse = await fetch(`/api/imports/${job.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "start_validation", expectedVersion: versionRef.current }),
      });
      const startPayload = await startResponse.json() as { ok: boolean; data?: { job: ImportJobSummary }; error?: { message: string } };
      if (!startPayload.ok || !startPayload.data) throw new Error(startPayload.error?.message ?? "Unable to start validation.");
      versionRef.current = startPayload.data.job.version;
      onJob(startPayload.data.job);
    });
    saveQueue.current = task;
    return task;
  }, [agentId, configuration.defaults, job.id, mapping, onJob]);

  useEffect(() => {
    if (autosaveRef.current) clearTimeout(autosaveRef.current);
    autosaveRef.current = setTimeout(() => { void save(false).catch((error) => setMessage(error instanceof Error ? error.message : "Unable to save the mapping. Your choices are still here.")); }, 900);
    return () => { if (autosaveRef.current) clearTimeout(autosaveRef.current); };
  }, [mapping, agentId, save]);

  return (
    <section className="space-y-5">
      <div className="rounded-xl border border-border bg-panel p-4 shadow-[var(--shadow-card)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Map source columns</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">Suggestions are editable. Unmapped values stay in staging and never enter public listing metadata.</p>
          </div>
          <StatusBadge tone="forest">{message ? "Mapping needs attention" : "Mapping template"}</StatusBadge>
        </div>
        <label className="mt-5 block max-w-md text-sm font-semibold text-ink">
          Default responsible agent
          <select value={agentId} onChange={(event) => setAgentId(event.target.value)} className="mt-2 h-11 w-full rounded-md border border-input bg-panel px-3 text-sm">
            <option value="">Choose an active member…</option>
            {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.label} · {agent.role}</option>)}
          </select>
        </label>
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 bg-warm-surface px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
              <span>Source column</span><span>Pinpoint field</span>
            </div>
            <div className="max-h-[32rem] divide-y divide-border overflow-y-auto">
              {headers.map((header) => (
                <div key={header} draggable onDragStart={() => setDraggedHeader(header)} className="grid min-h-14 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 px-3 py-2">
                  <span className="truncate text-sm font-semibold text-ink" title={header}>{header}</span>
                  <select
                    aria-label={`Map ${header}`}
                    value={mapping[header] ?? ""}
                    onChange={(event) => setMapping((current) => ({ ...current, [header]: event.target.value as keyof CanonicalImportListing || null }))}
                    className="h-10 min-w-0 rounded-md border border-input bg-panel px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Do not import</option>
                    {CANONICAL_IMPORT_FIELDS.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink">Drop on a target field</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Drag a source column here, or use the selects for the same keyboard-accessible action.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {CANONICAL_IMPORT_FIELDS.map((field) => (
                <button
                  key={field.key}
                  type="button"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (draggedHeader) setMapping((current) => ({ ...current, [draggedHeader]: field.key }));
                    setDraggedHeader(null);
                  }}
                  className="min-h-11 rounded-md border border-border bg-warm-surface px-2 text-left text-xs font-semibold text-ink outline-none hover:border-forest/40 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {field.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {message ? <p role="alert" className="mt-4 text-sm font-medium text-destructive">{message}</p> : null}
        <div className="mt-5 flex justify-end">
          <Button
            type="button"
            disabled={pending || !agentId}
            onClick={() => startTransition(async () => {
              setMessage("");
              try { await save(true); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to start validation."); }
            })}
          >
            {pending ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /> : <Play className="size-4" />}
            Validate all rows
          </Button>
        </div>
      </div>
    </section>
  );
}

function ProcessingStep({ job, onAction }: { job: ImportJobSummary; onAction: (action: string, extra?: object) => Promise<void> }) {
  const percentage = job.totalRows > 0 ? Math.min(100, Math.round((job.processedRows / job.totalRows) * 100)) : 0;
  return (
    <section className="rounded-xl border border-border bg-panel p-5 shadow-[var(--shadow-card)] sm:p-8">
      <div className="flex items-start gap-3">
        <LoaderCircle className="mt-0.5 size-6 animate-spin text-forest motion-reduce:animate-none" />
        <div>
          <h2 className="text-lg font-semibold text-ink">{job.stage === "committing" ? "Committing in durable chunks" : "Validating every row"}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">You can close this page. Progress is durable and resumes from the last committed cursor.</p>
        </div>
      </div>
      <div className="mt-6 h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-forest transition-[width]" style={{ width: `${percentage}%` }} /></div>
      <div className="mt-4">
        <MetricStrip metrics={[
          { label: "Processed", value: job.processedRows, tone: "forest" },
          { label: "Warnings", value: job.warningRows, tone: "warning" },
          { label: "Blocked", value: job.blockedRows },
        ]} />
      </div>
      <div className="mt-5 flex justify-end">
        <Button variant="outline" onClick={() => void onAction("cancel")}>
          <PauseCircle className="size-4" />
          Cancel safely
        </Button>
      </div>
    </section>
  );
}

type WorkspaceAsset = {
  id: string;
  row_id: string | null;
  state: string;
  source_name: string | null;
  sort_order: number | null;
  is_cover: boolean;
  match_method: string | null;
  updated_at: string;
  mime_type: string | null;
};

class ImageRequestError extends Error {}

const IMAGE_ORDER_ERROR = "Image order must be a whole number from 0 to 19.";

function ImageOrderField({ asset, disabled, onSave, onInvalid, onEdit }: {
  asset: WorkspaceAsset;
  disabled: boolean;
  onSave: (snapshot: WorkspaceAsset, sortOrder: number) => void;
  onInvalid: () => void;
  onEdit: () => void;
}) {
  const [draft, setDraft] = useState(String(asset.sort_order ?? 0));
  const editing = useRef(false);
  const snapshot = useRef(asset);
  useEffect(() => {
    if (!editing.current) setDraft(String(asset.sort_order ?? 0));
  }, [asset.id, asset.sort_order, asset.updated_at]);
  return <Input aria-label={`Order for ${asset.source_name}`} type="number" min={0} max={19} value={draft} disabled={disabled}
    onFocus={() => { editing.current = true; snapshot.current = asset; }}
    onChange={(event) => { setDraft(event.target.value); onEdit(); }}
    onBlur={() => {
      editing.current = false;
      const value = draft.trim() === "" ? NaN : Number(draft);
      if (!Number.isInteger(value) || value < 0 || value > 19) { onInvalid(); return; }
      if (value !== (snapshot.current.sort_order ?? 0)) onSave(snapshot.current, value);
      else setDraft(String(asset.sort_order ?? 0));
    }}
    onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } }} className="h-9" />;
}

async function readImageResponse<T>(response: Response, fallback: string) {
  let payload: { ok?: boolean; data?: T; error?: { message?: unknown } } | null;
  try { payload = await response.json(); } catch { throw new ImageRequestError(fallback); }
  if (!response.ok || !payload?.ok) throw new ImageRequestError(typeof payload?.error?.message === "string" ? payload.error.message : fallback);
  return payload;
}

function imageMessage(error: unknown, fallback: string) {
  return error instanceof ImageRequestError ? error.message : fallback;
}

function ImageAssetsPanel({ jobId, rows }: { jobId: string; rows: WorkspaceRow[] }) {
  const folderInput = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<WorkspaceAsset[]>([]);
  const [nextImageCursor, setNextImageCursor] = useState<string | null>(null);
  const [imagePageNumber, setImagePageNumber] = useState(1);
  const imagePage = useRef<{ jobId: string; cursor: string | null; history: (string | null)[] }>({ jobId, cursor: null, history: [] });
  const imageReadTarget = useRef<{ cursor: string | null; history: (string | null)[] }>({ cursor: null, history: [] });
  const [urls, setUrls] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState("");

  const [reading, setReading] = useState(false);
  const [readMessage, setReadMessage] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);
  const mounted = useRef(true);
  const pendingRegistrations = useRef(new Map<string, string>());
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const beginAssetRead = useLatestRead(jobId);
  const refresh = useCallback(async (
    cursor: string | null = imagePage.current.jobId === jobId ? imagePage.current.cursor : null,
    history: (string | null)[] = imagePage.current.jobId === jobId ? imagePage.current.history : [],
  ) => {
    const controller = beginAssetRead();
    imageReadTarget.current = { cursor, history };
    setReading(true);
    try {
      const response = await fetch(`/api/imports/${jobId}/assets${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, { cache: "no-store", signal: controller.signal });
      const payload = await readImageResponse<{ assets: WorkspaceAsset[]; nextCursor?: string | null }>(response, "Unable to load saved images. Retry when the connection is available.");
      if (!Array.isArray(payload.data?.assets)) throw new ImageRequestError("Unable to load saved images. Retry when the connection is available.");
      if (!controller.signal.aborted) {
        imagePage.current = { jobId, cursor, history };
        setAssets(payload.data.assets); setNextImageCursor(payload.data.nextCursor ?? null);
        setImagePageNumber(history.length + 1); setHasLoaded(true); setReadMessage("");
      }
    } catch (error) {
      if (!controller.signal.aborted) setReadMessage(imageMessage(error, "Unable to load saved images. Retry when the connection is available."));
    } finally { if (!controller.signal.aborted) setReading(false); }
  }, [beginAssetRead, jobId]);

  useEffect(() => {
    folderInput.current?.setAttribute("webkitdirectory", "");
    const timeout = window.setTimeout(() => void refresh(null, []), 0);
    return () => window.clearTimeout(timeout);
  }, [refresh]);

  const registerFile = useCallback(async (file: File, position: number, total: number, origin = "files") => {
    if (file.size > IMPORT_LIMITS.imageBytes) throw new ImageRequestError("Images are limited to 10 MB.");
    const key = [jobId, origin, file.webkitRelativePath || file.name, file.type, file.size, file.lastModified].join("\u0000");
    const { uploadImportAsset } = await import("./upload");
    let storagePath = pendingRegistrations.current.get(key);
    if (!storagePath) {
      storagePath = await uploadImportAsset(jobId, file, (value) => { if (mounted.current) setProgress(`${position + 1}/${total} · ${value}%`); });
      pendingRegistrations.current.set(key, storagePath);
    }
    const response = await fetch(`/api/imports/${jobId}/assets`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "uploaded",
        storagePath,
        sourceName: file.webkitRelativePath || file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      }),
    });
    const payload = await readImageResponse<{ assetId: string }>(response, "Could not confirm this image upload. Check saved images before retrying.");
    if (typeof payload.data?.assetId !== "string") throw new ImageRequestError("Could not confirm this image upload. Check saved images before retrying.");
  }, [jobId]);

  const addFiles = async (fileList: FileList | File[] | null) => {
    const files = [...(fileList ?? [])].filter((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type));
    if (!files.length) return;
    setBusy(true);
    setMessage("");
    let next = 0;
    try {
      const results = await Promise.allSettled(Array.from({ length: Math.min(4, files.length) }, async () => {
        while (next < files.length) {
          const position = next++;
          await registerFile(files[position]!, position, files.length);
        }
      }));
      const failure = results.find((result) => result.status === "rejected");
      if (failure?.status === "rejected") throw failure.reason;
    } catch (error) {
      if (mounted.current) setMessage(imageMessage(error, "One or more images could not be uploaded. Check saved images and retry the missing files."));
    } finally {
      if (mounted.current) { await refresh(); setProgress(""); setBusy(false); }
    }
  };

  const addArchive = async (archive: File | undefined) => {
    if (!archive) return;
    if (archive.size > IMPORT_LIMITS.zipBytes) {
      setMessage("ZIP archives are limited to 2 GB.");
      return;
    }
    setBusy(true);
    setMessage("");
    let closeArchive: (() => Promise<void>) | undefined;
    try {
      const { BlobReader, BlobWriter, ZipReader } = await import("@zip.js/zip.js");
      const reader = new ZipReader(new BlobReader(archive));
      closeArchive = () => reader.close();
      const entries = await reader.getEntries();
      const safety = validateArchiveEntries(entries.map((entry) => ({
        filename: entry.filename,
        compressedSize: entry.compressedSize,
        uncompressedSize: entry.uncompressedSize,
        directory: entry.directory,
      })));
      if (!safety.safe) throw new ImageRequestError(safety.issues[0] ?? "The ZIP archive is unsafe.");
      const { uploadImportArchive } = await import("./upload");
      const archiveKey = [jobId, "archive", archive.name, archive.size, archive.lastModified].join("\u0000");
      let archivePath = pendingRegistrations.current.get(archiveKey);
      if (!archivePath) {
        archivePath = await uploadImportArchive(jobId, archive, (value) => { if (mounted.current) setProgress(`ZIP · ${value}%`); });
        pendingRegistrations.current.set(archiveKey, archivePath);
      }
      const registerArchiveResponse = await fetch(`/api/imports/${jobId}/assets`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "archive",
          storagePath: archivePath,
          sourceName: archive.name,
          sizeBytes: archive.size,
        }),
      });
      const registerArchivePayload = await readImageResponse<{ assetId: string }>(registerArchiveResponse, "Could not confirm the ZIP upload. Check saved images before retrying.");
      if (typeof registerArchivePayload.data?.assetId !== "string") throw new ImageRequestError("Could not confirm the ZIP upload. Check saved images before retrying.");
      const imageEntries = entries.filter((entry) => !entry.directory);
      let next = 0;
      const results = await Promise.allSettled(Array.from({ length: Math.min(4, imageEntries.length) }, async () => {
        while (next < imageEntries.length) {
          const position = next++;
          const entry = imageEntries[position]!;
          const extension = entry.filename.split(".").at(-1)?.toLowerCase();
          const mimeType = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
          const blob = await entry.getData(new BlobWriter(mimeType));
          await registerFile(new File([blob], entry.filename, { type: mimeType, lastModified: archive.lastModified }), position, imageEntries.length, archiveKey);
        }
      }));
      const failure = results.find((result) => result.status === "rejected");
      if (failure?.status === "rejected") throw failure.reason;
    } catch (error) {
      if (mounted.current) setMessage(imageMessage(error, "The ZIP archive could not be processed safely. Check saved images before retrying."));
    } finally {
      try { await closeArchive?.(); } catch {
        if (mounted.current) setMessage(current => current || "The ZIP archive could not be closed safely. Check saved images before retrying.");
      }
      if (mounted.current) { await refresh(); setProgress(""); setBusy(false); }
    }
  };

  const addUrls = async () => {
    const list = [...new Set(urls.split(/\r?\n/).map((url) => url.trim()).filter(Boolean))];
    if (!list.length) return;
    setBusy(true);
    setMessage("");
    let next = 0;
    try {
      const results = await Promise.allSettled(Array.from({ length: Math.min(4, list.length) }, async () => {
        while (next < list.length) {
          const position = next++;
          setProgress(`${position + 1}/${list.length}`);
          const response = await fetch(`/api/imports/${jobId}/assets`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ kind: "url", url: list[position] }),
          });
          const payload = await readImageResponse<{ assetId: string }>(response, "Could not confirm this image URL. Check saved images before retrying.");
          if (typeof payload.data?.assetId !== "string") throw new ImageRequestError("Could not confirm this image URL. Check saved images before retrying.");
        }
      }));
      const failure = results.find((result) => result.status === "rejected");
      if (failure?.status === "rejected") throw failure.reason;
      if (mounted.current) setUrls("");
    } catch (error) {
      if (mounted.current) setMessage(imageMessage(error, "One or more image URLs could not be imported. Check saved images before retrying."));
    } finally {
      if (mounted.current) { await refresh(); setProgress(""); setBusy(false); }
    }
  };

  const arrange = async (asset: WorkspaceAsset, patch: Partial<{ rowId: string | null; sortOrder: number; isCover: boolean }>) => {
    if (busy) return;
    setBusy(true);
    setMessage("");
    const rowId = patch.rowId === undefined ? asset.row_id : patch.rowId;
    try {
      const response = await fetch(`/api/imports/${jobId}/assets`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        assetId: asset.id,
        rowId,
        sortOrder: patch.sortOrder ?? asset.sort_order ?? 0,
        isCover: patch.isCover ?? asset.is_cover,
        expectedUpdatedAt: asset.updated_at,
      }),
    });
      const payload = await readImageResponse<{ assetId: string }>(response, "Could not confirm this image change. Check saved images before retrying.");
      if (payload.data?.assetId !== asset.id) throw new ImageRequestError("Could not confirm this image change. Check saved images before retrying.");
    } catch (error) {
      if (mounted.current) setMessage(imageMessage(error, "Could not confirm this image change. Check saved images before retrying."));
    } finally {
      if (mounted.current) { await refresh(); setBusy(false); }
    }
  };

  const images = assets.filter((asset) => asset.mime_type?.startsWith("image/"));

  return (
    <details className="min-w-0 rounded-lg border border-border bg-panel">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-semibold text-ink">
        <ImagePlus className="size-4 text-forest" /> Images <StatusBadge tone="neutral">{hasLoaded ? images.length : readMessage ? "—" : "…"}</StatusBadge>
      </summary>
      <div className="border-t border-border p-4">
        <p className="text-sm leading-6 text-muted-foreground">Mapped filenames are matched first, followed by source-reference folders and filename prefixes. Ambiguous images stay unattached.</p>
        <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="min-w-0 rounded-md border border-border bg-warm-surface p-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Upload images</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <label className="grid w-full min-w-0 gap-1 text-xs font-medium text-muted-foreground sm:max-w-sm">Images<Input aria-label="Upload images" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy || !hasLoaded} onChange={(event) => { void addFiles(event.currentTarget.files); event.currentTarget.value = ""; }} className="min-w-0 max-w-full" /></label>
              <label className="grid w-full min-w-0 gap-1 text-xs font-medium text-muted-foreground sm:max-w-sm">Image folder<Input aria-label="Upload image folder" ref={folderInput} type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy || !hasLoaded} onChange={(event) => { void addFiles(event.currentTarget.files); event.currentTarget.value = ""; }} className="min-w-0 max-w-full" /></label>
              <label className="grid w-full min-w-0 gap-1 text-xs font-medium text-muted-foreground sm:max-w-sm">ZIP archive<Input aria-label="Upload ZIP archive" type="file" accept=".zip,application/zip" disabled={busy || !hasLoaded} onChange={(event) => { void addArchive(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} className="min-w-0 max-w-full" /></label>
            </div>
          </div>
          <div className="min-w-0 rounded-md border border-border bg-warm-surface p-3">
            <label htmlFor="image-urls" className="text-xs font-semibold uppercase text-muted-foreground">HTTPS image URLs, one per line</label>
            <Textarea id="image-urls" value={urls} onChange={(event) => setUrls(event.target.value)} className="mt-2 min-h-24 min-w-0 max-w-full font-mono text-xs" />
            <Button type="button" variant="outline" className="mt-2" disabled={busy || !hasLoaded || !urls.trim()} onClick={() => void addUrls()}>Import safe URLs</Button>
          </div>
        </div>
        {progress ? <p className="mt-3 text-xs font-semibold tabular-nums text-forest">Uploading {progress}</p> : null}
        {reading ? <p role="status" className="mt-3 text-xs text-muted-foreground">Loading saved images…</p> : null}
        {readMessage ? <div className="mt-3"><p role="alert" className="text-sm font-medium text-destructive">{readMessage}{hasLoaded ? " Saved images remain shown." : ""}</p><Button type="button" variant="outline" className="mt-2" disabled={reading || busy} onClick={() => void refresh(imageReadTarget.current.cursor, imageReadTarget.current.history)}>Retry image loading</Button></div> : null}
        {message ? <p role="alert" className="mt-3 text-sm font-medium text-destructive">{message}</p> : null}
        {images.length ? (
          <div className="mt-4 max-h-72 overflow-auto rounded-md border border-border">
            {images.map((asset) => (
              <div key={asset.id} className="grid min-h-14 grid-cols-[minmax(0,1fr)_5rem] items-center gap-2 border-b border-border px-3 py-2 text-xs sm:grid-cols-[minmax(0,1fr)_minmax(10rem,16rem)_5rem_5rem]">
                <span className="col-span-2 min-w-0 truncate font-semibold text-ink sm:col-span-1">{asset.source_name ?? "Imported image"}</span>
                <select aria-label={`Row for ${asset.source_name ?? "imported image"}`} disabled={busy || reading} value={asset.row_id ?? ""} onChange={(event) => void arrange(asset, { rowId: event.target.value || null })} className="col-span-2 h-9 min-w-0 rounded-md border border-input bg-panel px-2 sm:col-span-1">
                  <option value="">Unmatched</option>
                  {rows.map((row) => <option key={row.id} value={row.id}>Row {row.row_number}: {row.normalized_data.title ?? "Untitled"}</option>)}
                </select>
                <ImageOrderField asset={asset} disabled={busy || reading || !asset.row_id} onSave={(snapshot, sortOrder) => void arrange(snapshot, { sortOrder })} onInvalid={() => setMessage(IMAGE_ORDER_ERROR)} onEdit={() => setMessage((current) => current === IMAGE_ORDER_ERROR ? "" : current)} />
                <label className="flex items-center gap-1 font-semibold text-muted-foreground"><input aria-label={`Cover for ${asset.source_name ?? "imported image"}`} type="checkbox" checked={asset.is_cover} disabled={busy || reading || !asset.row_id} onChange={(event) => void arrange(asset, { isCover: event.target.checked })} /> Cover</label>
              </div>
            ))}
          </div>
        ) : null}
        {nextImageCursor || imagePageNumber > 1 ? <nav aria-label="Image pages" className="mt-3 flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" className="min-h-11" disabled={busy || reading || imagePageNumber === 1} onClick={() => {
            const history = imagePage.current.history;
            void refresh(history.at(-1) ?? null, history.slice(0, -1));
          }}>Previous images</Button>
          <p role="status" className="text-xs text-muted-foreground">Image page {imagePageNumber}</p>
          <Button type="button" variant="outline" className="min-h-11" disabled={busy || reading || !nextImageCursor} onClick={() => {
            void refresh(nextImageCursor, [...imagePage.current.history, imagePage.current.cursor]);
          }}>Next images</Button>
        </nav> : null}
      </div>
    </details>
  );
}

function SelectedRowEditor({
  row,
  agents,
  onSave,
}: {
  row: WorkspaceRow;
  agents: AgentOption[];
  onSave: (patch: Record<string, unknown>, expectedRowVersion: number | undefined) => Promise<number>;
}) {
  const listing = row.normalized_data;
  const [values, setValues] = useState({
    title: listing.title ?? "",
    address: listing.address ?? "",
    price: String((listing.listingType === "sale" ? listing.salePrice : listing.price) ?? ""),
    latitude: String(listing.latitude ?? ""),
    longitude: String(listing.longitude ?? ""),
    availabilityDate: listing.availabilityDate ?? "",
    propertyType: listing.propertyType ?? "",
    responsibleAgentId: listing.responsibleAgentId ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const rowVersion = useRef(row.row_version);
  return (
    <div className="mt-4 rounded-lg border border-forest/25 bg-accent/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <div><h3 className="text-sm font-semibold text-ink">Fix row {row.row_number}</h3><p className="text-xs text-muted-foreground">Save fields, then the row is revalidated immediately.</p></div>
        <StatusBadge tone="warning">{row.listing_import_issues.length} issues</StatusBadge>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-semibold text-muted-foreground">Title<Input value={values.title} onChange={(event) => setValues((current) => ({ ...current, title: event.target.value }))} className="mt-1" /></label>
        <label className="text-xs font-semibold text-muted-foreground sm:col-span-2">Address<Input value={values.address} onChange={(event) => setValues((current) => ({ ...current, address: event.target.value }))} className="mt-1" /></label>
        <label className="text-xs font-semibold text-muted-foreground">Price<Input type="number" min={1} value={values.price} onChange={(event) => setValues((current) => ({ ...current, price: event.target.value }))} className="mt-1" /></label>
        <label className="text-xs font-semibold text-muted-foreground">Latitude<Input type="number" step="any" value={values.latitude} onChange={(event) => setValues((current) => ({ ...current, latitude: event.target.value }))} className="mt-1" /></label>
        <label className="text-xs font-semibold text-muted-foreground">Longitude<Input type="number" step="any" value={values.longitude} onChange={(event) => setValues((current) => ({ ...current, longitude: event.target.value }))} className="mt-1" /></label>
        <label className="text-xs font-semibold text-muted-foreground">Availability<Input type="date" value={values.availabilityDate} onChange={(event) => setValues((current) => ({ ...current, availabilityDate: event.target.value }))} className="mt-1" /></label>
        <label className="text-xs font-semibold text-muted-foreground">Property type
          <select value={values.propertyType} onChange={(event) => setValues((current) => ({ ...current, propertyType: event.target.value }))} className="mt-1 h-11 w-full rounded-md border border-input bg-panel px-3 text-sm">
            <option value="">Choose…</option>
            {["apartment", "house", "room", "studio", "cottage", "townhouse"].map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-muted-foreground lg:col-span-2">Responsible agent
          <select value={values.responsibleAgentId} onChange={(event) => setValues((current) => ({ ...current, responsibleAgentId: event.target.value }))} className="mt-1 h-11 w-full rounded-md border border-input bg-panel px-3 text-sm">
            <option value="">Choose…</option>
            {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.label}</option>)}
          </select>
        </label>
      </div>
      <Button className="mt-4" disabled={busy || !values.title || !values.address || !values.price} onClick={async () => {
        setBusy(true);
        setMessage("");
        try {
          rowVersion.current = await onSave({
            title: values.title,
            address: values.address,
            ...(listing.listingType === "sale" ? { salePrice: Number(values.price) } : { price: Number(values.price) }),
            ...(values.latitude ? { latitude: Number(values.latitude) } : {}),
            ...(values.longitude ? { longitude: Number(values.longitude) } : {}),
            ...(values.availabilityDate ? { availabilityDate: values.availabilityDate } : {}),
            ...(values.propertyType ? { propertyType: values.propertyType } : {}),
            ...(values.responsibleAgentId ? { responsibleAgentId: values.responsibleAgentId } : {}),
          }, rowVersion.current);
        } catch (error) {
          setMessage(error instanceof Error && !(error instanceof SyntaxError) && !(error instanceof TypeError)
            ? error.message
            : "Could not confirm this row update. Your input is still here. Reload the current rows before retrying.");
        } finally { setBusy(false); }
      }}>Save and revalidate row</Button>
      {message ? <p role="alert" className="mt-3 text-sm font-medium text-destructive">{message}</p> : null}
    </div>
  );
}

export function ImportWorkspace(props: Parameters<typeof ImportJobWorkspace>[0]) {
  return <ImportJobWorkspace key={props.initialJob.id} {...props} />;
}

function ImportJobWorkspace({
  initialJob,
  initialConfiguration,
  initialRows,
  initialDuplicateCandidates = {},
  initialRowsError,
  initialNextCursor,
  agents,
  mapApiKey,
}: {
  initialJob: ImportJobSummary;
  initialConfiguration: Configuration;
  initialRows: WorkspaceRow[];
  initialDuplicateCandidates?: Record<string, ImportDuplicateCandidate>;
  initialRowsError?: string | null;
  initialNextCursor: number | null;
  agents: AgentOption[];
  mapApiKey?: string;
}) {
  const router = useRouter();
  const ready = useWorkspaceReady();
  const [job, setJob] = useState(initialJob);
  const jobVersionRef = useRef(initialJob.version);
  const jobActionQueue = useRef<Promise<unknown>>(Promise.resolve());
  const outcomeHeadingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { jobVersionRef.current = Math.max(jobVersionRef.current, job.version); }, [job.version]);
  const [configuration, setConfiguration] = useState(initialConfiguration);
  const [rows, setRows] = useState(initialRows);
  const [duplicateCandidates, setDuplicateCandidates] = useState(initialDuplicateCandidates);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [loadingRows, setLoadingRows] = useState(false);
  const [rowsReadError, setRowsReadError] = useState<{ message: string; loadMore: boolean } | null>(
    () => initialRowsError ? { message: initialRowsError, loadMore: false } : null,
  );
  const initialSelection = initialConfiguration.selection;
  const [savedSelection, setSavedSelection] = useState(() => JSON.stringify(initialSelection));
  const [selectedIds, setSelectedIds] = useState(() => new Set(
    initialSelection.mode === "explicit" ? initialSelection.included : [],
  ));
  const [excludedIds, setExcludedIds] = useState(() => new Set(
    initialSelection.mode === "all_matching" ? initialSelection.excluded : [],
  ));
  const [allMatching, setAllMatching] = useState(initialSelection.mode === "all_matching");
  const [filterState, setFilterState] = useState(
    initialSelection.mode === "all_matching" ? initialSelection.filter.states?.[0] ?? "" : "",
  );
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkAgent, setBulkAgent] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [rollbackConfirmation, setRollbackConfirmation] = useState("");
  const [view, setView] = useState<"table" | "map">("table");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const currentStep = stageStep(job.stage);
  const showingResults = job.stage === "confirming" || job.stage === "complete";
  const visibleRowState = showingResults ? "" : filterState;
  const rollbackComplete = job.messageCode === "rollback_complete";
  const rollbackIncomplete = job.messageCode === "rollback_incomplete";
  const rollbackConflicts = job.messageCode === "rollback_conflicts";
  const hasRollbackOutcome = rollbackComplete || rollbackIncomplete || rollbackConflicts;
  const reviewRequired = job.stage === "confirming" && job.messageCode === "selection_review_required";
  const outcomeTitle = rollbackComplete ? "Rollback complete"
    : rollbackIncomplete ? "Rollback needs attention"
    : rollbackConflicts ? "Rollback needs review"
    : reviewRequired ? "Review required"
    : job.stage === "complete" ? (job.failedRows > 0 ? "Import complete with issues" : "Import complete")
    : "Final confirmation required";
  const outcomeDetail = hasRollbackOutcome || reviewRequired
    ? job.messageDetail ?? "Review the saved results and reports before continuing."
    : job.stage === "complete"
      ? job.failedRows > 0
        ? `${job.failedRows} ${job.failedRows === 1 ? "row needs" : "rows need"} review. Open linked listings and download a report to review the saved results and failures.`
        : "Review saved results below or download a report. Linked listings show their current status. Audit snapshots remain available for rollback checks."
      : "This is the only step that may publish drafts or change an existing listing. Published updates must remain publish-ready.";
  const outcomeSuccess = job.stage === "complete" && !rollbackIncomplete && !rollbackConflicts && (rollbackComplete || job.failedRows === 0);

  const beginJobRead = useLatestRead(job.id);
  const beginRowsRead = useLatestRead(job.id + ":" + visibleRowState);
  const refreshJob = useCallback(async () => {
    const controller = beginJobRead();
    try {
    const response = await fetch(`/api/imports/${job.id}`, { cache: "no-store", signal: controller.signal });
    const payload = await response.json() as { ok: boolean; data?: { job: ImportJobSummary } };
    if (!controller.signal.aborted && payload.ok && payload.data && payload.data.job.id === job.id) {
      const fresh = payload.data.job;
      setJob(current => fresh.version >= current.version ? fresh : current);
    }
    } catch { /* A later refresh can recover without breaking the workspace. */ }
  }, [beginJobRead, job.id]);

  const readRows = useCallback(async (cursor?: number) => {
    const controller = beginRowsRead();
    setLoadingRows(true);
    setRowsReadError(null);
    try {
      const params = new URLSearchParams({ limit: "100", ...(visibleRowState ? { state: visibleRowState } : {}) });
      if (cursor !== undefined) params.set("cursor", String(cursor));
      const response = await fetch(`/api/imports/${job.id}/rows?${params}`, { cache: "no-store", signal: controller.signal });
      const payload = await response.json() as { ok: boolean; data?: { rows: WorkspaceRow[]; nextCursor: number | null; duplicateCandidates?: Record<string, ImportDuplicateCandidate> }; error?: { message?: string } };
      if (!response.ok || !payload.ok || !payload.data || !Array.isArray(payload.data.rows)) {
        throw new Error(payload.error?.message ?? "Unable to load import rows.");
      }
      if (!controller.signal.aborted) {
        const page = payload.data;
        setRows(current => cursor === undefined ? page.rows : [...current, ...page.rows]);
        setDuplicateCandidates(current => {
          const next: Record<string, ImportDuplicateCandidate> = cursor === undefined ? {} : { ...current };
          for (const row of page.rows) for (const id of row.duplicate_candidate_ids) delete next[id];
          return { ...next, ...page.duplicateCandidates };
        });
        setNextCursor(page.nextCursor);
      }
    } catch (error) {
      if (!controller.signal.aborted) setRowsReadError({
        message: error instanceof Error && !(error instanceof SyntaxError) && !(error instanceof TypeError)
          ? error.message : "Unable to load import rows. Your saved work is still here.",
        loadMore: cursor !== undefined,
      });
    } finally {
      if (!controller.signal.aborted) setLoadingRows(false);
    }
  }, [beginRowsRead, visibleRowState, job.id]);
  const refreshRows = useCallback(() => readRows(), [readRows]);
  const loadMoreRows = useCallback(() => nextCursor === null ? Promise.resolve() : readRows(nextCursor), [nextCursor, readRows]);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    const channel = supabase
      .channel(`listing-import-job:${job.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "listing_import_jobs", filter: `id=eq.${job.id}` }, () => {
        if (active) void refreshJob();
      })
      .subscribe();
    const interval = window.setInterval(() => void refreshJob(), 5_000);
    return () => {
      active = false;
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [job.id, refreshJob]);

  useEffect(() => {
    if (job.stage === "resolving" || job.stage === "preview" || job.stage === "confirming" || job.stage === "complete") {
      const timeout = window.setTimeout(() => void refreshRows(), 0);
      return () => window.clearTimeout(timeout);
    }
  }, [job.stage, refreshRows]);

  useEffect(() => {
    if (job.stage !== "resolving") return;
    const frame = window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('[data-blocker="true"]')?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [job.stage, rows]);

  const action = useCallback((actionName: string, extra: object = {}) => {
    // Selection autosaves and explicit actions share this job's version.
    const update = jobActionQueue.current.catch(() => undefined).then(async () => {
      setMessage("");
      const response = await fetch(`/api/imports/${job.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: actionName, ...extra, expectedVersion: jobVersionRef.current }),
      });
      const payload = await response.json() as { ok: boolean; data?: { job: ImportJobSummary; review?: { rowId: string | null; rowVersion: number | null } }; error?: { message: string } };
      if (!payload.ok || !payload.data) throw new Error(payload.error?.message ?? "Unable to update the import.");
      jobVersionRef.current = payload.data.job.version;
      if (actionName === "save_selection" && "selection" in extra) {
        setSavedSelection(JSON.stringify(extra.selection));
      }
      setJob(payload.data.job);
      return payload.data;
    });
    jobActionQueue.current = update;
    return update;
  }, [job.id]);

  const recoverAction = useCallback(async (actionName: string, extra: object = {}, onSuccess?: () => void) => {
    try {
      await action(actionName, extra);
      onSuccess?.();
    } catch (error) {
      const uncertain = "Could not confirm this update. Your import is still here. Reload the current state before retrying.";
      setMessage(error instanceof Error && !(error instanceof SyntaxError) && !(error instanceof TypeError) ? error.message : uncertain);
    }
  }, [action]);

  const selection: ImportSelection = useMemo(() => allMatching
    ? {
        mode: "all_matching",
        filter: { states: filterState ? [filterState as WorkspaceRow["state"]] : undefined },
        excluded: [...excludedIds],
      }
    : { mode: "explicit", included: [...selectedIds] }, [allMatching, excludedIds, filterState, selectedIds]);
  const effectiveSelectedIds = useMemo(
    () => showingResults
      ? new Set(rows.filter((row) => row.publication_selected).map((row) => row.id))
      : allMatching
        ? new Set(rows.filter((row) => !excludedIds.has(row.id)).map((row) => row.id))
        : selectedIds,
    [allMatching, excludedIds, rows, selectedIds, showingResults],
  );
  const updateRowSelection = useCallback((next: Set<string>) => {
    if (showingResults) return;
    if (!allMatching) {
      setSelectedIds(next);
      return;
    }
    setExcludedIds((current) => {
      const updated = new Set(current);
      rows.forEach((row) => next.has(row.id) ? updated.delete(row.id) : updated.add(row.id));
      return updated;
    });
  }, [allMatching, rows, showingResults]);

  useEffect(() => {
    if (job.stage !== "resolving" && job.stage !== "preview") return;
    if (JSON.stringify(selection) === savedSelection) return;
    const timeout = window.setTimeout(() => {
      void action("save_selection", { selection }).catch(() => undefined);
    }, 600);
    return () => window.clearTimeout(timeout);
  }, [action, job.stage, savedSelection, selection]);

  const resolveDuplicate = useCallback((row: WorkspaceRow, strategy: DuplicateStrategy, listingId?: string | null) => {
    startTransition(async () => {
      try {
        await action("resolve_duplicate", {
          resolution: {
            rowId: row.id,
            expectedRowVersion: row.row_version,
            strategy,
            listingId: strategy === "import_new" ? null : listingId !== undefined ? listingId
              : row.duplicate_candidate_ids.length === 1 ? row.duplicate_candidate_ids[0] : null,
          },
        });
        await refreshRows();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to save this duplicate action.");
      }
    });
  }, [action, refreshRows]);

  const content = (() => {
    if (job.stage === "upload" || job.stage === "source") {
      return <SourceUpload job={job} onUploaded={(nextJob, nextConfiguration) => {
        setConfiguration(nextConfiguration);
        setJob(nextJob);
      }} />;
    }
    if (job.stage === "mapping") return <MappingStep job={job} configuration={configuration} agents={agents} onJob={setJob} />;
    if (job.stage === "validating" || job.stage === "committing") return <ProcessingStep job={job} onAction={recoverAction} />;
    if (job.stage === "cancelled" || job.stage === "failed") {
      return (
        <section className="rounded-xl border border-status-error-border bg-status-error-surface p-6">
          <AlertCircle className="size-6 text-status-error-text" />
          <h2 className="mt-3 text-lg font-semibold text-ink">{job.stage === "cancelled" ? "Import cancelled safely" : "This import needs attention"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{job.messageDetail ?? "No completed rows were rolled back. Resume from the last durable cursor when ready."}</p>
          <Button className="mt-5" onClick={() => startTransition(() => recoverAction(job.stage === "failed" ? "retry" : "resume"))}>
            <RefreshCw className="size-4" /> Resume
          </Button>
        </section>
      );
    }

    const reviewMode = job.stage === "resolving";
    const previewMode = job.stage === "preview";
    const finalMode = showingResults;
    const selectedRow = !allMatching && selectedIds.size === 1
      ? rows.find((row) => selectedIds.has(row.id))
      : undefined;
    return (
      <section className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-panel p-4"><p className="text-xs font-semibold uppercase text-muted-foreground">Rows</p><p className="mt-1 text-2xl font-semibold text-ink">{job.totalRows}</p></div>
          <div className="rounded-lg border border-border bg-panel p-4"><p className="text-xs font-semibold uppercase text-muted-foreground">{showingResults ? hasRollbackOutcome ? "Saved before rollback" : "Saved results" : "Draft-ready"}</p><p className="mt-1 text-2xl font-semibold text-status-success-text">{showingResults ? job.committedRows : job.validRows}</p></div>
          <div className="rounded-lg border border-border bg-panel p-4"><p className="text-xs font-semibold uppercase text-muted-foreground">{showingResults ? "Import failures" : "Needs review"}</p><p className="mt-1 text-2xl font-semibold text-status-warning-text">{showingResults ? job.failedRows : job.warningRows + job.blockedRows}</p></div>
        </div>

        {reviewMode ? (
          <div className="rounded-lg border border-border bg-panel p-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Issue state
                <select value={filterState} onChange={(event) => { setFilterState(event.target.value); setNextCursor(null); }} className="mt-1 block h-10 min-w-44 rounded-md border border-input bg-panel px-2 text-sm normal-case text-ink">
                  <option value="">All rows</option>
                  <option value="parse_blocked">Blocking</option>
                  <option value="publish_blocked">Publish blockers</option>
                  <option value="warning">Warnings</option>
                  <option value="duplicate_review">Duplicates</option>
                </select>
              </label>
              <Button variant="outline" disabled={loadingRows} onClick={() => void refreshRows()}>{loadingRows ? "Loading rows…" : "Apply filter"}</Button>
              <label className="ml-auto inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-ink">
                <input
                  type="checkbox"
                  checked={allMatching}
                  onChange={(event) => {
                    setAllMatching(event.target.checked);
                    if (event.target.checked) setExcludedIds(new Set());
                  }}
                  className="size-4 accent-selection"
                />
                All matching rows except exclusions
              </label>
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-4">
              <label className="w-full text-xs font-semibold uppercase text-muted-foreground sm:w-auto">Bulk price<Input type="number" min={1} value={bulkPrice} onChange={(event) => setBulkPrice(event.target.value)} className="mt-1 block w-full normal-case sm:w-36" /></label>
              <label className="min-w-0 w-full text-xs font-semibold uppercase text-muted-foreground sm:w-auto sm:flex-1">Responsible agent
                <select value={bulkAgent} onChange={(event) => setBulkAgent(event.target.value)} className="mt-1 block h-11 w-full min-w-0 rounded-md border border-input bg-panel px-2 text-sm normal-case text-ink">
                  <option value="">No change</option>
                  {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.label}</option>)}
                </select>
              </label>
              <Button
                variant="secondary"
                disabled={pending || (!allMatching && selectedIds.size === 0) || (!bulkPrice && !bulkAgent)}
                onClick={() => startTransition(async () => {
                  try {
                    await action("bulk_patch", {
                      selection,
                      patch: {
                        ...(bulkPrice ? { price: Number(bulkPrice) } : {}),
                        ...(bulkAgent ? { responsibleAgentId: bulkAgent } : {}),
                      },
                    });
                    await refreshRows();
                  } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to apply the bulk fix."); }
                })}
              >
                Apply bulk fix
              </Button>
            </div>
          </div>
        ) : null}

        {previewMode ? (
          <div className="flex rounded-lg border border-border bg-panel p-1 md:hidden">
            <button type="button" onClick={() => setView("table")} className={cn("flex h-10 flex-1 items-center justify-center gap-2 rounded-md text-sm font-semibold", view === "table" && "bg-accent text-forest")}><Table2 className="size-4" /> Table</button>
            <button type="button" onClick={() => setView("map")} className={cn("flex h-10 flex-1 items-center justify-center gap-2 rounded-md text-sm font-semibold", view === "map" && "bg-accent text-forest")}><MapIcon className="size-4" /> Map</button>
          </div>
        ) : null}

        {showingResults ? <p className="text-sm leading-6 text-muted-foreground">{job.stage === "complete"
          ? "Checkmarks show the saved publication selection. Open a listing headline to review its details."
          : "Checkmarks show the rows prepared for final confirmation. Open a listing headline to review its private draft."}</p> : null}
        {rowsReadError ? <div role="alert" className="rounded-lg border border-status-error-border bg-status-error-surface p-4 text-sm text-status-error-text">
          <p>{rowsReadError.message}</p>
          <Button variant="outline" className="mt-3" disabled={loadingRows} onClick={() => void (rowsReadError.loadMore ? loadMoreRows() : refreshRows())}>Retry loading rows</Button>
        </div> : null}
        <div aria-busy={loadingRows} className={cn(previewMode && view === "map" ? "hidden md:block" : "block")}>
          <ImportRowsTable
            rows={rows}
            duplicateCandidates={duplicateCandidates}
            disabled={pending || showingResults}
            showEmptyState={!rowsReadError && !loadingRows}
            selectedIds={effectiveSelectedIds}
            onSelectionChange={updateRowSelection}
            onResolveDuplicate={resolveDuplicate}
          />
          {nextCursor ? (
            <div className="mt-3 flex justify-center">
              <Button variant="outline" disabled={loadingRows} onClick={() => void loadMoreRows()}>{loadingRows ? "Loading rows…" : "Load more rows"}</Button>
            </div>
          ) : null}
          {reviewMode && selectedRow ? (
            <SelectedRowEditor
              key={selectedRow.id}
              row={selectedRow}
              agents={agents}
              onSave={async (patch, expectedRowVersion) => {
                const saved = await action("patch_row", { rowId: selectedRow.id, expectedRowVersion, patch });
                if (saved.review?.rowId !== selectedRow.id || !saved.review.rowVersion
                  || (expectedRowVersion !== undefined && saved.review.rowVersion !== expectedRowVersion + 1)) {
                  throw new Error("Could not confirm this row update. Your input is still here. Reload the current rows before retrying.");
                }
                await refreshRows();
                return saved.review.rowVersion;
              }}
            />
          ) : null}
        </div>
        {previewMode ? (
          <div className={cn("md:block", view === "table" ? "hidden md:block" : "block")}>
            <ImportPreviewMap rows={rows} mapApiKey={mapApiKey} />
          </div>
        ) : null}
        {reviewMode || previewMode ? <ImageAssetsPanel jobId={job.id} rows={rows} /> : null}

        {reviewMode ? (
          <ActionBar>
            <p className="text-sm text-muted-foreground">Blocking rows remain in staging. Valid rows can proceed independently.</p>
            <Button onClick={() => startTransition(async () => {
              try { await action("continue_preview"); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to open preview."); }
            })}>Continue to preview <ArrowRight className="size-4" /></Button>
          </ActionBar>
        ) : null}
        {previewMode ? (
          <ActionBar>
            <div>
              <p className="text-sm font-semibold text-ink">Create selected new rows as private drafts</p>
              <p className="text-xs text-muted-foreground">Existing listings still will not change.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Type CREATE DRAFTS" className="w-48" />
              <Button disabled={confirmation !== "CREATE DRAFTS"} onClick={() => startTransition(async () => {
                try {
                  await action("save_selection", { selection });
                  await action("commit_drafts", { confirmation: "CREATE DRAFTS" });
                } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to commit drafts."); }
              })}>Commit drafts</Button>
            </div>
          </ActionBar>
        ) : null}
        {finalMode ? (
          <div className={cn("rounded-xl border p-5", outcomeSuccess ? "border-status-success-border bg-status-success-surface" : "border-status-warning-border bg-status-warning-surface")}>
            <FileArchive className={cn("size-6", outcomeSuccess ? "text-status-success-text" : "text-status-warning-text")} />
            <h2 ref={outcomeHeadingRef} tabIndex={-1} className="mt-3 text-lg font-semibold text-ink">{outcomeTitle}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {outcomeDetail}
            </p>
            {reviewRequired ? (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Button onClick={() => router.push("/dashboard/imports/new")}>Start a new import</Button>
                <Button variant="outline" onClick={() => router.push("/dashboard/imports")}>Back to imports</Button>
              </div>
            ) : job.stage !== "complete" ? (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Type PUBLISH AND APPLY" className="w-60" />
                <Button disabled={confirmation !== "PUBLISH AND APPLY"} onClick={() => startTransition(async () => {
                  await recoverAction("confirm_final", { confirmation: "PUBLISH AND APPLY" });
                })}>Publish and apply selected</Button>
                <Button variant="outline" onClick={() => router.push("/dashboard/imports")}>Leave safely resumable</Button>
              </div>
            ) : (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Button variant="outline" render={<a href={`/api/imports/${job.id}/report?format=csv`} />}>Download CSV report</Button>
                <Button variant="outline" render={<a href={`/api/imports/${job.id}/report?format=json`} />}>Download JSON report</Button>
                <Button variant="outline" onClick={() => router.push("/dashboard/imports")}>Back to imports</Button>
                {rollbackIncomplete ? (
                  <Button variant="outline" onClick={() => startTransition(async () => {
                    await recoverAction("rollback", { confirmation: "ROLL BACK IMPORT" }, () => outcomeHeadingRef.current?.focus({ preventScroll: true }));
                  })}>Retry rollback</Button>
                ) : !hasRollbackOutcome ? <>
                  <Input value={rollbackConfirmation} onChange={(event) => setRollbackConfirmation(event.target.value)} placeholder="Type ROLL BACK IMPORT" className="w-56" />
                  <Button
                  variant="destructive"
                  disabled={rollbackConfirmation !== "ROLL BACK IMPORT"}
                  onClick={() => startTransition(async () => {
                    await recoverAction("rollback", { confirmation: "ROLL BACK IMPORT" }, () => outcomeHeadingRef.current?.focus({ preventScroll: true }));
                  })}
                >
                  Roll back eligible changes
                  </Button>
                </> : null}
              </div>
            )}
          </div>
        ) : null}
      </section>
    );
  })();

  return (
    <fieldset disabled={!ready} className="min-w-0 border-0 p-0">
      <StepRail current={currentStep} />
      {message ? <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-status-error-border bg-status-error-surface p-3 text-sm text-status-error-text"><AlertCircle className="mt-0.5 size-4 shrink-0" />{message}</div> : null}
      {content}
    </fieldset>
  );
}
