import { connection } from "next/server";
import { homeBreaking } from "@/lib/ranking";
import { getFeedStories } from "@/lib/server/store";
import type { Feed, Story } from "@/lib/types";
import { GlobalWatcher } from "./GlobalWatcher";
import { LeadStory, StoryRow } from "./StoryRow";

async function loadGlobal(): Promise<{ feed: Feed | null; stories: Story[]; error: boolean }> {
  try {
    return { ...(await getFeedStories("global")), error: false };
  } catch (error) {
    console.error("[tim-news] couldn't read the global feed", error);
    return { feed: null, stories: [], error: true };
  }
}

/** The few most important breaking stories from the last two days, rendered on the server from Firestore. */
export async function GlobalSections() {
  await connection();
  const { feed, stories, error } = await loadGlobal();
  // Only the few most important recent stories; interest sections fill the rest of the page.
  const [lead, ...moreBreaking] = homeBreaking(stories);

  return (
    <>
      <GlobalWatcher
        renderedAt={Math.max(feed?.updatedAt ?? 0, feed?.lastGeneratedAt ?? 0)}
        hasStories={stories.length > 0}
      />
      {error && (
        <div className="notice" style={{ marginTop: 20 }}>
          <strong>The news desk is offline.</strong> Tim News couldn&apos;t reach its database. Check the Firebase settings
          described in the README.
        </div>
      )}
      {!error && !lead && (
        <div className="section">
          <div className="notice">
            <strong>Gathering today&apos;s news.</strong> The first stories are being written now and will appear here
            on their own.
          </div>
        </div>
      )}
      {lead && <LeadStory story={lead} label={lead.isBreaking ? "Breaking" : "Top story"} />}
      {moreBreaking.length > 0 && (
        <section className="section" aria-labelledby="breaking-head">
          <div className="section-head" id="breaking-head">
            <span className="kicker">{moreBreaking.some((s) => s.isBreaking) ? "More breaking news" : "Top stories"}</span>
          </div>
          <div className="story-grid">
            {moreBreaking.map((s) => (
              <StoryRow key={s.id} story={s} showDek />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
