export type VisualStyle = "editorial" | "cartoon" | "hand-drawn" | "3d" | "anime" | "watercolor";

export type VisualStyleConfig = {
  id: VisualStyle;
  label: string;
  prompt: string;
  preferredModel?: string;
};

const CINEMATIC_DIRECTION =
  "Cinematic visual storytelling, deliberate film-frame composition, strong foreground/midground/background separation, atmospheric depth, intentional perspective, directional natural lighting, subtle dramatic contrast, dimensional shadows, controlled depth of field, and a memorable single moment rather than a generic stock image.";

export const VISUAL_STYLES: Record<VisualStyle, VisualStyleConfig> = {
  editorial: {
    id: "editorial",
    label: "Editorial photo",
    prompt: `${CINEMATIC_DIRECTION} Photorealistic premium editorial photograph, natural textures, realistic human proportions, natural lighting, sophisticated magazine photography.`,
  },
  cartoon: {
    id: "cartoon",
    label: "Editorial cartoon",
    prompt: `${CINEMATIC_DIRECTION} Sophisticated editorial cartoon illustration, expressive but believable human forms, clean confident linework, refined shapes, subtle dimensional shading, restrained premium palette, intelligent visual storytelling, polished magazine illustration quality.`,
    preferredModel: "@cf/lykon/dreamshaper-8-lcm",
  },
  "hand-drawn": {
    id: "hand-drawn",
    label: "Hand-drawn",
    prompt: `${CINEMATIC_DIRECTION} Hand-drawn editorial illustration, elegant ink and pencil texture, organic line variation, subtle paper grain, refined composition, human warmth, restrained sophisticated palette, polished magazine illustration quality.`,
    preferredModel: "@cf/lykon/dreamshaper-8-lcm",
  },
  "3d": {
    id: "3d",
    label: "3D illustration",
    prompt: `${CINEMATIC_DIRECTION} Cinematic 3D illustration, believable stylized forms, refined materials, soft realistic lighting, subtle depth, premium visual design, restrained colors, sophisticated editorial advertising aesthetic.`,
  },
  anime: {
    id: "anime",
    label: "Anime",
    prompt: `${CINEMATIC_DIRECTION} Cinematic anime-inspired editorial illustration, expressive but restrained character design, elegant composition, refined linework, atmospheric depth, sophisticated lighting, mature magazine-art direction rather than childish cartoon styling.`,
    preferredModel: "@cf/lykon/dreamshaper-8-lcm",
  },
  watercolor: {
    id: "watercolor",
    label: "Watercolor",
    prompt: `${CINEMATIC_DIRECTION} Editorial watercolor illustration, expressive brushwork, delicate paper texture, controlled washes, subtle ink accents, atmospheric depth, sophisticated muted palette, premium magazine illustration aesthetic.`,
    preferredModel: "@cf/lykon/dreamshaper-8-lcm",
  },
};

export const VISUAL_STYLE_OPTIONS = Object.values(VISUAL_STYLES);
