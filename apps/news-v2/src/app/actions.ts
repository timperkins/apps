"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { parseSourceIds, SOURCES_COOKIE } from "@/lib/sources";

export async function saveSources(formData: FormData) {
  const ids = parseSourceIds(formData.getAll("source").map(String).join(","));
  (await cookies()).set(SOURCES_COOKIE, ids.join(","), {
    maxAge: 60 * 60 * 24 * 365 * 2,
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  redirect("/");
}
