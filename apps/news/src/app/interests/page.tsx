import type { Metadata } from "next";
import { InterestsEditor } from "@/components/InterestsEditor";

export const metadata: Metadata = { title: "Your interests" };

export default function InterestsPage() {
  return <InterestsEditor />;
}
