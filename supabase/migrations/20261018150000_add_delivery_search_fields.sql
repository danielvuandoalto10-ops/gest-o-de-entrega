-- Additional fields for recipient/address/route searches.
-- Existing records are preserved; new fields are nullable for backward compatibility.
alter table public.pacotes
  add column if not exists nome_destinatario text,
  add column if not exists endereco text,
  add column if not exists parada_rota text;

-- Used by the scheduled retention cleanup (daily job is configured in the live project).
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
