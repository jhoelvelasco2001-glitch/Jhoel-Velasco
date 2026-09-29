# Jhoel 1% — Sitio web

Landing page estática (HTML + CSS + JS, sin dependencias ni build) para la plataforma de inversión Jhoel 1%.

## Secciones
Inicio · Cifras clave · ¿Qué es? + Misión · Pilares · Fundador · Planes y referidos · Simulador · Retiros y riesgo · Contacto (WhatsApp) · Aviso legal.

## Configuración rápida
En `main.js`, bloque `CONFIG`:
- `whatsapp`: tu número con código de país, solo dígitos (ej. `51987654321`). Mientras esté vacío, el formulario no abre WhatsApp.
- Tasas del simulador (`baseRate`, `perReferral`, `maxBonus`, `promoRate`, `promoMonths`).

## Publicar
Sube el contenido de esta carpeta (incluido `.htaccess`) a `public_html` en Hostinger, o arrástrala a Netlify / Vercel / GitHub Pages.
Al cambiar CSS/JS, actualiza el `?v=AAAAMMDD` en `index.html`.

## Vista local
```
python3 -m http.server 8765
```
y abre http://localhost:8765
