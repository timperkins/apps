import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CategoryArchive } from "@/components/CategoryArchive";
import { Skeleton } from "@/components/StoryRow";

async function TopicArchive({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!/^[a-z0-9-]{2,40}$/.test(key)) notFound();
  return <CategoryArchive feedId={`topic:${key}`} />;
}

export default function TopicPage({ params }: PageProps<"/topic/[key]">) {
  return (
    <Suspense fallback={<Skeleton rows={6} />}>
      <TopicArchive params={params} />
    </Suspense>
  );
}
