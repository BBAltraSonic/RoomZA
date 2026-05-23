import { useState, useEffect } from "react";
import type { ListingDetail } from "../listing-detail-panel";

export type RadiusScoreResult = {
  overallScore: number;
  overallLabel: string;
  walkability: number;
  convenience: number;
  student: number;
  family: number;
  commuter: number;
  breakdown: {
    category: string;
    distanceMeters: number;
    name: string;
  }[];
};

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const rLat1 = lat1 * Math.PI / 180;
  const rLat2 = lat2 * Math.PI / 180;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(rLat1) * Math.cos(rLat2) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function useEssentialRadius(listing: ListingDetail | null) {
  const [score, setScore] = useState<RadiusScoreResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!listing) {
      setScore(null);
      return;
    }

    setIsLoading(true);
    let isMounted = true;

    // Build bounding box approx 2km around the listing
    const latOffset = 0.018; // approx 2km
    const lngOffset = 0.020;
    const s = listing.latitude - latOffset;
    const n = listing.latitude + latOffset;
    const w = listing.longitude - lngOffset;
    const e = listing.longitude + lngOffset;

    // Only query what we strictly need for the score
    const query = `
      [out:json][timeout:10];
      (
        nwr["shop"~"supermarket|convenience"](${s},${w},${n},${e});
        nwr["amenity"~"clinic|pharmacy|hospital"](${s},${w},${n},${e});
        nwr["amenity"~"school|university|college"](${s},${w},${n},${e});
        nwr["amenity"~"atm|bank"](${s},${w},${n},${e});
        nwr["leisure"~"fitness_centre"](${s},${w},${n},${e});
        nwr["highway"~"bus_stop"](${s},${w},${n},${e});
        nwr["railway"="station"](${s},${w},${n},${e});
      );
      out center;
    `;

    fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query
    })
      .then(res => res.ok ? res.json() : { elements: [] })
      .then(data => {
        if (!isMounted) return;

        // Find nearest of each category
        let nearestGrocery = { dist: Infinity, name: "" };
        let nearestClinic = { dist: Infinity, name: "" };
        let nearestSchool = { dist: Infinity, name: "" };
        let nearestAtm = { dist: Infinity, name: "" };
        let nearestGym = { dist: Infinity, name: "" };
        let nearestTransport = { dist: Infinity, name: "" };

        let transportCount1km = 0;

        data.elements?.forEach((el: any) => {
          const lat = el.lat || el.center?.lat;
          const lon = el.lon || el.center?.lon;
          if (!lat || !lon) return;

          const dist = haversineDistance(listing.latitude, listing.longitude, lat, lon);
          const name = el.tags?.name || el.tags?.brand || "Unnamed";

          if (el.tags?.shop?.match(/supermarket|convenience/) && dist < nearestGrocery.dist) {
            nearestGrocery = { dist, name };
          } else if (el.tags?.amenity?.match(/clinic|pharmacy|hospital/) && dist < nearestClinic.dist) {
            nearestClinic = { dist, name };
          } else if (el.tags?.amenity?.match(/school|university|college/) && dist < nearestSchool.dist) {
            nearestSchool = { dist, name };
          } else if (el.tags?.amenity?.match(/atm|bank/) && dist < nearestAtm.dist) {
            nearestAtm = { dist, name };
          } else if (el.tags?.leisure === "fitness_centre" && dist < nearestGym.dist) {
            nearestGym = { dist, name };
          } else if (el.tags?.highway === "bus_stop" || el.tags?.railway === "station") {
            if (dist < nearestTransport.dist) nearestTransport = { dist, name };
            if (dist <= 1000) transportCount1km++;
          }
        });

        // Compute scores (0-100)
        // Helper: score drops linearly from 100 at 0m to 0 at maxDist
        const scoreDist = (d: number, maxDist: number) => Math.max(0, 100 - (d / maxDist * 100));
        
        const convenience = Math.round(
          (scoreDist(nearestGrocery.dist, 3000) * 0.4) +
          (scoreDist(nearestClinic.dist, 5000) * 0.2) +
          (scoreDist(nearestAtm.dist, 2000) * 0.2) +
          (scoreDist(nearestGym.dist, 4000) * 0.2)
        );

        const walkables = [nearestGrocery, nearestClinic, nearestAtm, nearestTransport]
          .filter(x => x.dist <= 800).length;
        const walkability = Math.round((walkables / 4) * 100);

        const student = Math.round(
          (scoreDist(nearestSchool.dist, 4000) * 0.5) +
          (scoreDist(nearestTransport.dist, 1500) * 0.3) +
          (scoreDist(nearestGrocery.dist, 2000) * 0.2)
        );

        const family = Math.round(
          (scoreDist(nearestSchool.dist, 3000) * 0.4) +
          (scoreDist(nearestClinic.dist, 3000) * 0.3) +
          (scoreDist(nearestGrocery.dist, 2000) * 0.3)
        );

        const commuter = Math.round(
          (scoreDist(nearestTransport.dist, 1500) * 0.6) +
          (Math.min(transportCount1km / 5, 1) * 100 * 0.4)
        );

        const overallScore = Math.round((convenience + walkability + commuter) / 3);
        
        let overallLabel = "Car-dependent area";
        if (walkability >= 75) overallLabel = "Everything you need within 800m";
        else if (overallScore >= 70) overallLabel = "Highly convenient location";
        else if (overallScore >= 50) overallLabel = "Some essentials beyond walking distance";

        setScore({
          overallScore,
          overallLabel,
          walkability,
          convenience,
          student,
          family,
          commuter,
          breakdown: [
            { category: "Groceries", distanceMeters: Math.round(nearestGrocery.dist), name: nearestGrocery.name },
            { category: "Transport", distanceMeters: Math.round(nearestTransport.dist), name: nearestTransport.name },
            { category: "Clinic/Pharmacy", distanceMeters: Math.round(nearestClinic.dist), name: nearestClinic.name },
            { category: "ATM/Bank", distanceMeters: Math.round(nearestAtm.dist), name: nearestAtm.name },
            { category: "School", distanceMeters: Math.round(nearestSchool.dist), name: nearestSchool.name }
          ].filter(x => x.distanceMeters < 10000)
        });
        setIsLoading(false);
      })
      .catch(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => { isMounted = false; };
  }, [listing]);

  return { score, isLoading };
}
