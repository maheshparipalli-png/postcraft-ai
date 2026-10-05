export const POSTCARD_FIELDS = [
  "leadership",
  "entrepreneurship",
  "discipline",
  "creativity",
  "learning",
  "courage",
  "success",
  "life",
  "sports",
] as const;

export type PostCardField = (typeof POSTCARD_FIELDS)[number];

export function randomPostCardField(): PostCardField {
  return POSTCARD_FIELDS[Math.floor(Math.random() * POSTCARD_FIELDS.length)];
}

export const POSTCARD_FIELD_TERMS: Record<PostCardField, string[]> = {
  leadership: ["leadership", "leader", "team", "responsibility", "service", "example"],
  entrepreneurship: ["business", "entrepreneur", "startup", "founder", "build", "create", "risk"],
  discipline: ["discipline", "habit", "practice", "consistency", "persistence", "routine"],
  creativity: ["creativity", "creative", "imagination", "idea", "create", "design", "curiosity"],
  learning: ["learn", "learning", "mistake", "education", "knowledge", "experience"],
  courage: ["courage", "fear", "brave", "risk", "bold", "doubt"],
  success: ["success", "achievement", "goal", "progress", "breakthrough", "mastery"],
  life: ["life", "meaning", "purpose", "happiness", "change", "journey", "relationships"],
  sports: ["sport", "athlete", "team", "game", "champion", "competition", "practice"],
};
