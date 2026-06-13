"use client";

import { AdvancedMarker } from "@vis.gl/react-google-maps";
import { type POIMarkerData } from "./hooks/use-overpass-pois";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function POIMarker({ poi }: { poi: POIMarkerData }) {
  const [isHovered, setIsHovered] = useState(false);
  const Icon = poi.category.icon;

  return (
    <AdvancedMarker
      position={{ lat: poi.lat, lng: poi.lng }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      zIndex={isHovered ? 50 : 20}
    >
      <div className="relative group cursor-pointer">
        {/* Tooltip */}
        {isHovered && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap rounded-md bg-panel/95 px-2.5 py-1.5 text-xs font-semibold text-ink shadow-[var(--elevation-2)] border border-border backdrop-blur-md animate-in fade-in slide-in-from-bottom-1 z-50">
            {poi.name}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-border" />
          </div>
        )}
        
        {/* Pin */}
        <div 
          className={cn(
            "roomza-poi-pin flex size-6 items-center justify-center rounded-full shadow-[var(--elevation-1)] transition-transform border border-panel/50",
            isHovered && "scale-110 shadow-[var(--elevation-2)]"
          )}
          style={{ backgroundColor: poi.category.pinColor, color: "white" }}
        >
          <Icon className="size-3.5" />
        </div>
      </div>
    </AdvancedMarker>
  );
}
