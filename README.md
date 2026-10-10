# Jhoel 1% — Sitio web

Landing page estática (HTML + CSS + JS, sin dependencias ni build) para la plataforma de inversión Jhoel 1%.

## Secciones
Inicio · Cifras clave · ¿Qué es? + Misión · Pilares · Fundador · Planes y referidos · Simulador · Retiros y riesgo · Contacto (WhatsApp) · Aviso legal.

## Configuración rápida
En `main.js`, bloque `CONFIG`:
- `whatsapp`: tu número con código de país, solo dígitos (ej. `51987654321`). Mientras esté vacío, el formulario no abre WhatsApp.
- `demoPanel` (en `main.js`): sin Supabase configurado, `true` hace que "Iniciar sesión" abra el panel de demostración.
- Tasas del simulador (`baseRate`, `perReferral`, `maxBonus`, `promoRate`, `promoMonths`).

## Cuentas, panel y administración
- `panel.html` (+ `panel.css`, `panel.js`): panel del inversionista: resumen, movimientos, retiros, referidos y perfil con verificación de identidad.
- `admin.html` (+ `admin.css`, `admin.js`): administración: depósitos, retiros, verificaciones, rentabilidad mensual.
- `reset.html`: crear una nueva contraseña desde el correo de recuperación.
- `config.js`: claves de Supabase. **Vacías = modo demostración** con datos de ejemplo.
- `supabase/schema.sql`: base de datos y reglas de seguridad.
- `supabase/GUIA-SUPABASE.md`: guía paso a paso para conectarlo todo.
- `lib/supabase.js`: librería oficial de Supabase (v2.117.3, licencia MIT).
- `hero3d.js` + `lib/three.min.js` (Three.js r128, licencia MIT): moneda 3D del inicio. Sin WebGL se muestra el logo normal.

## Idiomas
El botón del globo traduce la página con Google Translate a 17 idiomas. La marca "Jhoel 1%" no se traduce. Funciona en la web publicada (no en vista previa sin internet).

## Publicar
Sube el contenido de esta carpeta (incluido `.htaccess`) a `public_html` en Hostinger, o arrástrala a Netlify / Vercel / GitHub Pages.
Al cambiar CSS/JS, actualiza el `?v=AAAAMMDD` en `index.html`.

## Vista local
```
python3 -m http.server 8765
```
y abre http://localhost:8765
