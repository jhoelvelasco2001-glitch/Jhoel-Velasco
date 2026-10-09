/* Jhoel 1% — Configuración compartida (web, panel y administración)
   1. Crea tu proyecto en https://supabase.com
   2. En Project Settings → API copia "Project URL" y la clave "anon public"
   3. Pégalas aquí abajo. La clave "anon" es pública por diseño: la seguridad
      la ponen las reglas de supabase/schema.sql. NUNCA pegues aquí la clave
      "service_role". */
(function () {
  'use strict';

  var CONFIG = {
    supabaseUrl: '',        // ej. 'https://abcdefghijk.supabase.co'
    supabaseAnonKey: '',    // ej. 'eyJhbGciOiJIUzI1NiIsInR5cCI6...'
    siteUrl: 'https://jhoel1.com',
    whatsapp: '51912536501'
  };

  var db = null;
  if (CONFIG.supabaseUrl && CONFIG.supabaseAnonKey && window.supabase && window.supabase.createClient) {
    db = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  }

  // Traduce los errores más comunes de Supabase al español
  function errorText(err) {
    var m = (err && (err.message || err.error_description || String(err))) || '';
    var map = [
      [/invalid login credentials/i, 'Correo o contraseña incorrectos.'],
      [/email not confirmed/i, 'Confirma tu correo con el enlace que te enviamos antes de ingresar.'],
      [/user already registered/i, 'Ya existe una cuenta con este correo. Inicia sesión.'],
      [/password should be at least/i, 'La contraseña debe tener al menos 8 caracteres.'],
      [/rate limit|too many requests/i, 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'],
      [/failed to fetch|network/i, 'No se pudo conectar. Revisa tu conexión a internet.'],
      [/jwt expired|invalid jwt/i, 'Tu sesión expiró. Vuelve a iniciar sesión.']
    ];
    for (var i = 0; i < map.length; i++) if (map[i][0].test(m)) return map[i][1];
    return m || 'Ocurrió un error. Inténtalo de nuevo.';
  }

  window.J1 = { config: CONFIG, db: db, live: !!db, errorText: errorText };
})();
