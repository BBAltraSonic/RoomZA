"use client";

import { useEffect, useCallback } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type ImageLightboxProps = {
  images: { id: string; public_url: string }[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
};

export function ImageLightbox({ images, initialIndex = 0, isOpen, onClose, title }: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = require("react").useState(initialIndex);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, initialIndex]);

  const goNext = useCallback(() => {
    setCurrentIndex((prev: number) => (prev + 1) % images.length);
  }, [images.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev: number) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, goNext, goPrev]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in duration-200">
      <div className="absolute top-4 w-full px-4 flex items-center justify-between z-10">
        <p className="text-white font-medium drop-shadow-md">
          {currentIndex + 1} / {images.length}
          {title ? <span className="ml-2 text-white/70 hidden sm:inline">{title}</span> : null}
        </p>
        <button
          onClick={onClose}
          className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors backdrop-blur-md"
        >
          <X className="size-5" />
        </button>
      </div>

      <button
        onClick={goPrev}
        className="absolute left-4 z-10 flex size-12 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors backdrop-blur-md"
      >
        <ChevronLeft className="size-6" />
      </button>

      <div className="relative w-full h-full max-h-screen px-16 py-16 flex items-center justify-center" onClick={onClose}>
        <div className="relative w-full h-full max-w-6xl flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
          <Image
            src={images[currentIndex].public_url}
            alt={`Image ${currentIndex + 1}`}
            fill
            unoptimized
            className="object-contain"
          />
        </div>
      </div>

      <button
        onClick={goNext}
        className="absolute right-4 z-10 flex size-12 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors backdrop-blur-md"
      >
        <ChevronRight className="size-6" />
      </button>
    </div>
  );
}
