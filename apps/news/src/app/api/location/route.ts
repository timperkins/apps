import { adminDb, verifyRequest } from "@/lib/firebase/admin";
import { slugify } from "@/lib/text";
import type { Region } from "@/lib/types";

const UA = "TimNews/1.0 (https://github.com/timperkins/news)";

interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state?: string;
  country?: string;
  country_code?: string;
}

/** Turns an address into a coarse, shareable region. */
function toRegion(address: NominatimAddress | undefined): (Region & { country: string }) | null {
  if (!address) return null;
  const place = address.city ?? address.town ?? address.municipality ?? address.village ?? address.county;
  if (!place) return null;
  const country = (address.country_code ?? "").toUpperCase();
  const area = address.state ?? address.country ?? "";
  const label = area ? `${place}, ${area}` : place;
  const key = slugify(`${place} ${area} ${country}`, 60);
  return key ? { key, label, country } : null;
}

/**
 * Converts coordinates (or a typed city) to a city-level region. Coordinates are used
 * once for the lookup and never stored.
 */
export async function POST(request: Request) {
  const uid = await verifyRequest(request);
  if (!uid) return Response.json({ error: "Sign-in required" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { lat?: number; lng?: number; city?: string };
  let url: string;
  if (typeof body.lat === "number" && typeof body.lng === "number") {
    // Round to about 1 km before sending anywhere.
    const lat = body.lat.toFixed(2);
    const lng = body.lng.toFixed(2);
    url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&addressdetails=1&lat=${lat}&lon=${lng}`;
  } else if (typeof body.city === "string" && body.city.trim()) {
    url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&q=${encodeURIComponent(body.city.trim().slice(0, 100))}`;
  } else {
    return Response.json({ error: "Send coordinates or a city name" }, { status: 400 });
  }

  const res = await fetch(url, { headers: { "user-agent": UA, "accept-language": "en" } }).catch(() => null);
  if (!res?.ok) return Response.json({ error: "Location lookup is unavailable right now" }, { status: 502 });
  const data = (await res.json()) as { address?: NominatimAddress } | { address?: NominatimAddress }[];
  const address = Array.isArray(data) ? data[0]?.address : data.address;
  const region = toRegion(address);
  if (!region) return Response.json({ error: "Couldn't find a city for that location" }, { status: 404 });

  await adminDb()
    .collection("regions")
    .doc(region.key)
    .set({ label: region.label, country: region.country, createdAt: Date.now() }, { merge: true });
  return Response.json({ region: { key: region.key, label: region.label } satisfies Region });
}
