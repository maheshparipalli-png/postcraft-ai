-- Persistent storage for PostCraft generated visual-storytelling images.
insert into storage.buckets (id, name, public)
values ('postcraft-images', 'postcraft-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "PostCraft images are publicly readable" on storage.objects;
create policy "PostCraft images are publicly readable"
on storage.objects for select
to public
using (bucket_id = 'postcraft-images');

drop policy if exists "Users can upload PostCraft images" on storage.objects;
create policy "Users can upload PostCraft images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'postcraft-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users can update their PostCraft images" on storage.objects;
create policy "Users can update their PostCraft images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'postcraft-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'postcraft-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users can delete their PostCraft images" on storage.objects;
create policy "Users can delete their PostCraft images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'postcraft-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

alter table public.postcard_cards
  add column if not exists image_url text,
  add column if not exists image_storage_path text,
  add column if not exists visual_prompt text,
  add column if not exists motivational_sentence text,
  add column if not exists visual_concept text;

create index if not exists postcard_cards_image_storage_path_idx
  on public.postcard_cards(image_storage_path);
