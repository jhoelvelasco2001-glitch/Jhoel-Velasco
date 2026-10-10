/* Jhoel 1% — Configuración compartida (web, panel y administración)
   1. Crea tu proyecto en https://supabase.com
   2. En Project Settings → API copia "Project URL" y la clave "anon public"
   3. Pégalas aquí abajo. La clave "anon" es pública por diseño: la seguridad
      la ponen las reglas de supabase/schema.sql. NUNCA pegues aquí la clave
      "service_role". */
(function () {
  'use strict';

  var CONFIG = {
    supabaseUrl: 'https://zyejqrogqffwmuxtmeyq.supabase.co',
    supabaseAnonKey: 'sb_publishable_hhBHvljHnzDCTjj9eU833Q_kprFkm52',
    siteUrl: 'https://jhoel1.com',
    whatsapp: '51912536501',

    // Medios de pago que verá el inversionista en "Agregar capital".
    // Deja un campo vacío ('') para no mostrarlo; si un medio queda sin datos,
    // se le pide al cliente que solicite los datos por WhatsApp.
    payments: {
      binance: {
        payId: '223487041',   // tu Binance Pay ID
        payName: 'Jhoel 1%',  // nombre que verá el cliente en Binance Pay
        usdtTrc20: 'TJHadW9CgdQAR4uvXBFpLK1f9sEPGYNPtY',  // dirección USDT red TRC20
        usdtTrc20Qr: 'assets/img/qr-usdt-trc20.png',    // código QR de esa dirección
        usdtBep20: ''         // dirección USDT red BEP20 (BSC), opcional
      },
      bank: {
        bankName: '',         // ej. 'BCP'
        holder: '',           // titular de la cuenta
        accountUsd: '',       // cuenta en dólares
        cciUsd: '',           // CCI en dólares
        accountPen: '',       // cuenta en soles (opcional)
        cciPen: ''
      },
      yape: {
        number: '',           // número de Yape / Plin
        holder: '',
        exchangeNote: 'Se convierte a dólares con el tipo de cambio del día.'
      }
    }
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
