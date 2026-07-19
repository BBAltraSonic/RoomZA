"use client";

/* eslint-disable @next/next/no-img-element -- admin previews use newly uploaded URLs with unknown dimensions */

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bold,
  Clipboard,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Save,
  Send,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/premium/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { deleteBlogMedia, saveBlogPost, setBlogPostStatus, uploadBlogMedia } from "../actions";
import { BlogMarkdown } from "../markdown";
import type { BlogEditorInput, BlogPostDetail, BlogPostMedia, BlogPostStatus } from "../types";
import { createBlogSlug, formatBlogDate } from "../utils";
import { DeleteBlogPostButton } from "./admin-blog-controls";

type FieldErrors = Partial<Record<keyof BlogEditorInput, string[]>>;

function actionFieldErrors(result: { success: boolean; details?: unknown }): FieldErrors {
  if (!result.details || typeof result.details !== "object" || !("fieldErrors" in result.details)) return {};
  return (result.details as { fieldErrors: FieldErrors }).fieldErrors;
}

function FieldMessage({ errors }: { errors?: string[] }) {
  return errors?.length ? <span className="mt-1 block text-xs font-medium text-destructive">{errors[0]}</span> : null;
}

function ToolbarButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return <Button type="button" size="icon-sm" variant="ghost" aria-label={label} title={label} onClick={onClick}>{children}</Button>;
}

export function BlogEditor({ initialPost }: { initialPost: BlogPostDetail }) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bodyHistoryRef = useRef([initialPost.bodyMarkdown]);
  const bodyHistoryIndexRef = useRef(0);
  const [pending, startTransition] = useTransition();
  const [activePane, setActivePane] = useState<"write" | "preview">("write");
  const [status, setStatus] = useState<BlogPostStatus>(initialPost.status);
  const [publishedAt, setPublishedAt] = useState(initialPost.publishedAt);
  const [media, setMedia] = useState(initialPost.media);
  const [slugTouched, setSlugTouched] = useState(Boolean(initialPost.slug));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [value, setValue] = useState<BlogEditorInput>({
    id: initialPost.id,
    title: initialPost.title,
    slug: initialPost.slug,
    topic: initialPost.topic,
    excerpt: initialPost.excerpt,
    bodyMarkdown: initialPost.bodyMarkdown,
  });
  const [savedSignature, setSavedSignature] = useState(JSON.stringify(value));
  const dirty = JSON.stringify(value) !== savedSignature;
  const slugLocked = Boolean(initialPost.publishedAt);
  const cover = media.find((item) => item.kind === "cover") ?? null;
  const inlineMedia = media.filter((item) => item.kind === "inline");

  useEffect(() => {
    const preventLoss = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, [dirty]);

  function update<K extends keyof BlogEditorInput>(key: K, next: BlogEditorInput[K]) {
    if (key === "bodyMarkdown") {
      const body = String(next);
      const history = bodyHistoryRef.current;
      if (history[bodyHistoryIndexRef.current] !== body) {
        bodyHistoryRef.current = [...history.slice(0, bodyHistoryIndexRef.current + 1), body].slice(-200);
        bodyHistoryIndexRef.current = bodyHistoryRef.current.length - 1;
      }
    }
    setValue((current) => {
      const changed = { ...current, [key]: next };
      if (key === "title" && !slugTouched && !slugLocked) changed.slug = createBlogSlug(String(next));
      return changed;
    });
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function moveBodyHistory(direction: -1 | 1) {
    const nextIndex = Math.min(
      bodyHistoryRef.current.length - 1,
      Math.max(0, bodyHistoryIndexRef.current + direction),
    );
    if (nextIndex === bodyHistoryIndexRef.current) return;
    bodyHistoryIndexRef.current = nextIndex;
    setValue((current) => ({ ...current, bodyMarkdown: bodyHistoryRef.current[nextIndex] ?? "" }));
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function modifySelection(transform: (selected: string) => { text: string; selectionStart?: number; selectionEnd?: number }) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.bodyMarkdown.slice(start, end);
    const result = transform(selected);
    const next = value.bodyMarkdown.slice(0, start) + result.text + value.bodyMarkdown.slice(end);
    update("bodyMarkdown", next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + (result.selectionStart ?? 0), start + (result.selectionEnd ?? result.text.length));
    });
  }

  function wrap(prefix: string, suffix = prefix, placeholder = "text") {
    modifySelection((selected) => {
      const content = selected || placeholder;
      return { text: `${prefix}${content}${suffix}`, selectionStart: prefix.length, selectionEnd: prefix.length + content.length };
    });
  }

  function prefixLines(prefix: string, placeholder: string) {
    modifySelection((selected) => ({ text: (selected || placeholder).split("\n").map((line) => `${prefix}${line}`).join("\n") }));
  }

  async function persist() {
    const result = await saveBlogPost(value);
    if (!result.success) {
      setErrors(actionFieldErrors(result));
      toast.error(result.error);
      return false;
    }
    setSavedSignature(JSON.stringify(value));
    setErrors({});
    return true;
  }

  function save() {
    startTransition(async () => {
      if (await persist()) {
        toast.success(status === "published" ? "Published post updated" : "Draft saved");
        router.refresh();
      }
    });
  }

  function changeStatus(nextStatus: BlogPostStatus) {
    startTransition(async () => {
      if (nextStatus === "published" && !(await persist())) return;
      const result = await setBlogPostStatus({ id: value.id, status: nextStatus });
      if (!result.success) {
        setErrors(actionFieldErrors(result));
        toast.error(result.error);
        return;
      }
      setStatus(nextStatus);
      if (nextStatus === "published" && !publishedAt) setPublishedAt(new Date().toISOString());
      if (nextStatus === "draft" && dirty && !(await persist())) {
        toast.warning("The post is unpublished. Fix the highlighted fields before saving the draft.");
        router.refresh();
        return;
      }
      toast.success(nextStatus === "published" ? "Post published" : "Post unpublished");
      router.refresh();
    });
  }

  function upload(event: React.FormEvent<HTMLFormElement>, kind: "cover" | "inline") {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("postId", value.id);
    formData.set("kind", kind);
    const altText = String(formData.get("altText") ?? "");
    startTransition(async () => {
      const result = await uploadBlogMedia(formData);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      const uploaded = result.data.media;
      setMedia((current) => kind === "cover" ? [...current.filter((item) => item.kind !== "cover"), uploaded] : [...current, uploaded]);
      if (kind === "inline") {
        modifySelection(() => ({ text: `![${altText}](${uploaded.publicUrl})` }));
        form.reset();
      }
      toast.success(kind === "cover" ? "Cover image saved" : "Image uploaded and inserted");
      router.refresh();
    });
  }

  function removeMedia(item: BlogPostMedia) {
    startTransition(async () => {
      const result = await deleteBlogMedia(item.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setMedia((current) => current.filter((mediaItem) => mediaItem.id !== item.id));
      toast.success("Image deleted");
      router.refresh();
    });
  }

  const articlePreview = useMemo(() => (
    <article className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
        <span className="rounded-full bg-accent px-2.5 py-1 text-forest">{value.topic || "Topic"}</span>
        <span>{formatBlogDate(publishedAt ?? new Date().toISOString())}</span>
      </div>
      <h1 className="mt-4 text-3xl font-black tracking-tight text-ink sm:text-4xl">{value.title || "Your article title"}</h1>
      <p className="mt-4 text-base leading-7 text-muted-foreground">{value.excerpt || "A concise introduction will appear here."}</p>
      {cover ? <figure className="mt-7 overflow-hidden rounded-2xl bg-muted"><img src={cover.publicUrl} alt={cover.altText} className="aspect-[16/9] w-full object-cover" /><figcaption className="px-3 py-2 text-xs text-muted-foreground">{cover.altText}</figcaption></figure> : <div className="mt-7 flex aspect-[16/9] items-center justify-center rounded-2xl bg-muted text-sm text-muted-foreground">Add a cover image</div>}
      <BlogMarkdown markdown={value.bodyMarkdown || "Start writing to preview your article."} className="mt-8" />
    </article>
  ), [cover, publishedAt, value.bodyMarkdown, value.excerpt, value.title, value.topic]);

  return (
    <div className="pb-12">
      <header className="mb-5 flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2"><StatusBadge tone={status === "published" ? "success" : "warning"}>{status}</StatusBadge>{dirty ? <span className="text-xs font-semibold text-status-warning-text">Unsaved changes</span> : <span className="text-xs text-muted-foreground">All changes saved</span>}</div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">{value.title || "Untitled draft"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{publishedAt ? `First published ${formatBlogDate(publishedAt)}` : "Prepare the article, then publish when every field is ready."}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" disabled={pending || !dirty} onClick={save}><Save className="size-4" />{pending ? "Saving…" : status === "published" ? "Save changes" : "Save draft"}</Button>
          <Button type="button" disabled={pending} onClick={() => changeStatus(status === "published" ? "draft" : "published")}><Send className="size-4" />{status === "published" ? "Unpublish" : "Publish"}</Button>
        </div>
      </header>

      <div className="mb-4 flex rounded-lg bg-muted p-1 lg:hidden" role="tablist" aria-label="Editor view">
        {(["write", "preview"] as const).map((pane) => <button key={pane} type="button" role="tab" aria-selected={activePane === pane} onClick={() => setActivePane(pane)} className={cn("flex-1 rounded-md px-3 py-2 text-sm font-semibold capitalize", activePane === pane ? "bg-panel text-forest shadow-[var(--elevation-1)]" : "text-muted-foreground")}>{pane}</button>)}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.92fr)]">
        <section className={cn("min-w-0", activePane !== "write" && "hidden lg:block")} aria-label="Write blog post">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-ink sm:col-span-2">Title<Input className="mt-1.5" value={value.title} aria-invalid={Boolean(errors.title)} onChange={(event) => update("title", event.target.value)} placeholder="A useful, specific promise" /><FieldMessage errors={errors.title} /></label>
            <label className="text-sm font-semibold text-ink">Topic<Input className="mt-1.5" value={value.topic} aria-invalid={Boolean(errors.topic)} onChange={(event) => update("topic", event.target.value)} placeholder="Viewing, Applying, Budgeting" /><FieldMessage errors={errors.topic} /></label>
            <label className="text-sm font-semibold text-ink">Slug<Input className="mt-1.5" value={value.slug} disabled={slugLocked} aria-invalid={Boolean(errors.slug)} onChange={(event) => { setSlugTouched(true); update("slug", createBlogSlug(event.target.value)); }} placeholder="article-url" /><FieldMessage errors={errors.slug} />{slugLocked ? <span className="mt-1 block text-xs font-normal text-muted-foreground">Locked after first publication.</span> : null}</label>
            <label className="text-sm font-semibold text-ink sm:col-span-2">Excerpt<Textarea className="mt-1.5 min-h-24" value={value.excerpt} aria-invalid={Boolean(errors.excerpt)} onChange={(event) => update("excerpt", event.target.value)} placeholder="Summarise the value of this article in one or two sentences." /><span className="mt-1 flex justify-between text-xs font-normal text-muted-foreground"><FieldMessage errors={errors.excerpt} /><span>{value.excerpt.length}/240</span></span></label>
          </div>

          <section className="mt-6 border-t border-border pt-5" aria-labelledby="cover-heading">
            <h2 id="cover-heading" className="font-semibold text-ink">Cover image</h2>
            <p className="mt-1 text-sm text-muted-foreground">Use a clear landscape image. JPEG, PNG, WebP, or AVIF, up to 5 MB.</p>
            {cover ? <div className="mt-3 flex items-center gap-3"><img src={cover.publicUrl} alt={cover.altText} className="h-20 w-32 rounded-xl object-cover" /><div><p className="text-sm font-medium text-ink">{cover.altText}</p><p className="mt-1 text-xs text-muted-foreground">Upload a new cover to replace this one.</p></div></div> : null}
            <form className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(event) => upload(event, "cover")}>
              <Input name="file" type="file" accept="image/jpeg,image/png,image/webp,image/avif" required />
              <Input name="altText" defaultValue={cover?.altText ?? ""} placeholder="Describe the image" minLength={5} maxLength={160} required />
              <Button type="submit" variant="outline" disabled={pending}><ImagePlus className="size-4" />{cover ? "Replace" : "Upload"}</Button>
            </form>
          </section>

          <section className="mt-6" aria-labelledby="body-heading">
            <div className="flex items-end justify-between gap-3"><div><h2 id="body-heading" className="font-semibold text-ink">Article</h2><p className="mt-1 text-sm text-muted-foreground">Markdown is rendered without raw HTML.</p></div><span className="text-xs text-muted-foreground">{value.bodyMarkdown.length.toLocaleString()} characters</span></div>
            <div className="mt-3 flex flex-wrap items-center gap-0.5 rounded-t-xl border border-b-0 border-border bg-muted p-1.5" aria-label="Markdown formatting">
              <ToolbarButton label="Heading 2" onClick={() => prefixLines("## ", "Heading")}><Heading2 /></ToolbarButton>
              <ToolbarButton label="Heading 3" onClick={() => prefixLines("### ", "Heading")}><Heading3 /></ToolbarButton>
              <ToolbarButton label="Bold" onClick={() => wrap("**")}><Bold /></ToolbarButton>
              <ToolbarButton label="Italic" onClick={() => wrap("_")}><Italic /></ToolbarButton>
              <ToolbarButton label="Link" onClick={() => modifySelection((selected) => ({ text: `[${selected || "link text"}](https://)` }))}><Link2 /></ToolbarButton>
              <ToolbarButton label="Quote" onClick={() => prefixLines("> ", "Quote")}><Quote /></ToolbarButton>
              <ToolbarButton label="Bulleted list" onClick={() => prefixLines("- ", "List item")}><List /></ToolbarButton>
              <ToolbarButton label="Numbered list" onClick={() => prefixLines("1. ", "List item")}><ListOrdered /></ToolbarButton>
              <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
              <ToolbarButton label="Undo" onClick={() => moveBodyHistory(-1)}><Undo2 /></ToolbarButton>
              <ToolbarButton label="Redo" onClick={() => moveBodyHistory(1)}><Redo2 /></ToolbarButton>
            </div>
            <Textarea ref={textareaRef} value={value.bodyMarkdown} aria-invalid={Boolean(errors.bodyMarkdown)} onChange={(event) => update("bodyMarkdown", event.target.value)} className="min-h-[34rem] resize-y rounded-t-none font-mono text-sm leading-6" placeholder={'## Start with the reader\'s question\n\nWrite a clear answer…'} />
            <FieldMessage errors={errors.bodyMarkdown} />
          </section>

          <section className="mt-6 border-t border-border pt-5" aria-labelledby="media-heading">
            <h2 id="media-heading" className="font-semibold text-ink">Inline images</h2>
            <p className="mt-1 text-sm text-muted-foreground">Uploads are inserted at the current cursor position.</p>
            <form className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(event) => upload(event, "inline")}>
              <Input name="file" type="file" accept="image/jpeg,image/png,image/webp,image/avif" required />
              <Input name="altText" placeholder="Describe the image" minLength={5} maxLength={160} required />
              <Button type="submit" variant="outline" disabled={pending}><ImagePlus className="size-4" />Insert</Button>
            </form>
            {inlineMedia.length ? <ul className="mt-4 grid gap-3 sm:grid-cols-2">{inlineMedia.map((item) => {
              const referenced = value.bodyMarkdown.includes(item.publicUrl);
              return <li key={item.id} className="flex items-center gap-3 border-b border-border pb-3"><img src={item.publicUrl} alt={item.altText} className="size-16 rounded-lg object-cover" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-ink">{item.altText}</p><p className="text-xs text-muted-foreground">{referenced ? "Used in article" : "Not currently used"}</p><div className="mt-1 flex gap-1"><Button type="button" size="icon-xs" variant="ghost" aria-label="Copy image URL" onClick={() => navigator.clipboard.writeText(item.publicUrl).then(() => toast.success("Image URL copied"))}><Clipboard /></Button><Button type="button" size="icon-xs" variant="ghost" aria-label="Delete image" disabled={pending || referenced} onClick={() => removeMedia(item)}><Trash2 /></Button></div></div></li>;
            })}</ul> : null}
          </section>

          {status === "draft" ? <div className="mt-8"><DeleteBlogPostButton postId={value.id} /></div> : null}
        </section>

        <section className={cn("min-w-0 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto lg:border-l lg:border-border lg:pl-6", activePane !== "preview" && "hidden lg:block")} aria-label="Article preview">
          <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold text-ink">Live preview</h2><span className="text-xs text-muted-foreground">Public article layout</span></div>
          {articlePreview}
        </section>
      </div>
    </div>
  );
}
