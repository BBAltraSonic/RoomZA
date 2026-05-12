"use client";

import { ImagePlus, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { useCallback, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { deleteListingImage, uploadListingImage, type ListingImage } from "./actions";
import { MIN_LISTING_IMAGES } from "./schema";

type ImageUploaderProps = {
    listingId: string;
    defaultImages?: ListingImage[];
};

export function ImageUploader({ listingId, defaultImages = [] }: ImageUploaderProps) {
    const [images, setImages] = useState<ListingImage[]>(defaultImages);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const imageCount = images.length;
    const hasMinimum = imageCount >= MIN_LISTING_IMAGES;

    const handleUpload = useCallback(
        (files: FileList | null) => {
            if (!files || files.length === 0) return;

            setError(null);

            startTransition(async () => {
                for (const file of Array.from(files)) {
                    const formData = new FormData();
                    formData.set("file", file);

                    const result = await uploadListingImage(listingId, formData);

                    if (result.success) {
                        setImages((prev) => [...prev, result.image]);
                    } else {
                        setError(result.error);
                        break;
                    }
                }
            });
        },
        [listingId],
    );

    const handleDelete = useCallback(
        (imageId: string) => {
            startTransition(async () => {
                const result = await deleteListingImage(imageId);
                if (result.success) {
                    setImages((prev) => prev.filter((img) => img.id !== imageId));
                } else {
                    setError(result.error ?? "Failed to delete image.");
                }
            });
        },
        [],
    );

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
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <span className={cn(
                    "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider",
                    hasMinimum ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                )}>
                    {hasMinimum ? "Minimum reached" : `${imageCount} of ${MIN_LISTING_IMAGES} minimum`}
                </span>
                <p className="text-sm text-muted-foreground">
                    JPEG, PNG, WebP up to 10 MB
                </p>
            </div>

            {error ? (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm font-medium text-destructive">
                    {error}
                </div>
            ) : null}

            {/* Image grid */}
            {images.length > 0 ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                    {images.map((image) => (
                        <div key={image.id} className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-border/50 bg-muted/20 shadow-sm transition-all hover:shadow-md">
                            <Image
                                src={image.public_url}
                                alt=""
                                fill
                                unoptimized
                                sizes="(min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw"
                                className="object-cover transition duration-500 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                            <Button
                                type="button"
                                size="icon"
                                variant="destructive"
                                className="absolute bottom-3 right-3 size-9 rounded-xl opacity-0 shadow-sm transition-all group-hover:opacity-100"
                                onClick={() => handleDelete(image.id)}
                                disabled={isPending}
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
                    "flex w-full flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed p-10 transition-all duration-300",
                    isDragOver
                        ? "scale-[1.01] border-[#2b6357] bg-[#e7f2ee]/50 shadow-inner"
                        : "border-border/60 hover:border-[#2b6357]/40 hover:bg-muted/30 hover:shadow-inner",
                    isPending && "pointer-events-none opacity-50",
                )}
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                disabled={isPending}
            >
                {isPending ? (
                    <div className="rounded-full bg-[#e7f2ee] p-4 text-[#2b6357]">
                        <Upload className="size-8 animate-bounce" />
                    </div>
                ) : (
                    <div className="rounded-full bg-muted/50 p-4 text-muted-foreground transition group-hover:bg-[#e7f2ee] group-hover:text-[#2b6357]">
                        <ImagePlus className="size-8" />
                    </div>
                )}
                <div className="text-center">
                    <p className="text-base font-semibold text-foreground">
                        {isPending ? "Uploading your photos…" : "Drop photos here or click to browse"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        High-quality, well-lit photos get better results.
                    </p>
                </div>
            </button>

            <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => handleUpload(e.target.files)}
            />
        </div>
    );
}
