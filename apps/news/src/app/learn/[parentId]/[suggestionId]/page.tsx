import { Suspense } from "react";
import { LearnArticle } from "@/components/LearnArticle";
import { Skeleton } from "@/components/StoryRow";

async function Learn({ params }: { params: PageProps<"/learn/[parentId]/[suggestionId]">["params"] }) {
  const { parentId, suggestionId } = await params;
  return <LearnArticle parentId={parentId} suggestionId={suggestionId} />;
}

export default function LearnPage({ params }: PageProps<"/learn/[parentId]/[suggestionId]">) {
  return (
    <Suspense fallback={<div className="narrow"><Skeleton rows={3} /></div>}>
      <Learn params={params} />
    </Suspense>
  );
}
