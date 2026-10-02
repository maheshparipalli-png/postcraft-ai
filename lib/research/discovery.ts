import type { ResearchItem } from "@/lib/research/news";
import { discoverFromRss } from "@/lib/research/rss-discovery";
import type { ContentInterest } from "@/lib/content-interests";

export type InterestResearchItem = ResearchItem & {
  interest: ContentInterest;
};

export type InterestDiscoveryResult = {
  candidates: InterestResearchItem[];
  failedInterests: Array<{ interest: ContentInterest; error: string }>;
};

/**
 * Discover independently for every selected interest, then build one
 * de-duplicated pool while preserving the interest that produced each story.
 *
 * The important distinction is that we do not let the globally highest-scoring
 * interest consume the entire feed. The first pass reserves one strong story
 * per interest; the remaining slots are then filled by global quality.
 */
export function selectInterestAwareCandidates(
  candidates: InterestResearchItem[],
  limit = 12,
): InterestResearchItem[] {
  const sorted = [...candidates].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const selected: InterestResearchItem[] = [];
  const covered = new Set<string>();

  // Coverage pass: reserve a slot for each interest, but never exceed the
  // requested limit when a user has more interests than available slots.
  for (const candidate of sorted) {
    if (selected.length >= limit) break;
    if (covered.has(candidate.interest)) continue;
    selected.push(candidate);
    covered.add(candidate.interest);
  }

  // Quality pass: fill the remaining slots globally.
  for (const candidate of sorted) {
    if (selected.length >= limit) break;
    if (selected.some((item) => item.url === candidate.url)) continue;
    selected.push(candidate);
  }

  return selected.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

export async function discoverAcrossInterests(
  interests: ContentInterest[],
): Promise<InterestDiscoveryResult> {
  // Discover reads curated publisher RSS feeds. Evergreen Idea Radar does not
  // call this function and therefore cannot absorb current-news items.
  const { candidates, failedInterests } = await discoverFromRss(interests);
  return { candidates, failedInterests };
}
