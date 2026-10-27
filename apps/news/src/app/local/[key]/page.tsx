import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CategoryArchive } from "@/components/CategoryArchive";
import { Skeleton } from "@/components/StoryRow";

async function LocalArchive({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!/^[a-z0-9-]{2,60}$/.test(key)) notFound();
  return <CategoryArchive feedId={`local:${key}`} />;
}

export default function LocalPage({ params }: PageProps<"/local/[key]">) {
  return (
    <Suspense fallback={<Skeleton rows={6} />}>
      <LocalArchive params={params} />
    </Suspense>
  );
}
