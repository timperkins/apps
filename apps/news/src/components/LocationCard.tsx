"use client";

import { useState } from "react";
import type { Region } from "@/lib/types";
import { useAuth } from "./AuthProvider";

/** Hook for turning on local news, from the browser's location or a typed city. */
export function useLocalNews() {
  const { authedFetch, updateProfile, profile } = useAuth();
  const [status, setStatus] = useState<"idle" | "locating" | "error">("idle");
  const [message, setMessage] = useState("");

  async function save(body: object) {
    const res = await authedFetch("/api/location", { method: "POST", body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as { region?: Region; error?: string };
    if (!res.ok || !data.region) throw new Error(data.error ?? "Couldn't set your location");
    await updateProfile({ region: data.region, settings: { ...profile.settings, localEnabled: true } });
  }

  function shareLocation() {
    if (!("geolocation" in navigator)) {
      setStatus("error");
      setMessage("This browser can't share location. Type your city instead.");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await save({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setStatus("idle");
        } catch (e) {
          setStatus("error");
          setMessage((e as Error).message);
        }
      },
      () => {
        setStatus("error");
        setMessage("Location wasn't shared. You can type your city instead.");
      },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 10 * 60_000 },
    );
  }

  async function chooseCity(city: string) {
    setStatus("locating");
    try {
      await save({ city });
      setStatus("idle");
    } catch (e) {
      setStatus("error");
      setMessage((e as Error).message);
    }
  }

  return { status, message, shareLocation, chooseCity };
}

export function CityForm({ onCity, busy }: { onCity: (city: string) => void; busy: boolean }) {
  const [city, setCity] = useState("");
  return (
    <form
      className="inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (city.trim()) onCity(city.trim());
      }}
    >
      <label htmlFor="city" className="sr-only" style={{ position: "absolute", left: -9999 }}>
        City
      </label>
      <input id="city" className="input" placeholder="Or type a city, like Seattle" value={city} onChange={(e) => setCity(e.target.value)} />
      <button className="btn" disabled={busy || !city.trim()}>
        Use city
      </button>
    </form>
  );
}

export function LocationCard() {
  const { status, message, shareLocation, chooseCity } = useLocalNews();
  return (
    <section className="section">
      <div className="section-head">
        <span>Local news</span>
      </div>
      <div className="notice">
        <strong>See news from where you are.</strong> Tim News uses your location only to work out your city. Your
        exact position is never saved.
        <div className="inline-form">
          <button className="btn primary" onClick={shareLocation} disabled={status === "locating"}>
            {status === "locating" ? "Finding your city…" : "Show local news"}
          </button>
        </div>
        <CityForm onCity={chooseCity} busy={status === "locating"} />
        {status === "error" && <p style={{ margin: "10px 0 0" }}>{message}</p>}
      </div>
    </section>
  );
}
