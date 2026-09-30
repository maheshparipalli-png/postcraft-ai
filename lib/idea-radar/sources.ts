export const IDEA_CATEGORIES = [
  "Business","Leadership","Entrepreneurship","AI & Technology","Career",
  "Psychology","Productivity","Personal Growth","Marketing","Management",
  "Innovation","Interesting Stories",
] as const;

export type IdeaCategory = typeof IDEA_CATEGORIES[number];

export const DEFAULT_IDEA_SOURCES = [
  { name: "MIT Technology Review", url: "https://www.technologyreview.com/feed/", category: "AI & Technology" },
  { name: "Harvard Business Review", url: "https://feeds.hbr.org/harvardbusiness", category: "Business" },
  { name: "McKinsey Insights", url: "https://www.mckinsey.com/insights/rss", category: "Business" },
  { name: "Google AI Blog", url: "https://blog.google/technology/ai/rss/", category: "AI & Technology" },
  { name: "Microsoft Research Blog", url: "https://www.microsoft.com/en-us/research/feed/", category: "AI & Technology" },
  { name: "Stanford HAI", url: "https://hai.stanford.edu/news/rss.xml", category: "AI & Technology" },
  { name: "Farnam Street", url: "https://fs.blog/feed/", category: "Psychology" },
  { name: "James Clear", url: "https://jamesclear.com/feed", category: "Personal Growth" },
  { name: "HubSpot Marketing", url: "https://blog.hubspot.com/marketing/rss.xml", category: "Marketing" },
] as const;
