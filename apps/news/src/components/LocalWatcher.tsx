"use client";

import { useEffect, useRef } from "react";
import type { Region } from "@/lib/types";
import { useAuth } from "./AuthProvider";

const MOVE_THRESHOLD_KM = 5;

function distanceKm(a: GeolocationCoordinates, b: GeolocationCoordinates) {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLng = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/**
 * While the app is open, keeps "Local news in …" following the reader when they travel.
 * Runs only if they turned on local news and already granted location permission.
 * Coordinates stay in memory; only the city-level region is saved.
 */
export function LocalWatcher() {
  const { profile, updateProfile, authedFetch, user } = useAuth();
  const lastLookup = useRef<GeolocationCoordinates | null>(null);
  const enabled = Boolean(user && profile.settings.localEnabled && profile.region);
  const regionKey = profile.region?.key;

  useEffect(() => {
    if (!enabled || !("geolocation" in navigator) || !navigator.permissions) return;
    let watchId: number | null = null;
    let stopped = false;
    navigator.permissions
      .query({ name: "geolocation" })
      .then((permission) => {
        if (stopped || permission.state !== "granted") return;
        watchId = navigator.geolocation.watchPosition(
          async (pos) => {
            if (lastLookup.current && distanceKm(lastLookup.current, pos.coords) < MOVE_THRESHOLD_KM) return;
            lastLookup.current = pos.coords;
            const res = await authedFetch("/api/location", {
              method: "POST",
              body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            }).catch(() => null);
            const data = (await res?.json().catch(() => null)) as { region?: Region } | null;
            if (data?.region && data.region.key !== regionKey) {
              await updateProfile({ region: data.region });
            }
          },
          () => {},
          { enableHighAccuracy: false, maximumAge: 10 * 60_000 },
        );
      })
      .catch(() => {});
    return () => {
      stopped = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [enabled, regionKey, authedFetch, updateProfile]);

  return null;
}
