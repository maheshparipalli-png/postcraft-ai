import { searchNews, type ResearchItem } from "@/lib/research/news";
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

  // Coverage pass: take the strongest available story for each interest.
  for (const candidate of sorted) {
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
  const discoveryResults = await Promise.allSettled(
    interests.map((interest) => searchNews(interest)),
  );

  const failedInterests = discoveryResults
    .map((result, index) =>
      result.status === "rejected"
        ? {
            interest: interests[index],
            error: result.reason instanceof Error
              ? result.reason.message
              : "Content source lookup failed",
          }
        : null,
    )
    .filter(
      (item): item is { interest: ContentInterest; error: string } =>
        item !== null,
    );

  const byUrl = new Map<string, InterestResearchItem>();

  discoveryResults.forEach((result, index) => {
    if (result.status !== "fulfilled") return;

    for (const item of result.value) {
      const key = item.url.trim().toLowerCase().replace(/\/$/, "");
      if (!key) continue;

      const tagged = {
        ...item,
        interest: interests[index],
      };

      const existing = byUrl.get(key);
      if (!existing || (tagged.score ?? 0) > (existing.score ?? 0)) {
        byUrl.set(key, tagged);
      }
    }
  });

  const candidates = Array.from(byUrl.values()).sort(
    (a, b) => (b.score ?? 0) - (a.score ?? 0),
  );

  return { candidates, failedInterests };
}
