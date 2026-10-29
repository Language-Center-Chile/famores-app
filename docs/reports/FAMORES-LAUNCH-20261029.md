# Famores — Catálogo vigente y candidata comercial, 29-10-2026

## Cambios
Retirados PA-001, PA-002, PA-003 y PA-004 de la fuente compartida de catálogo/carrito/precios. Eliminada publicidad de Atelier Traisy Audrey del encabezado de catálogo. Cierre de alianza confirmado por Katherine en conversación; no se borran activos ni ventas previas.
Se mantienen intactos los otros 23 productos/variantes, sus precios, códigos, descripciones, imágenes, cupones y funciones de cuentas. Un carrito antiguo o petición directa con un producto retirado recibe HTTP 400.
Actualización compatible de lockfile con npm audit fix --ignore-scripts, sin force ni cambio de major. Elimina tres avisos altos previos (undici, vite, zod).

## Validación final real
- npm ci --ignore-scripts --no-audit --no-fund: instalación inicial desde lockfile del PR; después actualización compatible de lockfile.
- npm test: 67/67.
- npm run typecheck: 0 errores/0 warnings; dos hints ya existentes sobre scripts inline.
- npm run build: exit 0, Astro SSR.
- node scripts/smoke-commerce.mjs: aprobado; catálogo/carrito de 23 variantes, 23 imágenes originales servidas con HTTP 200, retiro de cuatro productos en HTML y rechazo de cada uno en API; login, CSRF, cupones, montos, consentimiento, aislamiento vendedor/comprador, exportación y cierre de cuenta con datos ficticios.
- node scripts/smoke-local-review.mjs: aprobado comprador/vendedor/admin, Pro 69170, DEMO5, comisión 5522, pago bloqueado.
- npm audit --omit=dev --audit-level=high: exit 0, 0 vulnerabilidades. npm audit fix también informó 0 en árbol completo.
- No pagos, mensajes reales, migraciones ni cambios de hosting.
Se materializaron fuentes del commit base y las 23 imágenes originales usadas por el catálogo para probarlas; los assets no se modifican ni se duplican en este cambio.

## Integración y despliegue
Actualización de la candidata #38 (feat/catalogo-octubre-cupones-20261020), dependiente de #37. La CI y esta evidencia son de código/entorno de prueba, no certifican operación del hosting.
Antes de desplegar: acceso al alojamiento Node del sitio, revisar rama efectiva y backup, volumen persistente SQLite fuera de public, variables reales Flow/origen y configuración de responsables/correo si se habilitan cuentas. No se conocen esos valores remotos ni se identificó un panel accesible desde esta sesión; no afirmar faltantes en el hosting solo porque no existen localmente. No habilitar cuenta/registro ni cobrar sin comprobar la configuración real. No se reemplaza la operación vigente con una candidata no configurada.
Biodiversidad requiere un cierre separado de esquema/RLS/Auth/Flow en portal.biodiversidad.cl; no es intercambiable con este deploy.
