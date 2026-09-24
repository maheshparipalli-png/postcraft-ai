export const CONTENT_INTERESTS = [
  { id: "AI & Technology", description: "AI, software, chips, cybersecurity and emerging technology" },
  { id: "Business", description: "Business strategy, companies, markets and disruption" },
  { id: "Leadership", description: "Leadership, management, decision-making and culture" },
  { id: "Entrepreneurship", description: "Startups, founders, products and building businesses" },
  { id: "Finance & Economy", description: "Economy, markets, investing, inflation and financial trends" },
  { id: "Career & Work", description: "Jobs, skills, workplace change and professional growth" },
  { id: "Marketing & Sales", description: "Marketing, sales, customers, brands and growth" },
  { id: "Science", description: "Scientific discoveries, research and breakthroughs" },
  { id: "India", description: "Indian business, technology, policy and society" },
  { id: "Geopolitics", description: "Global relations, strategic shifts and international affairs" },
  { id: "Education", description: "Education, learning, skills and the future of learning" },
  { id: "Healthcare", description: "Healthcare, medicine, health technology and systems" },
  { id: "Sustainability", description: "Climate, energy, sustainability and environmental change" },
  { id: "Productivity", description: "Work habits, tools, systems and personal effectiveness" },
] as const;

export type ContentInterest = (typeof CONTENT_INTERESTS)[number]["id"];

const INTEREST_SET = new Set<string>(CONTENT_INTERESTS.map((item) => item.id));

export function normalizeInterests(value: unknown, max = 5): ContentInterest[] {
  if (!Array.isArray(value)) return [];
  const unique: ContentInterest[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !INTEREST_SET.has(item)) continue;
    if (!unique.includes(item as ContentInterest)) unique.push(item as ContentInterest);
    if (unique.length >= max) break;
  }
  return unique;
}
