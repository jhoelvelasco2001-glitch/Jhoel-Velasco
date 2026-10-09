# Conectar Jhoel 1% con Supabase

Con esta guía tu web pasa del modo demostración a cuentas reales: registro, inicio de sesión, panel del inversionista y panel de administración. Toma unos 20 minutos.

## 1. Crear el proyecto

1. Entra a <https://supabase.com> y crea una cuenta (puedes usar tu GitHub o tu correo).
2. Pulsa **New project**.
   - **Name:** `jhoel1`
   - **Database password:** crea una contraseña fuerte y guárdala en un lugar seguro.
   - **Region:** la más cercana a tus clientes (por ejemplo, *South America (São Paulo)*).
3. Espera uno o dos minutos a que el proyecto termine de crearse.

## 2. Crear la base de datos

1. En el menú izquierdo abre **SQL Editor** → **New query**.
2. Abre el archivo `supabase/schema.sql` de este proyecto, copia **todo** su contenido y pégalo.
3. Pulsa **Run**. Debe terminar con "Success. No rows returned".

Esto crea las tablas (perfiles, inversiones, movimientos, retiros, verificaciones), las reglas de seguridad y la carpeta privada `kyc` donde se guardan los documentos de identidad.

## 3. Configurar el inicio de sesión

En **Authentication → URL Configuration**:

- **Site URL:** la dirección de tu web, por ejemplo `https://jhoel1.com`
- **Redirect URLs:** agrega
  - `https://jhoel1.com/panel.html`
  - `https://jhoel1.com/reset.html`

En **Authentication → Sign In / Providers → Email**:

- Deja **Confirm email** activado (recomendado). Cada persona recibirá un correo para confirmar su cuenta.
- Opcional: en **Authentication → Emails** puedes traducir al español los correos de confirmación y de recuperación de contraseña.

> El plan gratuito de Supabase envía pocos correos por hora. Cuando tengas más registros, configura tu propio servicio de correo en **Authentication → Emails → SMTP Settings** (por ejemplo, Resend, Brevo o el correo de Hostinger).

## 4. Pegar las claves en la web

1. Ve a **Project Settings → API**.
2. Copia **Project URL** y la clave **anon public**.
3. Abre `config.js` y pégalas:

```js
supabaseUrl: 'https://TU-PROYECTO.supabase.co',
supabaseAnonKey: 'eyJhbGciOi...',
```

La clave **anon** es pública por diseño; la seguridad la ponen las reglas de la base de datos. **Nunca** pegues la clave `service_role` en la web.

Con las claves puestas, la web deja automáticamente el modo demostración.

## 5. Hacerte administrador

1. Sube la web (o ábrela en tu computadora) y **regístrate** con tu propio correo desde el botón "Registrarse".
2. Confirma tu correo.
3. En Supabase abre **SQL Editor** y ejecuta, cambiando el correo por el tuyo:

```sql
update public.profiles set role = 'admin' where email = 'tu-correo@ejemplo.com';
```

4. Inicia sesión en la web: entrarás directo a **Administración** (`admin.html`).

## 6. Cómo se usa día a día

| Tarea | Dónde |
|---|---|
| Ver capital total, retiros y verificaciones pendientes | Administración → Resumen |
| Registrar el depósito de un cliente | Inversionistas → clic en la persona → *Registrar depósito inicial* (marca la promoción si corresponde) |
| Agregar capital a una inversión | Inversionistas → persona → *Agregar capital* |
| Aprobar documentos de identidad | Verificaciones → *Ver archivo* → Aprobar o Rechazar (con motivo) |
| Pagar un retiro | Haz la transferencia por tu banco/Yape/USDT y luego en Retiros pulsa *Marcar pagado* |
| Acreditar la rentabilidad mensual | Rentabilidad → escribe el **resultado real** de la estrategia → *Calcular vista previa* → *Acreditar* |

### Sobre la rentabilidad

Cada inversión cobra en su propia fecha mensual (el mismo día en que empezó). Al acreditar:

- **Tasa objetivo:** 1% + 0.01% por referido válido (máximo 2%). En promoción de lanzamiento, 2%.
- **Tasa aplicada:** la menor entre la tasa objetivo y el **resultado real** que registres.

Así lo que reciben los inversionistas sale del desempeño real de la estrategia, como dicen tus Términos y Condiciones (cláusula 4). Cada cierre queda guardado en el historial con el resultado real que registraste.

### Referidos

Un referido cuenta como **válido** cuando verificó su identidad y tiene una inversión activa. Si deja de invertir, deja de contar. Las personas se registran con el enlace `https://jhoel1.com/?ref=CODIGO` que aparece en su panel.

## 7. Antes de lanzar

- [ ] Claves puestas en `config.js` y prueba completa: registro → confirmar correo → depósito → retiro.
- [ ] Tu cuenta tiene rol `admin`.
- [ ] Redirect URLs configuradas con tu dominio real.
- [ ] Correo propio (SMTP) configurado si esperas muchos registros.
- [ ] Revisión legal: autorización del regulador de tu país para captar y administrar fondos de terceros.

## 8. Copias de seguridad

El plan gratuito no incluye copias diarias automáticas. Desde **Database → Backups** puedes descargar una copia, o pasar al plan Pro (US$25/mes) cuando manejes dinero real, que incluye copias diarias.
