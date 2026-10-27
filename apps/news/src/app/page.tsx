import { Suspense } from "react";
import { GlobalSections } from "@/components/GlobalSections";
import { PersonalSections } from "@/components/PersonalSections";
import { PullToRefresh } from "@/components/PullToRefresh";
import { Skeleton } from "@/components/StoryRow";

export default function Home() {
  return (
    <PullToRefresh>
      <Suspense fallback={<Skeleton rows={4} />}>
        <GlobalSections />
      </Suspense>
      <PersonalSections />
      <p className="feed-end">Looks like you&apos;ve reached the end</p>
    </PullToRefresh>
  );
}
