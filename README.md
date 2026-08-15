# 🪵 Proyecto FAMORES - MVP Transaccional

Plataforma web transaccional diseñada para digitalizar y automatizar la cotización y venta de herramientas terapéuticas sistémicas. 

Este MVP (Producto Mínimo Viable) elimina la fricción operativa de las ventas manuales por chat, ofreciendo una experiencia de usuario fluida y capturando datos estructurados para futuros modelos predictivos de fidelización.

## 🚀 Arquitectura y Tecnologías (Fase 1)

El proyecto opera bajo una arquitectura moderna y Serverless:

* **Frontend:** Framework Astro y Tailwind CSS para una carga ultrarrápida, diseño responsivo y alta conversión.
* **Backend y Base de Datos:** Integración mediante Fetch API hacia un Webhook de Google Apps Script, almacenando los datos de forma estructurada y en tiempo real en Google Sheets.
* **Checkout Inteligente:** Generación automatizada de links de WhatsApp pre-formateados con el resumen exacto de la compra.

## ⚙️ Características Principales

1. **Cotizador Dinámico:** Selección visual de productos y cálculo de envíos (Blue Express, Starken, Chilexpress, Retiro) en tiempo real, vía `src/lib/checkout-config.ts` y `/api/quote`.
2. **Pago dinámico con Flow:** `/api/flow/create-payment` calcula el monto en el servidor (nunca confía en el monto enviado por el cliente) y crea la orden firmada con HMAC contra la API de Flow (`src/lib/flow.ts`).
3. **Captura de Datos Silenciosa:** Funcionalidad asíncrona que registra los datos del cliente en Google Sheets (webhook Apps Script) antes de redirigir a WhatsApp o Flow.
4. **Botón de Soporte Continuo:** Acceso rápido a asistencia directa para reducir la tasa de abandono.

### Nota de arquitectura: migración de checkout en curso

El checkout vive en dos capas: la lógica original (`src/pages/index.astro`, script inline) define la interacción base y el fallback de WhatsApp/transferencia; `public/js/checkout-v2.js` la sobrescribe en tiempo de ejecución (`window.selectSet/selectShipping/generarWhatsApp`) para añadir cotización real por API y pago dinámico con Flow. Funciona, pero mantiene dos objetos de estado en paralelo (`state.*` y `checkout.*`) sincronizados solo por convención. Antes de agregar funcionalidad nueva al checkout, conviene consolidar esto en un único módulo.

## 🧪 Desarrollo local

Requiere **Node >= 22.12.0** (ver `engines` en `package.json`).

```bash
npm ci
cp .env.example .env   # completar FLOW_API_KEY / FLOW_SECRET_KEY de Sandbox
npm run dev             # http://localhost:3000
```

Variables de entorno (`.env`, nunca commitear valores reales):

| Variable | Uso |
|---|---|
| `FLOW_API_KEY` / `FLOW_SECRET_KEY` | Credenciales Flow (usar Sandbox en desarrollo) |
| `FLOW_API_URL` | Debe ser `https://sandbox.flow.cl/api` o `https://www.flow.cl/api` (validado en `flow.ts`) |
| `PUBLIC_SITE_URL` | Dominio público que Flow usa para `urlConfirmation`/`urlReturn` |

Scripts:

```bash
npm run build       # build de producción (SSR, adapter @astrojs/node)
npm run typecheck   # astro check (tipos de .astro/.ts)
npm run test        # vitest (pricing, tarifas de envío, firma Flow)
npm run preview      # sirve el build localmente
```

---

## 🗺️ Roadmap y Escalabilidad (Fase 2)

El código actual representa el MVP Transaccional (Fase 1). La arquitectura ha sido diseñada para integrarse en un flujo de operaciones más complejo (Fase 2) que será orquestado íntegramente mediante automatizaciones de backend, sin intervención manual de la fuerza de ventas.

**Próximas Integraciones (En Backlog):**
1. **Orquestación con n8n:** Conexión del Webhook actual hacia flujos de n8n para crear un "Dashboard de Vida del Cliente" privado para la administración.
2. **Validación de Estados de Pago:** Implementación de un sistema de comprobación de transferencias ("Pendiente" -> "Comprobado") gestionado desde el Dashboard.
3. **WhatsApp Business API:** Automatización de notificaciones push al cliente en tiempo real:
   - *"Tu pago ha sido validado."*
   - *"Tu pedido ha sido enviado (Starken/Chilexpress)."*
4. **Fidelización y Encuestas NPS Automatizadas:** Trigger programado a los 5 días hábiles posteriores al envío para recopilar feedback estructurado (evaluación de la web, atención y estado del producto) directamente a la base de datos para análisis RFM.

**Deuda técnica identificada (auditoría 2026-08-15):**
- Consolidar `index.astro` + `checkout-v2.js` en un único módulo de checkout (ver nota de arquitectura arriba).
- No existe persistencia de pedidos propia: el registro vive solo en el dashboard de Flow y en Sheets (webhook `no-cors`, sin confirmación de escritura desde el navegador). Evaluar una entidad `Order` mínima antes de escalar volumen.
- No hay panel administrativo para visualizar pedidos.
- No hay capa de analítica/eventos de funnel (`view_product`, `add_to_cart`, `begin_checkout`, `purchase`, `whatsapp_click`) ni atribución UTM verificada. Esa integración debe validarse primero contra Google Apps Script y abordarse en un cambio separado.
- No hay linter configurado (sí hay `npm run typecheck` y `npm run test`, agregados en esta auditoría).
