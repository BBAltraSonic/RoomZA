"use client";

import { ImagePlus, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { useCallback, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { deleteListingImage, uploadListingImage, type ListingImage } from "./actions";
import { MIN_LISTING_IMAGES } from "./schema";
import { MAX_LISTING_IMAGES, validateImageUpload, validateListingImageCount } from "./types";

type ImageUploaderProps = {
    listingId: string;
    defaultImages?: ListingImage[];
    getExpectedUpdatedAt: () => string | undefined;
    onVersionChange: (updatedAt: string) => void;
    onPendingChange: (pending: boolean) => void;
    disabled?: boolean;
};

export function ImageUploader({ listingId, defaultImages = [], getExpectedUpdatedAt, onVersionChange, onPendingChange, disabled = false }: ImageUploaderProps) {
    const [images, setImages] = useState<ListingImage[]>(defaultImages);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const imageCount = images.length;
    const hasMinimum = imageCount >= MIN_LISTING_IMAGES;

    const handleUpload = useCallback(
        (files: FileList | null) => {
            if (disabled || !files || files.length === 0) return;

            setError(null);
            const selectedFiles = Array.from(files);

            const countValidation = validateListingImageCount(images.length, selectedFiles.length);
            if (!countValidation.valid) {
                setError(countValidation.error);
                return;
            }
            for (const file of selectedFiles) {
                const validation = validateImageUpload(file.type, file.size);
                if (!validation.valid) {
                    setError(validation.error);
                    return;
                }
            }

            onPendingChange(true);
            startTransition(async () => {
                try {
                    for (const file of selectedFiles) {
                        const formData = new FormData();
                        formData.set("file", file);
                        const result = await uploadListingImage(listingId, formData, getExpectedUpdatedAt());
                        if (result.success) {
                            setImages((prev) => [...prev, result.data.image]);
                            onVersionChange(result.data.updatedAt);
                        } else {
                            setError(result.error);
                            break;
                        }
                    }
                } catch {
                    setError("Could not confirm the photo update. Reload the listing before retrying.");
                } finally {
                    onPendingChange(false);
                }
            });
        },
        [disabled, images.length, listingId, getExpectedUpdatedAt, onVersionChange, onPendingChange],
    );

    const handleDelete = useCallback(
        (imageId: string) => {
            if (disabled) return;
            setError(null);
            onPendingChange(true);
            startTransition(async () => {
                try {
                    const result = await deleteListingImage(imageId, getExpectedUpdatedAt());
                    if (result.success) {
                        setImages((prev) => prev.filter((img) => img.id !== imageId));
                        onVersionChange(result.data.updatedAt);
                    } else {
                        setError(result.error ?? "Failed to delete image.");
                    }
                } catch {
                    setError("Could not confirm the photo update. Reload the listing before retrying.");
                } finally {
                    onPendingChange(false);
                }
            });
        },
        [disabled, getExpectedUpdatedAt, onVersionChange, onPendingChange],
    );

    const atMaximum = imageCount >= MAX_LISTING_IMAGES;

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setIsDragOver(false);
            handleUpload(e.dataTransfer.files);
        },
        [handleUpload],
    );

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
    }, []);

    return (
        <div className="space-y-6" aria-busy={isPending}>
            <div className="flex items-center justify-between">
                <span className={cn(
                    "inline-flex items-center rounded-md px-3 py-1 text-xs font-semibold uppercase",
                    hasMinimum ? "bg-accent text-primary" : "bg-status-warning-surface text-status-warning-text"
                )}>
                    {hasMinimum ? "Minimum reached" : `${imageCount} of ${MIN_LISTING_IMAGES} minimum`}
                </span>
                <p className="text-sm text-muted-foreground">
                    {imageCount}/{MAX_LISTING_IMAGES} photos. JPEG, PNG, WebP up to 10 MB.
                </p>
            </div>

            {error ? (
                  <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm font-medium text-destructive">
                    {error}
                </div>
            ) : null}

            {/* Image grid */}
            {images.length > 0 ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                    {images.map((image, index) => (
                        <div key={image.id} className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-border bg-muted shadow-[var(--elevation-1)] sm:rounded-lg">
                            <Image
                                src={image.public_url}
                                alt=""
                                fill
                                sizes="(min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw"
                                className="object-cover"
                            />
                            <div className="absolute inset-0 bg-ink/30 opacity-100 transition-opacity group-hover:opacity-100 sm:opacity-0" />
                            <Button
                                type="button"
                                size="icon"
                                variant="destructive"
                                aria-label={`Remove photo ${index + 1}`}
                                className="absolute bottom-3 right-3 size-9 opacity-100 shadow-[var(--elevation-2)] transition-opacity group-hover:opacity-100 sm:size-8 sm:opacity-0"
                                onClick={() => handleDelete(image.id)}
                                disabled={isPending || disabled}
                            >
                                <Trash2 className="size-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            ) : null}

            {/* Drop zone */}
            <button
                type="button"
                className={cn(
                    "flex w-full flex-col items-center justify-center gap-4 rounded-2xl border border-dashed p-10 transition-colors duration-200 sm:rounded-lg",
                    isDragOver
                        ? "border-forest bg-accent"
                        : "border-border hover:border-forest/40 hover:bg-warm-surface",
                    (isPending || disabled || atMaximum) && "pointer-events-none opacity-50",
                )}
                onClick={() => {
                    if (!atMaximum) fileInputRef.current?.click();
                }}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                disabled={isPending || disabled || atMaximum}
            >
                {isPending ? (
                    <div className="rounded-md bg-accent p-4 text-forest">
                        <Upload className="size-8 animate-pulse" />
                    </div>
                ) : (
                    <div className="rounded-md bg-muted/50 p-4 text-muted-foreground transition group-hover:bg-accent group-hover:text-forest">
                        <ImagePlus className="size-8" />
                    </div>
                )}
                <div className="text-center">
                    <p className="text-base font-semibold text-foreground">
                        {isPending ? "Uploading photos..." : atMaximum ? "Photo limit reached" : "Drop photos here or click to browse"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {atMaximum ? `Remove a photo before adding another.` : "High-quality, well-lit photos get better results."}
                    </p>
                </div>
            </button>

            <input
                ref={fileInputRef}
                type="file"
                aria-label="Listing photos"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={isPending || disabled || atMaximum}
                className="hidden"
                onChange={(event) => {
                    handleUpload(event.currentTarget.files);
                    event.currentTarget.value = "";
                }}
            />
        </div>
    );
}
