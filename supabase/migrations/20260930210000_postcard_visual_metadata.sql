-- Visual provenance for generated PostCards.
alter table public.postcard_cards
  add column if not exists visual_style text,
  add column if not exists image_model text;

create index if not exists postcard_cards_visual_style_idx
  on public.postcard_cards(visual_style);
