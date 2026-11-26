function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}

export const env = {
  get appSecret() { return required('IG_APP_SECRET'); },
  get verifyToken() { return required('IG_VERIFY_TOKEN'); },
  get apiVersion() { return process.env.IG_API_VERSION || 'v27.0'; },
  get supabaseUrl() { return required('SUPABASE_URL'); },
  get supabaseKey() { return required('SUPABASE_SERVICE_ROLE_KEY'); },
  get cronSecret() { return required('CRON_SECRET'); },
};
