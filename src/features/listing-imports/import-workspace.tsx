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

import { validateArchiveEntries } from "./adapters/archive-safety";
import { CANONICAL_IMPORT_FIELDS, suggestMapping } from "./field-registry";
import type { WorkspaceRow } from "./import-rows-table";
import { IMPORT_LIMITS } from "./limits";
import type {
  CanonicalImportListing,
  DuplicateStrategy,
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
                complete ? "border-forest bg-forest text-white" : active ? "border-forest text-forest" : "border-border text-muted-foreground",
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
  const onDrop = useCallback(async (files: File[]) => {
    const selected = files[0];
    if (!selected) return;
    setMessage("");
    setFile(selected);
    try {
      const result = await inspectSource(job.sourceKind, selected);
      setInspection(result);
      setSheet(result.sheets?.length === 1 ? result.sheets[0]! : "");
      setRecordPath(result.recordPaths?.length === 1 ? result.recordPaths[0]! : "");
    } catch (error) {
      setInspection(null);
      setMessage(error instanceof Error ? error.message : "Unable to inspect this source.");
    }
  }, [job.sourceKind]);
  const dropzone = useDropzone({
    onDrop,
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
      const chosenSheet = sheet || sourceInspection.sheets?.[0];
      const chosenPath = recordPath || sourceInspection.recordPaths?.[0];
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
        <Button type="button" onClick={beginUpload} disabled={busy || (!file && !paste.trim())}>
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

  const save = useCallback(async (startValidation = false) => {
    const saveResponse = await fetch(`/api/imports/${job.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "save_mapping", mapping, defaults: { ...configuration.defaults, responsibleAgentId: agentId } }),
    });
    const savePayload = await saveResponse.json() as { ok: boolean; data?: { job: ImportJobSummary }; error?: { message: string } };
    if (!savePayload.ok || !savePayload.data) throw new Error(savePayload.error?.message ?? "Unable to save the mapping.");
    if (!startValidation) {
      onJob(savePayload.data.job);
      return;
    }
    const startResponse = await fetch(`/api/imports/${job.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "start_validation" }),
    });
    const startPayload = await startResponse.json() as { ok: boolean; data?: { job: ImportJobSummary }; error?: { message: string } };
    if (!startPayload.ok || !startPayload.data) throw new Error(startPayload.error?.message ?? "Unable to start validation.");
    onJob(startPayload.data.job);
  }, [agentId, configuration.defaults, job.id, mapping, onJob]);

  useEffect(() => {
    if (autosaveRef.current) clearTimeout(autosaveRef.current);
    autosaveRef.current = setTimeout(() => { void save(false).catch(() => undefined); }, 900);
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
          <StatusBadge tone="forest">Autosaved template</StatusBadge>
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
          { label: "Warnings", value: job.warningRows, tone: "clay" },
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
};

function ImageAssetsPanel({ jobId, rows }: { jobId: string; rows: WorkspaceRow[] }) {
  const folderInput = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<WorkspaceAsset[]>([]);
  const [urls, setUrls] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState("");

  const beginAssetRead = useLatestRead(jobId);
  const refresh = useCallback(async () => {
    const controller = beginAssetRead();
    try {
      const response = await fetch(`/api/imports/${jobId}/assets`, { cache: "no-store", signal: controller.signal });
      const payload = await response.json() as { ok: boolean; data?: { assets: WorkspaceAsset[] } };
      if (!controller.signal.aborted && payload.ok && payload.data) setAssets(payload.data.assets);
    } catch { /* Preserve visible assets when an optional refresh fails. */ }
  }, [beginAssetRead, jobId]);

  useEffect(() => {
    folderInput.current?.setAttribute("webkitdirectory", "");
    const timeout = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeout);
  }, [refresh]);

  const registerFile = useCallback(async (file: File, position: number, total: number) => {
    const { uploadImportAsset } = await import("./upload");
    const storagePath = await uploadImportAsset(jobId, file, (value) => setProgress(`${position + 1}/${total} · ${value}%`));
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
    const payload = await response.json() as { ok: boolean; error?: { message: string } };
    if (!payload.ok) throw new Error(payload.error?.message ?? `Unable to register ${file.name}.`);
  }, [jobId]);

  const addFiles = async (fileList: FileList | File[] | null) => {
    const files = [...(fileList ?? [])].filter((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type));
    if (!files.length) return;
    setBusy(true);
    setMessage("");
    let next = 0;
    try {
      await Promise.all(Array.from({ length: Math.min(4, files.length) }, async () => {
        while (next < files.length) {
          const position = next++;
          await registerFile(files[position]!, position, files.length);
        }
      }));
      await refresh();
      setProgress("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "One or more images could not be uploaded.");
    } finally {
      setBusy(false);
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
    const { BlobReader, BlobWriter, ZipReader } = await import("@zip.js/zip.js");
    const reader = new ZipReader(new BlobReader(archive));
    try {
      const entries = await reader.getEntries();
      const safety = validateArchiveEntries(entries.map((entry) => ({
        filename: entry.filename,
        compressedSize: entry.compressedSize,
        uncompressedSize: entry.uncompressedSize,
        directory: entry.directory,
      })));
      if (!safety.safe) throw new Error(safety.issues[0] ?? "The ZIP archive is unsafe.");
      const { uploadImportArchive } = await import("./upload");
      const archivePath = await uploadImportArchive(jobId, archive, (value) => setProgress(`ZIP · ${value}%`));
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
      const registerArchivePayload = await registerArchiveResponse.json() as { ok: boolean; error?: { message: string } };
      if (!registerArchivePayload.ok) throw new Error(registerArchivePayload.error?.message ?? "Unable to register the ZIP archive.");
      const imageEntries = entries.filter((entry) => !entry.directory);
      let next = 0;
      await Promise.all(Array.from({ length: Math.min(4, imageEntries.length) }, async () => {
        while (next < imageEntries.length) {
          const position = next++;
          const entry = imageEntries[position]!;
          const extension = entry.filename.split(".").at(-1)?.toLowerCase();
          const mimeType = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
          const blob = await entry.getData(new BlobWriter(mimeType));
          await registerFile(new File([blob], entry.filename, { type: mimeType }), position, imageEntries.length);
        }
      }));
      await refresh();
      setProgress("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The ZIP archive could not be processed safely.");
    } finally {
      await reader.close();
      setBusy(false);
    }
  };

  const addUrls = async () => {
    const list = [...new Set(urls.split(/\r?\n/).map((url) => url.trim()).filter(Boolean))];
    if (!list.length) return;
    setBusy(true);
    setMessage("");
    let next = 0;
    try {
      await Promise.all(Array.from({ length: Math.min(4, list.length) }, async () => {
        while (next < list.length) {
          const position = next++;
          setProgress(`${position + 1}/${list.length}`);
          const response = await fetch(`/api/imports/${jobId}/assets`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ kind: "url", url: list[position] }),
          });
          const payload = await response.json() as { ok: boolean; error?: { message: string } };
          if (!payload.ok) throw new Error(payload.error?.message ?? "An image URL could not be imported.");
        }
      }));
      setUrls("");
      await refresh();
      setProgress("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "One or more image URLs could not be imported.");
    } finally {
      setBusy(false);
    }
  };

  const arrange = async (asset: WorkspaceAsset, patch: Partial<{ rowId: string | null; sortOrder: number; isCover: boolean }>) => {
    const rowId = patch.rowId === undefined ? asset.row_id : patch.rowId;
    const response = await fetch(`/api/imports/${jobId}/assets`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        assetId: asset.id,
        rowId,
        sortOrder: patch.sortOrder ?? asset.sort_order ?? 0,
        isCover: patch.isCover ?? asset.is_cover,
      }),
    });
    const payload = await response.json() as { ok: boolean; error?: { message: string } };
    if (!payload.ok) setMessage(payload.error?.message ?? "Unable to arrange this image.");
    await refresh();
  };

  return (
    <details className="rounded-lg border border-border bg-panel">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-semibold text-ink">
        <ImagePlus className="size-4 text-forest" /> Images <StatusBadge tone="neutral">{assets.length}</StatusBadge>
      </summary>
      <div className="border-t border-border p-4">
        <p className="text-sm leading-6 text-muted-foreground">Folder names, mapped filenames, and source references are matched in that order. Ambiguous images stay unattached.</p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-md border border-border bg-warm-surface p-3">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Images or image folder</label>
            <div className="mt-2 flex flex-wrap gap-2">
              <Input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={(event) => void addFiles(event.target.files)} className="max-w-sm" />
              <Input ref={folderInput} type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={(event) => void addFiles(event.target.files)} className="max-w-sm" />
              <Input type="file" accept=".zip,application/zip" disabled={busy} onChange={(event) => void addArchive(event.target.files?.[0])} className="max-w-sm" />
            </div>
          </div>
          <div className="rounded-md border border-border bg-warm-surface p-3">
            <label htmlFor="image-urls" className="text-xs font-semibold uppercase text-muted-foreground">HTTPS image URLs, one per line</label>
            <Textarea id="image-urls" value={urls} onChange={(event) => setUrls(event.target.value)} className="mt-2 min-h-24 font-mono text-xs" />
            <Button type="button" variant="outline" className="mt-2" disabled={busy || !urls.trim()} onClick={() => void addUrls()}>Import safe URLs</Button>
          </div>
        </div>
        {progress ? <p className="mt-3 text-xs font-semibold tabular-nums text-forest">Uploading {progress}</p> : null}
        {message ? <p role="alert" className="mt-3 text-sm font-medium text-destructive">{message}</p> : null}
        {assets.length ? (
          <div className="mt-4 max-h-72 overflow-auto rounded-md border border-border">
            {assets.map((asset) => (
              <div key={asset.id} className="grid min-h-14 grid-cols-[minmax(0,1fr)_minmax(10rem,16rem)_5rem_5rem] items-center gap-2 border-b border-border px-3 py-2 text-xs">
                <span className="truncate font-semibold text-ink">{asset.source_name ?? "Imported image"}</span>
                <select value={asset.row_id ?? ""} onChange={(event) => void arrange(asset, { rowId: event.target.value || null })} className="h-9 rounded-md border border-input bg-panel px-2">
                  <option value="">Unmatched</option>
                  {rows.map((row) => <option key={row.id} value={row.id}>Row {row.row_number}: {row.normalized_data.title ?? "Untitled"}</option>)}
                </select>
                <Input aria-label={`Order for ${asset.source_name}`} type="number" min={0} max={19} value={asset.sort_order ?? 0} disabled={!asset.row_id} onChange={(event) => void arrange(asset, { sortOrder: Number(event.target.value) })} className="h-9" />
                <label className="flex items-center gap-1 font-semibold text-muted-foreground"><input type="checkbox" checked={asset.is_cover} disabled={!asset.row_id} onChange={(event) => void arrange(asset, { isCover: event.target.checked })} /> Cover</label>
              </div>
            ))}
          </div>
        ) : null}
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
  onSave: (patch: Record<string, unknown>) => Promise<void>;
}) {
  const listing = row.normalized_data;
  const [values, setValues] = useState({
    title: listing.title ?? "",
    address: listing.address ?? "",
    price: String(listing.price ?? listing.salePrice ?? ""),
    latitude: String(listing.latitude ?? ""),
    longitude: String(listing.longitude ?? ""),
    availabilityDate: listing.availabilityDate ?? "",
    propertyType: listing.propertyType ?? "",
    responsibleAgentId: listing.responsibleAgentId ?? "",
  });
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-4 rounded-lg border border-forest/25 bg-accent/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <div><h3 className="text-sm font-semibold text-ink">Fix row {row.row_number}</h3><p className="text-xs text-muted-foreground">Save fields, then the row is revalidated immediately.</p></div>
        <StatusBadge tone="warning">{row.listing_import_issues.length} issues</StatusBadge>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
        try {
          await onSave({
            title: values.title,
            address: values.address,
            price: Number(values.price),
            ...(values.latitude ? { latitude: Number(values.latitude) } : {}),
            ...(values.longitude ? { longitude: Number(values.longitude) } : {}),
            ...(values.availabilityDate ? { availabilityDate: values.availabilityDate } : {}),
            ...(values.propertyType ? { propertyType: values.propertyType } : {}),
            ...(values.responsibleAgentId ? { responsibleAgentId: values.responsibleAgentId } : {}),
          });
        } finally { setBusy(false); }
      }}>Save and revalidate row</Button>
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
  initialNextCursor,
  agents,
  mapApiKey,
}: {
  initialJob: ImportJobSummary;
  initialConfiguration: Configuration;
  initialRows: WorkspaceRow[];
  initialNextCursor: number | null;
  agents: AgentOption[];
  mapApiKey?: string;
}) {
  const router = useRouter();
  const [job, setJob] = useState(initialJob);
  const [configuration, setConfiguration] = useState(initialConfiguration);
  const [rows, setRows] = useState(initialRows);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const initialSelection = initialConfiguration.selection;
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

  const beginJobRead = useLatestRead(job.id);
  const beginRowsRead = useLatestRead(job.id + ":" + filterState);
  const refreshJob = useCallback(async () => {
    const controller = beginJobRead();
    try {
    const response = await fetch(`/api/imports/${job.id}`, { cache: "no-store", signal: controller.signal });
    const payload = await response.json() as { ok: boolean; data?: { job: ImportJobSummary } };
    if (!controller.signal.aborted && payload.ok && payload.data && payload.data.job.id === job.id) setJob(payload.data.job);
    } catch { /* A later refresh can recover without breaking the workspace. */ }
  }, [beginJobRead, job.id]);

  const refreshRows = useCallback(async () => {
    const controller = beginRowsRead();
    try {
    const params = new URLSearchParams({ limit: "100", ...(filterState ? { state: filterState } : {}) });
    const response = await fetch(`/api/imports/${job.id}/rows?${params}`, { cache: "no-store", signal: controller.signal });
    const payload = await response.json() as { ok: boolean; data?: { rows: WorkspaceRow[]; nextCursor: number | null } };
    if (!controller.signal.aborted && payload.ok && payload.data) {
      setRows(payload.data.rows);
      setNextCursor(payload.data.nextCursor);
    }
    } catch { /* Keep the last valid rows while the request is unavailable. */ }
  }, [beginRowsRead, filterState, job.id]);

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

  const action = useCallback(async (actionName: string, extra: object = {}) => {
    setMessage("");
    const response = await fetch(`/api/imports/${job.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: actionName, ...extra }),
    });
    const payload = await response.json() as { ok: boolean; data?: { job: ImportJobSummary }; error?: { message: string } };
    if (!payload.ok || !payload.data) throw new Error(payload.error?.message ?? "Unable to update the import.");
    setJob(payload.data.job);
  }, [job.id]);

  const selection: ImportSelection = useMemo(() => allMatching
    ? {
        mode: "all_matching",
        filter: { states: filterState ? [filterState as WorkspaceRow["state"]] : undefined },
        excluded: [...excludedIds],
      }
    : { mode: "explicit", included: [...selectedIds] }, [allMatching, excludedIds, filterState, selectedIds]);
  const effectiveSelectedIds = useMemo(
    () => allMatching
      ? new Set(rows.filter((row) => !excludedIds.has(row.id)).map((row) => row.id))
      : selectedIds,
    [allMatching, excludedIds, rows, selectedIds],
  );
  const updateRowSelection = useCallback((next: Set<string>) => {
    if (!allMatching) {
      setSelectedIds(next);
      return;
    }
    setExcludedIds((current) => {
      const updated = new Set(current);
      rows.forEach((row) => next.has(row.id) ? updated.delete(row.id) : updated.add(row.id));
      return updated;
    });
  }, [allMatching, rows]);

  useEffect(() => {
    if (job.stage !== "resolving" && job.stage !== "preview") return;
    const timeout = window.setTimeout(() => {
      void action("save_selection", { selection }).catch(() => undefined);
    }, 600);
    return () => window.clearTimeout(timeout);
  }, [action, job.stage, selection]);

  const resolveDuplicate = useCallback((row: WorkspaceRow, strategy: DuplicateStrategy) => {
    startTransition(async () => {
      try {
        await action("resolve_duplicate", {
          resolution: {
            rowId: row.id,
            strategy,
            listingId: strategy === "import_new" ? null : row.duplicate_candidate_ids[0] ?? null,
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
    if (job.stage === "validating" || job.stage === "committing") return <ProcessingStep job={job} onAction={action} />;
    if (job.stage === "cancelled" || job.stage === "failed") {
      return (
        <section className="rounded-xl border border-status-error-border bg-status-error-surface p-6">
          <AlertCircle className="size-6 text-status-error-text" />
          <h2 className="mt-3 text-lg font-semibold text-ink">{job.stage === "cancelled" ? "Import cancelled safely" : "This import needs attention"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{job.messageDetail ?? "No completed rows were rolled back. Resume from the last durable cursor when ready."}</p>
          <Button className="mt-5" onClick={() => startTransition(() => action(job.stage === "failed" ? "retry" : "resume"))}>
            <RefreshCw className="size-4" /> Resume
          </Button>
        </section>
      );
    }

    const reviewMode = job.stage === "resolving";
    const previewMode = job.stage === "preview";
    const finalMode = job.stage === "confirming" || job.stage === "complete";
    const selectedRow = !allMatching && selectedIds.size === 1
      ? rows.find((row) => selectedIds.has(row.id))
      : undefined;
    return (
      <section className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-panel p-4"><p className="text-xs font-semibold uppercase text-muted-foreground">Rows</p><p className="mt-1 text-2xl font-semibold text-ink">{job.totalRows}</p></div>
          <div className="rounded-lg border border-border bg-panel p-4"><p className="text-xs font-semibold uppercase text-muted-foreground">Draft-ready</p><p className="mt-1 text-2xl font-semibold text-status-success-text">{job.validRows}</p></div>
          <div className="rounded-lg border border-border bg-panel p-4"><p className="text-xs font-semibold uppercase text-muted-foreground">Needs review</p><p className="mt-1 text-2xl font-semibold text-status-warning-text">{job.warningRows + job.blockedRows}</p></div>
        </div>

        {reviewMode ? (
          <div className="rounded-lg border border-border bg-panel p-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Issue state
                <select value={filterState} onChange={(event) => setFilterState(event.target.value)} className="mt-1 block h-10 min-w-44 rounded-md border border-input bg-panel px-2 text-sm normal-case text-ink">
                  <option value="">All rows</option>
                  <option value="parse_blocked">Blocking</option>
                  <option value="publish_blocked">Publish blockers</option>
                  <option value="warning">Warnings</option>
                  <option value="duplicate_review">Duplicates</option>
                </select>
              </label>
              <Button variant="outline" onClick={() => void refreshRows()}>Apply filter</Button>
              <label className="ml-auto inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-ink">
                <input
                  type="checkbox"
                  checked={allMatching}
                  onChange={(event) => {
                    setAllMatching(event.target.checked);
                    if (event.target.checked) setExcludedIds(new Set());
                  }}
                  className="size-4 accent-forest"
                />
                All matching rows except exclusions
              </label>
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-4">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Bulk price<Input type="number" min={1} value={bulkPrice} onChange={(event) => setBulkPrice(event.target.value)} className="mt-1 w-36 normal-case" /></label>
              <label className="text-xs font-semibold uppercase text-muted-foreground">Responsible agent
                <select value={bulkAgent} onChange={(event) => setBulkAgent(event.target.value)} className="mt-1 block h-11 min-w-56 rounded-md border border-input bg-panel px-2 text-sm normal-case text-ink">
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

        <div className={cn(previewMode && view === "map" ? "hidden md:block" : "block")}>
          <ImportRowsTable
            rows={rows}
            selectedIds={effectiveSelectedIds}
            onSelectionChange={updateRowSelection}
            onResolveDuplicate={resolveDuplicate}
          />
          {nextCursor ? (
            <div className="mt-3 flex justify-center">
              <Button variant="outline" onClick={async () => {
                const response = await fetch(`/api/imports/${job.id}/rows?cursor=${nextCursor}&limit=100`);
                const payload = await response.json() as { ok: boolean; data?: { rows: WorkspaceRow[]; nextCursor: number | null } };
                if (payload.ok && payload.data) {
                  setRows((current) => [...current, ...payload.data!.rows]);
                  setNextCursor(payload.data.nextCursor);
                }
              }}>Load more rows</Button>
            </div>
          ) : null}
          {reviewMode && selectedRow ? (
            <SelectedRowEditor
              key={selectedRow.id}
              row={selectedRow}
              agents={agents}
              onSave={async (patch) => {
                await action("patch_row", { rowId: selectedRow.id, patch });
                await refreshRows();
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
          <div className="rounded-xl border border-status-warning-border bg-status-warning-surface p-5">
            <FileArchive className="size-6 text-status-warning-text" />
            <h2 className="mt-3 text-lg font-semibold text-ink">{job.stage === "complete" ? "Import complete" : "Final confirmation required"}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {job.stage === "complete"
                ? "Selected drafts and reviewed duplicate changes were applied. Audit snapshots remain available for rollback checks."
                : "This is the only step that may publish drafts or change an existing listing. Published updates must remain publish-ready."}
            </p>
            {job.stage !== "complete" ? (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Type PUBLISH AND APPLY" className="w-60" />
                <Button disabled={confirmation !== "PUBLISH AND APPLY"} onClick={() => startTransition(async () => {
                  try { await action("confirm_final", { confirmation: "PUBLISH AND APPLY" }); }
                  catch (error) { setMessage(error instanceof Error ? error.message : "Unable to start final confirmation."); }
                })}>Publish and apply selected</Button>
                <Button variant="outline" onClick={() => router.push("/dashboard/imports")}>Leave safely resumable</Button>
              </div>
            ) : (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Button variant="outline" render={<a href={`/api/imports/${job.id}/report?format=csv`} />}>Download CSV report</Button>
                <Button variant="outline" render={<a href={`/api/imports/${job.id}/report?format=json`} />}>Download JSON report</Button>
                <Button variant="outline" onClick={() => router.push("/dashboard/imports")}>Back to imports</Button>
                <Input value={rollbackConfirmation} onChange={(event) => setRollbackConfirmation(event.target.value)} placeholder="Type ROLL BACK IMPORT" className="w-56" />
                <Button
                  variant="destructive"
                  disabled={rollbackConfirmation !== "ROLL BACK IMPORT"}
                  onClick={() => startTransition(async () => {
                    try { await action("rollback", { confirmation: "ROLL BACK IMPORT" }); }
                    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to roll back this import."); }
                  })}
                >
                  Roll back eligible changes
                </Button>
              </div>
            )}
          </div>
        ) : null}
      </section>
    );
  })();

  return (
    <>
      <StepRail current={currentStep} />
      {message ? <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-status-error-border bg-status-error-surface p-3 text-sm text-status-error-text"><AlertCircle className="mt-0.5 size-4 shrink-0" />{message}</div> : null}
      {content}
    </>
  );
}
