"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight, ImagePlus, Trash2 } from "lucide-react";
import { parseRandInput, formatDealPrice, SPECIAL_PHOTO_LIMIT } from "./deal-schema";
export type CardDraftPresentation = { mediaIds?: string[]; mediaRightsConfirmed?: boolean; priceCents?: number; originalPriceCents?: number };
type Media = { id: string; url: string };
export function MediaFields({ category, target, version, value, onChange, disabled, onBusyChange }: { category: string; target: string; version: number; value: CardDraftPresentation; onChange: (next: CardDraftPresentation) => void; disabled?: boolean; onBusyChange?: (busy: boolean) => void }) {
  const [media, setMedia] = useState<Media[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const inFlight = useRef(false), special = category !== "service", ids = value.mediaIds ?? [], limit = special ? SPECIAL_PHOTO_LIMIT : 20;
  useEffect(() => { const controller = new AbortController(); void fetch("/api/discovery-media?" + new URLSearchParams({ category, target }), { cache: "no-store", signal: controller.signal }).then(async response => { if (!response.ok) throw new Error(); return response.json(); }).then(result => setMedia(result.media)).catch(() => { if (!controller.signal.aborted) setError("Photo previews could not be loaded. Retry by reopening this draft."); }); return () => controller.abort(); }, [category, target]);
  async function upload(files: FileList | null) {
    if (!files?.length || inFlight.current || disabled) return;
    if (ids.length + files.length > limit) { setError("This card supports up to " + limit + " photos."); return; }
    inFlight.current = true; setBusy(true); onBusyChange?.(true); setError(""); let nextIds = [...ids];
    try {
      for (const file of Array.from(files)) {
        const body = new FormData(); body.set("file", file); body.set("category", category); body.set("target", target); body.set("expectedVersion", String(version));
        const response = await fetch("/api/discovery-media", { method: "POST", body }); const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Upload failed.");
        setMedia(previous => [...previous, result.media]); nextIds = [...nextIds, result.media.id]; onChange({ ...value, mediaIds: nextIds, mediaRightsConfirmed: false });
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Upload failed."); }
    finally { inFlight.current = false; setBusy(false); onBusyChange?.(false); }
  }
  function move(index: number, direction: number) { const next = [...ids]; [next[index], next[index + direction]] = [next[index + direction]!, next[index]!]; onChange({ ...value, mediaIds: next }); }
  return <fieldset disabled={disabled || busy} className="space-y-3"><legend className="mb-3 text-lg font-semibold">{special ? "Special photos" : "Service photos"}</legend>
    <div className="flex flex-wrap gap-3">{ids.map((id, index) => { const photo = media.find(item => item.id === id); return <div key={id} className="w-40 space-y-1"><div className="relative h-24 overflow-hidden rounded-xl bg-muted">{photo ? <Image src={photo.url} alt={(special ? "Special photo " : "Service photo ") + (index + 1)} fill sizes="160px" className="object-cover" /> : <span className="flex h-full items-center justify-center text-xs">Saved photo</span>}</div>{special ? <p className="text-xs font-medium">{index === 0 ? "Cover photo" : "Photo " + (index + 1)}</p> : null}<div className="flex justify-between"><button type="button" aria-label={"Move photo " + (index + 1) + " earlier"} disabled={index === 0} onClick={() => move(index, -1)} className="flex size-11 items-center justify-center disabled:opacity-40"><ArrowLeft size={16} /></button><button type="button" aria-label={"Move photo " + (index + 1) + " later"} disabled={index === ids.length - 1} onClick={() => move(index, 1)} className="flex size-11 items-center justify-center disabled:opacity-40"><ArrowRight size={16} /></button><button type="button" aria-label="Remove photo from draft" onClick={() => { onChange({ ...value, mediaIds: ids.filter(value => value !== id), mediaRightsConfirmed: false }); void fetch("/api/discovery-media", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category, target, media: id }) }).catch(() => {}); }} className="flex size-11 items-center justify-center"><Trash2 size={16} /></button></div></div>; })}</div>
    {ids.length < limit ? <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold"><ImagePlus size={18} />{busy ? "Uploading…" : "Upload photo"}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => { void upload(event.target.files); event.target.value = ""; }} /></label> : null}
    <p className="text-xs text-muted-foreground">JPEG, PNG or WebP, up to 10 MB each. Save the draft after changing photos.</p>
    {special ? <p className="text-xs text-muted-foreground">Add 1–10 photos before submitting. The first photo appears on cards; all photos appear in the details.</p> : null}
    {ids.length ? <label className="flex min-h-11 items-start gap-3 text-sm"><input type="checkbox" className="mt-1 size-4" checked={value.mediaRightsConfirmed ?? false} onChange={event => onChange({ ...value, mediaRightsConfirmed: event.target.checked })} /><span>I own these photos or have permission to publish them.</span></label> : null}
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
  </fieldset>;
}
export function DealPriceFields({ value, onChange, disabled }: { value: CardDraftPresentation; onChange: (value: CardDraftPresentation) => void; disabled?: boolean }) {
  const [price, setPrice] = useState(value.priceCents === undefined ? "" : (value.priceCents / 100).toFixed(2)), [original, setOriginal] = useState(value.originalPriceCents === undefined ? "" : (value.originalPriceCents / 100).toFixed(2));
  const [error, setError] = useState("");
  function change(nextPrice: string, nextOriginal: string) { setPrice(nextPrice); setOriginal(nextOriginal); try { onChange({ ...value, priceCents: parseRandInput(nextPrice), originalPriceCents: parseRandInput(nextOriginal) }); setError(""); } catch (caught) { onChange({ ...value, priceCents: Number.NaN }); setError(caught instanceof Error ? caught.message : "Invalid price."); } }
  return <fieldset disabled={disabled} className="grid gap-3 sm:grid-cols-2"><legend className="mb-3 text-lg font-semibold">Optional deal price</legend><label className="grid gap-2 text-sm">Special price (R)<input type="text" inputMode="decimal" value={price} onChange={event => change(event.target.value, original)} className="min-h-11 rounded-xl border bg-panel px-3" /></label><label className="grid gap-2 text-sm">Original price (R)<input type="text" inputMode="decimal" value={original} onChange={event => change(price, event.target.value)} className="min-h-11 rounded-xl border bg-panel px-3" /></label><p className="text-xs text-muted-foreground sm:col-span-2">Leave blank for no advertised price, or enter 0 for Free. Original price must be higher.</p>{error ? <p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p> : null}</fieldset>;
}
export function MediaReviewPreview({ category, target, content }: { category: string; target: string; content: CardDraftPresentation }) {
  const [media, setMedia] = useState<Media[]>([]), [error, setError] = useState(false);
  useEffect(() => { if (!content.mediaIds?.length) return; const controller = new AbortController(); void fetch("/api/discovery-media?" + new URLSearchParams({ category, target }), { cache: "no-store", signal: controller.signal }).then(async response => { if (!response.ok) throw new Error(); return response.json(); }).then(result => setMedia(result.media)).catch(() => { if (!controller.signal.aborted) setError(true); }); return () => controller.abort(); }, [category, target, content.mediaIds]);
  return <section aria-label="Submitted photos and pricing" className="space-y-3">{content.priceCents !== undefined ? <p className="font-semibold">{formatDealPrice(content.priceCents)}{content.originalPriceCents !== undefined ? " · Original " + formatDealPrice(content.originalPriceCents) : ""}</p> : null}<div className="flex flex-wrap gap-3">{content.mediaIds?.map(id => { const photo = media.find(item => item.id === id); return <div key={id} className="relative h-32 w-48 overflow-hidden rounded-xl bg-muted">{photo ? <Image src={photo.url} alt="Submitted photo for review" fill sizes="192px" className="object-cover" /> : <span className="p-3 text-sm">{error ? "Photo unavailable. Reload before approval." : "Loading photo…"}</span>}</div>; })}</div>{content.mediaIds?.length ? <p className="text-xs">Poster photo rights: {content.mediaRightsConfirmed ? "confirmed for this snapshot" : "not confirmed"}. Check each photo and its permission evidence before approval.</p> : null}</section>;
}
