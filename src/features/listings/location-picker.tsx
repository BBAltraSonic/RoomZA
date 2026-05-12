"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
    APIProvider,
    Map,
    AdvancedMarker,
    useMap,
    useMapsLibrary,
} from "@vis.gl/react-google-maps";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

type LocationPickerProps = {
    apiKey: string;
    defaultAddress?: string;
    defaultLat?: number;
    defaultLng?: number;
};

const joburg = { lat: -26.2041, lng: 28.0473 };
const defaultZoom = 14;
const MAP_ID = "roomza-location-picker";

function LocationPickerInner({
    defaultAddress,
    defaultLat,
    defaultLng,
}: Omit<LocationPickerProps, "apiKey">) {
    const map = useMap();
    const placesLib = useMapsLibrary("places");
    const geocodingLib = useMapsLibrary("geocoding");
    const inputRef = useRef<HTMLInputElement>(null);
    const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

    const [address, setAddress] = useState(defaultAddress ?? "");
    const [lat, setLat] = useState(defaultLat ?? 0);
    const [lng, setLng] = useState(defaultLng ?? 0);
    const [hasLocation, setHasLocation] = useState(!!(defaultLat && defaultLng));
    const [markerPosition, setMarkerPosition] = useState<google.maps.LatLngLiteral | null>(
        defaultLat && defaultLng ? { lat: defaultLat, lng: defaultLng } : null,
    );

    // Initialize Places Autocomplete
    useEffect(() => {
        if (!placesLib || !inputRef.current || autocompleteRef.current) return;

        const autocomplete = new placesLib.Autocomplete(inputRef.current, {
            componentRestrictions: { country: "ZA" },
            fields: ["geometry", "formatted_address", "name"],
        });

        autocomplete.addListener("place_changed", () => {
            const place = autocomplete.getPlace();
            if (!place.geometry?.location) return;

            const resultLat = place.geometry.location.lat();
            const resultLng = place.geometry.location.lng();
            const fullAddress = place.formatted_address ?? place.name ?? "";

            setLat(resultLat);
            setLng(resultLng);
            setAddress(fullAddress);
            setHasLocation(true);
            setMarkerPosition({ lat: resultLat, lng: resultLng });

            map?.panTo({ lat: resultLat, lng: resultLng });
            map?.setZoom(defaultZoom);
        });

        autocompleteRef.current = autocomplete;
    }, [placesLib, map]);

    // Reverse geocode on marker drag
    const handleMarkerDragEnd = useCallback(
        (event: google.maps.MapMouseEvent) => {
            if (!event.latLng || !geocodingLib) return;

            const newLat = event.latLng.lat();
            const newLng = event.latLng.lng();
            setLat(newLat);
            setLng(newLng);
            setMarkerPosition({ lat: newLat, lng: newLng });

            const geocoder = new geocodingLib.Geocoder();
            geocoder.geocode({ location: { lat: newLat, lng: newLng } }).then(
                ({ results }) => {
                    if (results[0]?.formatted_address) {
                        setAddress(results[0].formatted_address);
                    }
                },
                () => {
                    // Keep existing address on failure
                },
            );
        },
        [geocodingLib],
    );

    const center =
        defaultLat && defaultLng ? { lat: defaultLat, lng: defaultLng } : joburg;

    return (
        <div className="space-y-3">
            <div className="relative">
                <Label htmlFor="location-search" className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground/80">Search address</Label>
                <Input
                    ref={inputRef}
                    id="location-search"
                    type="text"
                    placeholder="Search for an address in South Africa..."
                    className="mt-2 text-base shadow-none focus-visible:ring-[#2b6357]"
                    defaultValue={defaultAddress}
                />
            </div>

            <div className="h-[280px] w-full overflow-hidden rounded-lg border border-border">
                <Map
                    defaultCenter={center}
                    defaultZoom={defaultLat ? 15 : 11}
                    mapId={MAP_ID}
                    gestureHandling="greedy"
                    disableDefaultUI
                    zoomControl
                    zoomControlOptions={{ position: 6 /* RIGHT_BOTTOM */ }}
                    className="h-full w-full"
                >
                    {markerPosition ? (
                        <AdvancedMarker
                            position={markerPosition}
                            draggable
                            onDragEnd={handleMarkerDragEnd}
                        />
                    ) : null}
                </Map>
            </div>

            {hasLocation ? (
                <p className="mt-2 text-[13px] font-medium text-[#b86f42]">
                    {lat.toFixed(6)}, {lng.toFixed(6)} — drag the pin to adjust if necessary
                </p>
            ) : (
                <p className="mt-2 text-[13px] font-medium text-muted-foreground">
                    Search for an address above to place the pin
                </p>
            )}

            {/* Hidden fields for form submission */}
            <input type="hidden" name="address" value={address} />
            <input type="hidden" name="latitude" value={lat || ""} />
            <input type="hidden" name="longitude" value={lng || ""} />
        </div>
    );
}

export function LocationPicker({
    apiKey,
    defaultAddress,
    defaultLat,
    defaultLng,
}: LocationPickerProps) {
    return (
        <APIProvider apiKey={apiKey} libraries={["places", "geocoding"]}>
            <LocationPickerInner
                defaultAddress={defaultAddress}
                defaultLat={defaultLat}
                defaultLng={defaultLng}
            />
        </APIProvider>
    );
}
