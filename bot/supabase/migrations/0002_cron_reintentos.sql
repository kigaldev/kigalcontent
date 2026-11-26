-- Reloj de 5 minutos: reintenta los comentarios que quedaron en cola (pausa o tope de los FRENOS).
-- Ejecútalo DESPUÉS del primer despliegue, sustituyendo los dos valores <...>.
-- Supabase › Database › Extensions: activa pg_cron y pg_net (o deja que lo haga este script).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Se puede repetir: si los secretos ya existen, se actualizan (cron.schedule con el mismo nombre también reemplaza).
do $$
declare
  v_secret text := '<CRON_SECRET igual que en Vercel>';
  v_url    text := 'https://<tu-proyecto>.vercel.app/api/cron/reintentos';
  v_id     uuid;
begin
  select id into v_id from vault.secrets where name = 'bot_cron_secret';
  if v_id is null then perform vault.create_secret(v_secret, 'bot_cron_secret');
  else perform vault.update_secret(v_id, v_secret); end if;

  select id into v_id from vault.secrets where name = 'bot_reintentos_url';
  if v_id is null then perform vault.create_secret(v_url, 'bot_reintentos_url');
  else perform vault.update_secret(v_id, v_url); end if;
end $$;

select cron.schedule(
  'bot-reintentos',
  '*/5 * * * *',
  $$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'bot_reintentos_url'),
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'bot_cron_secret')
    ),
    timeout_milliseconds := 55000
  );
  $$
);
