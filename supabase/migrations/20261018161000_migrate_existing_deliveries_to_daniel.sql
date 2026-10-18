alter table public.listas_baixas drop constraint if exists listas_baixas_usuario_email_check;
update public.listas_baixas set usuario = 'Daniel' where lower(usuario) = 'daniel.vuandoalto10@gmail.com';
update public.pacotes set registrado_por = 'Daniel' where lower(registrado_por) = 'daniel.vuandoalto10@gmail.com';
alter table public.listas_baixas add constraint listas_baixas_usuario_check check (usuario in ('Daniel', 'Rafael'));
drop policy if exists delivery_user_photos_select on storage.objects;
create policy delivery_user_photos_select on storage.objects for select to anon, authenticated using (
  bucket_id = 'fotos-entregas'
  and (
    (storage.foldername(name))[1] = (current_setting('request.headers', true)::json ->> 'x-delivery-user')
    or ((current_setting('request.headers', true)::json ->> 'x-delivery-user') = 'Daniel' and (storage.foldername(name))[1] = 'daniel.vuandoalto10@gmail.com')
  )
);