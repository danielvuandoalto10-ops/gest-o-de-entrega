alter table public.pacotes
  add column if not exists motivo_insucesso text,
  add column if not exists observacao_insucesso text,
  add column if not exists tentativa_em timestamptz;

create index if not exists listas_baixas_usuario_data_idx
  on public.listas_baixas (usuario, data_baixas desc);
create index if not exists pacotes_motivo_insucesso_idx
  on public.pacotes (motivo_insucesso) where status = 'sem_sucesso';

drop policy if exists daniel_only_lists on public.listas_baixas;
drop policy if exists daniel_only_packages on public.pacotes;
drop policy if exists daniel_only_photos on public.fotos_entrega;

create policy delivery_user_lists
on public.listas_baixas
for all to anon, authenticated
using (
  usuario in ('Daniel', 'Rafael')
  and usuario = (current_setting('request.headers', true)::json ->> 'x-delivery-user')
)
with check (
  usuario in ('Daniel', 'Rafael')
  and usuario = (current_setting('request.headers', true)::json ->> 'x-delivery-user')
);

create policy delivery_user_packages
on public.pacotes
for all to anon, authenticated
using (
  exists (
    select 1 from public.listas_baixas l
    where l.id = pacotes.lista_id
      and l.usuario = (current_setting('request.headers', true)::json ->> 'x-delivery-user')
  )
)
with check (
  exists (
    select 1 from public.listas_baixas l
    where l.id = pacotes.lista_id
      and l.usuario = (current_setting('request.headers', true)::json ->> 'x-delivery-user')
  )
);

create policy delivery_user_photos
on public.fotos_entrega
for all to anon, authenticated
using (
  exists (
    select 1 from public.pacotes p
    join public.listas_baixas l on l.id = p.lista_id
    where p.id = fotos_entrega.pacote_id
      and l.usuario = (current_setting('request.headers', true)::json ->> 'x-delivery-user')
  )
)
with check (
  exists (
    select 1
    from public.pacotes p
    join public.listas_baixas l on l.id = p.lista_id
    where p.id = fotos_entrega.pacote_id
      and l.usuario = (current_setting('request.headers', true)::json ->> 'x-delivery-user')
  )
);

drop policy if exists daniel_only_delivery_photos_select on storage.objects;
drop policy if exists daniel_only_delivery_photos_insert on storage.objects;
drop policy if exists daniel_only_delivery_photos_update on storage.objects;
drop policy if exists daniel_only_delivery_photos_delete on storage.objects;

create policy delivery_user_photos_select
on storage.objects for select to anon, authenticated
using (
  bucket_id = 'fotos-entregas'
  and (storage.foldername(name))[1] = (current_setting('request.headers', true)::json ->> 'x-delivery-user')
);
create policy delivery_user_photos_insert
on storage.objects for insert to anon, authenticated
with check (
  bucket_id = 'fotos-entregas'
  and (storage.foldername(name))[1] = (current_setting('request.headers', true)::json ->> 'x-delivery-user')
);
create policy delivery_user_photos_update
on storage.objects for update to anon, authenticated
using (
  bucket_id = 'fotos-entregas'
  and (storage.foldername(name))[1] = (current_setting('request.headers', true)::json ->> 'x-delivery-user')
)
with check (
  bucket_id = 'fotos-entregas'
  and (storage.foldername(name))[1] = (current_setting('request.headers', true)::json ->> 'x-delivery-user')
);
create policy delivery_user_photos_delete
on storage.objects for delete to anon, authenticated
using (
  bucket_id = 'fotos-entregas'
  and (storage.foldername(name))[1] = (current_setting('request.headers', true)::json ->> 'x-delivery-user')
);