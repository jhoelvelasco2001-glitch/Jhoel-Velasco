# Jhoel 1% — Sitio web

Landing page estática (HTML + CSS + JS, sin dependencias ni build) para la plataforma de inversión Jhoel 1%.

## Secciones
Inicio · Cifras clave · ¿Qué es? + Misión · Pilares · Fundador · Planes y referidos · Simulador · Retiros y riesgo · Contacto (WhatsApp) · Aviso legal.

## Configuración rápida
En `main.js`, bloque `CONFIG`:
- `whatsapp`: tu número con código de país, solo dígitos (ej. `51987654321`). Mientras esté vacío, el formulario no abre WhatsApp.
- `authApi`: dirección del servidor de cuentas. Mientras esté vacía, "Registrarse" envía la solicitud por WhatsApp (sin la contraseña) e "Iniciar sesión" muestra un aviso.
- Tasas del simulador (`baseRate`, `perReferral`, `maxBonus`, `promoRate`, `promoMonths`).

## Panel del inversionista
`panel.html` (con `panel.css` y `panel.js`) es el área interna: resumen, movimientos, retiros, referidos y perfil.
Hoy funciona en **modo demostración** con datos de ejemplo. Mientras `demoPanel` sea `true` en `main.js`, "Iniciar sesión" lleva a este panel; ponlo en `false` antes de lanzar si aún no hay servidor de cuentas.
Para datos reales hace falta un backend (por ejemplo Supabase) con usuarios, inversiones, movimientos, solicitudes de retiro y referidos.

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
