"use client";

import { useEffect, useCallback, useId, useRef, useState } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import * as m from "motion/react-m";

import { MOTION_SPRING } from "@/lib/motion/tokens";

type ImageLightboxProps = {
  images: { id: string; public_url: string }[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
};

export function ImageLightbox({ images, initialIndex = 0, isOpen, onClose, title }: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      queueMicrotask(() => setCurrentIndex(initialIndex));
      document.body.style.overflow = "hidden";
      window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    } else {
      document.body.style.overflow = "";
      previouslyFocusedRef.current?.focus({ preventScroll: true });
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, initialIndex, setCurrentIndex]);

  const goNext = useCallback(() => {
    setCurrentIndex((prev: number) => (prev + 1) % images.length);
  }, [images.length, setCurrentIndex]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev: number) => (prev - 1 + images.length) % images.length);
  }, [images.length, setCurrentIndex]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        )];
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, goNext, goPrev]);

  if (!isOpen) return null;

  return (
    <m.div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/95 animate-in fade-in duration-[var(--motion-standard)] motion-reduce:animate-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute top-4 w-full px-4 flex items-center justify-between z-10">
        <p id={titleId} className="font-medium text-primary-foreground drop-shadow-md">
          {currentIndex + 1} / {images.length}
          {title ? <span className="ml-2 hidden text-primary-foreground/70 sm:inline">{title}</span> : null}
        </p>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="Close image gallery"
          className="flex size-11 items-center justify-center rounded-full bg-panel/12 text-primary-foreground transition-colors hover:bg-panel/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
        >
          <X className="size-5" />
        </button>
      </div>

      <button
        type="button"
        onClick={goPrev}
        aria-label="Previous property image"
        className="absolute left-3 z-10 flex size-12 items-center justify-center rounded-full bg-ink/65 text-primary-foreground transition-colors hover:bg-ink/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground sm:left-4"
      >
        <ChevronLeft className="size-6" />
      </button>

      <div className="relative w-full h-full max-h-dvh px-16 py-16 flex items-center justify-center" onClick={onClose}>
        <m.div
          className="relative flex h-full w-full max-w-6xl items-center justify-center"
          layoutId={images[currentIndex] ? `gallery-image-${images[currentIndex].id}` : undefined}
          initial={{ scale: 0.94 }}
          animate={{ scale: 1 }}
          transition={MOTION_SPRING.soft}
          onClick={(e) => e.stopPropagation()}
        >
          {images[currentIndex] ? (
            <Image
              src={images[currentIndex].public_url}
              alt={`${title ?? "Property"}, image ${currentIndex + 1} of ${images.length}`}
              fill
              sizes="100vw"
              className="object-contain"
            />
          ) : null}
        </m.div>
      </div>

      <button
        type="button"
        onClick={goNext}
        aria-label="Next property image"
        className="absolute right-3 z-10 flex size-12 items-center justify-center rounded-full bg-ink/65 text-primary-foreground transition-colors hover:bg-ink/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground sm:right-4"
      >
        <ChevronRight className="size-6" />
      </button>
    </m.div>
  );
}
