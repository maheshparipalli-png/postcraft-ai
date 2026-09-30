export type VisualStyle = "editorial" | "cartoon" | "hand-drawn" | "3d" | "anime" | "watercolor";

export type VisualStyleConfig = {
  id: VisualStyle;
  label: string;
  prompt: string;
  preferredModel?: string;
};

export const VISUAL_STYLES: Record<VisualStyle, VisualStyleConfig> = {
  editorial: {
    id: "editorial",
    label: "Editorial photo",
    prompt: "Photorealistic premium editorial photograph, natural textures, realistic human proportions, atmospheric depth, natural lighting, controlled depth of field.",
  },
  cartoon: {
    id: "cartoon",
    label: "Editorial cartoon",
    prompt: "Sophisticated editorial cartoon illustration, expressive but believable human forms, clean confident linework, refined shapes, subtle dimensional shading, restrained premium palette, intelligent visual storytelling, polished magazine illustration quality.",
    preferredModel: "@cf/lykon/dreamshaper-8-lcm",
  },
  "hand-drawn": {
    id: "hand-drawn",
    label: "Hand-drawn",
    prompt: "Hand-drawn editorial illustration, elegant ink and pencil texture, organic line variation, subtle paper grain, refined composition, human warmth, restrained sophisticated palette, polished magazine illustration quality.",
    preferredModel: "@cf/lykon/dreamshaper-8-lcm",
  },
  "3d": {
    id: "3d",
    label: "3D illustration",
    prompt: "Cinematic 3D illustration, believable stylized forms, refined materials, soft realistic lighting, subtle depth, premium visual design, restrained colors, sophisticated editorial advertising aesthetic.",
  },
  anime: {
    id: "anime",
    label: "Anime",
    prompt: "Cinematic anime-inspired editorial illustration, expressive but restrained character design, elegant composition, refined linework, atmospheric depth, sophisticated lighting, mature magazine-art direction rather than childish cartoon styling.",
    preferredModel: "@cf/lykon/dreamshaper-8-lcm",
  },
  watercolor: {
    id: "watercolor",
    label: "Watercolor",
    prompt: "Editorial watercolor illustration, expressive brushwork, delicate paper texture, controlled washes, subtle ink accents, atmospheric depth, sophisticated muted palette, premium magazine illustration aesthetic.",
    preferredModel: "@cf/lykon/dreamshaper-8-lcm",
  },
};

export const VISUAL_STYLE_OPTIONS = Object.values(VISUAL_STYLES);
