# Cupones, alianzas y acceso por vendedor

## Arquitectura y activación

Se conserva Astro SSR, Flow y el alojamiento actual. El módulo opcional usa
SQLite integrado en Node >=22.13.0; no requiere un proveedor externo ni sustituye
ninguna hoja de cálculo. Este cambio necesita revisión antes de merge/deploy.

Para activar en Coolify (no realizado por esta rama):

1. Verificar Node >=22.13.0, preferiblemente Node 24 LTS.
2. Montar almacenamiento persistente fuera del directorio público, con acceso
   exclusivo del proceso. Definir `FAMORES_DB_PATH=/data/famores/commerce.sqlite`.
   No usar filesystem efímero. Respaldar mediante backup SQLite consistente;
   copiar solo el archivo principal mientras WAL está activo no es un backup válido.
3. Configurar `PUBLIC_SITE_URL=https://famores.com` y las credenciales Flow ya existentes.
4. Definir `FAMORES_ACCOUNTS_JSON` en los secretos del despliegue. Cada cuenta
   tiene `id` estable, `name`, `email`, `role` (`admin` o `seller`) y `passwordHash`.
   Generar el hash por stdin con `node scripts/hash-password.mjs` (usar un gestor
   de contraseñas o entrada sin eco, nunca una contraseña literal en un comando).
   El script requiere 12–256 caracteres y solo imprime un hash scrypt con sal.
5. Crear un cupón desde el panel administrador y comprobarlo con Flow Sandbox.
   No se incluyen descuentos activos ni usuarios de demostración en producción.
6. Antes de producción, comprobar checkout, callback, avisos y que el volumen
   conserva pedidos tras reiniciar/recrear el contenedor.

Con las variables vacías el checkout habitual sigue funcionando, sin cupones;
el acceso/formulario muestra disponibilidad próxima. No hay cambio automático
al hosting, DNS, credenciales o permisos existentes.

### Comprobar la configuración antes de activar

Ejecutar `npm run check:commerce-config` dentro del entorno del servidor, con sus
variables ya cargadas. Para un archivo privado local puede usarse
`node --env-file=/ruta/privada/famores.env scripts/check-commerce-config.mjs`.
No compartir ese archivo ni pegar sus secretos en Git o en informes.

El chequeo imprime únicamente nombres de variables y ajustes faltantes; no
imprime valores, abre SQLite, envía correos ni llama a Flow. Sale con código 1
si faltan requisitos de la ampliación completa (cupones, administración,
compradores y avisos externos), o 0 cuando el formato es válido. Las
notificaciones externas son opcionales para el módulo base; aquí se requieren
porque el objetivo de activación incluye avisos de venta y postulaciones.

Comprueba Node, origen público HTTPS, ruta absoluta fuera de `public`, cuentas
únicas con al menos un administrador, credenciales presentes, endpoint de Flow,
datos de privacidad, workflows y formato de la clave de cifrado. Un resultado
correcto no verifica credenciales, identidad legal ni cumplimiento, ni demuestra
persistencia, permisos, entrega de correo o recepción de notificaciones.
Completar después el ensayo Flow Sandbox, reinicio del contenedor, restauración
de respaldo y comprobación de correos. Las cinco pruebas del verificador se
ejecutan mediante `npm run test:commerce-config` y están incluidas en CI.

## Acceso y privacidad

Compradores: compra como invitado o con cuenta opcional y correo verificado. Vendedores: cuentas aprobadas provisionadas por
el operador; para vendedores/administración el alta y la recuperación siguen siendo manuales; compradores tienen registro y recuperación por correo.
Administrador: conjunto de pedidos, cupones y solicitudes. Vendedor: únicamente
su propia atribución por `sellerId`, sin email, RUT, teléfono o dirección del
comprador. La base sí conserva el detalle necesario para operar el pedido.

Sesiones opacas de 8 horas, hashes de tokens en SQLite, cookies HttpOnly,
SameSite Strict y Secure bajo HTTPS, cierre de sesión y rechazo de POST con
Origin distinto al dominio configurado. Login limitado por correo y globalmente.
Al eliminar una cuenta de la configuración, sus sesiones dejan de dar acceso.
Al cambiar el hash de contraseña, sus sesiones anteriores dejan de dar acceso.
No incluir cuentas/hashes reales, datos de pedidos ni backups en Git.

La aprobación comercial y alta de cuentas son manuales. El formulario solicita
consentimiento para evaluación/contacto; no inscribe a marketing. El honeypot y
los límites reducen spam, pero no sustituyen un servicio antiabuso si sube el tráfico.

## Pedidos, descuentos y límites de uso

Cupones: una sola clave por pedido, caracteres ASCII, normalizada a mayúsculas.
Monto fijo o porcentaje entero (1–99%), vencimiento al final del día de Chile
continental (zona America/Santiago, respetando horario de verano/invierno), máximo de usos y vendedor opcional.
No se apilan. Se descuenta solo subtotal de productos, sin tocar envío/caja;
se conserva al menos CLP 1 de productos para evitar pagos cero.
Los códigos emitidos son inmutables; pueden desactivarse y reemplazarse.

Antes de solicitar el pago se guarda el pedido y se reserva un uso en una
transacción SQLite. Pedidos pendientes y pagados consumen capacidad. Rechazados
y anulados la liberan. El panel muestra ventas pagadas, usos reservados y usos
disponibles por separado; un código vigente sin capacidad aparece como agotado.
Los cambios del carrito vuelven a validar las condiciones.
Flow se consulta con credenciales de servidor antes de confirmar; monto, moneda,
orden y referencia se comparan contra el pedido guardado. Los callbacks duplicados
no duplican ventas ni eventos, y uno pendiente tardío no rebaja un estado final.
Un cupón desactivado no invalida pedidos ya reservados/pagados.

Una respuesta de red ambigua durante creación de pago conserva la reserva, pues
Flow podría haber creado un cobro. La administración puede usar «Verificar en
Flow», que consulta por commerceId. No se liberan reservas por tiempo ni por un
HTTP error ambiguo: hacerlo permitiría sobrepasar el cupo si luego llega un pago.
Si Flow confirma que no existe un cobro se requiere conciliación operativa antes
de liberar esa reserva; no se ofrece un botón para marcar una venta pagada a mano.

Los pedidos históricos previos al módulo no se importan automáticamente; sus
callbacks siguen aceptándose. El dashboard muestra ventas desde la activación.
Una confirmación de un pedido no registrado no crea una venta inventada.
Los totales incluyen despacho y caja y están etiquetados así. No representan
comisiones ni utilidades; las tasas y reglas comerciales no están definidas.
Reembolsos posteriores a un pago requieren conciliación adicional (no implementada).

## Notificaciones

Avisos por venta pagada o solicitud guardados en una outbox durable y visibles en
administración. No se marcan entregados sin respuesta HTTP exitosa. Opcional:
`FAMORES_NOTIFICATION_WEBHOOK` (HTTPS) y `FAMORES_NOTIFICATION_TOKEN`, conectados
al flujo n8n existente. El webhook recibe `{eventId,type,createdAt,data}` y bearer
token. El receptor debe deduplicar por `eventId`; puede haber entrega repetida si
la red falla tras aceptar el evento. Debe enviar el correo al destinatario acordado,
no a un destinatario libre enviado por el navegador.

Los eventos no contienen RUT, dirección, teléfono ni correo del comprador. El aviso
de postulación incluye el ID para consultar el formulario en el panel. No se crea
ni configura un flujo n8n en esta rama y no se enviaron mensajes reales. Sin webhook
los avisos permanecen pendientes en el panel. Reintento manual por administración,
y automático al recibir posteriores callbacks/postulaciones; no hay cron propio.

## Operación y límites

Un servicio/persistencia local en un único host con volumen durable. No usar varias
réplicas en hosts distintos con bases separadas. Para escalar, migrar a una base
compartida y un trabajador de outbox. Últimos 500 pedidos y 100 solicitudes/avisos
visibles; métricas de pagos calculadas sobre todo el historial. La base puede crecer:
política de retención, exportaciones y borrado de solicitudes aún no están incluidos.
El esquema inicial se crea al abrir DB; cambios futuros necesitan migraciones.
No hay integración automática a Sheets/orquestador ni liquidación de comisiones.

La ampliación de compradores y la preparación de privacidad se detallan en [privacidad y cuentas](privacy-and-customers.md).

## Verificación

### Secuencia para aprobar la activación

Registrar el commit probado y el resultado de cada paso en el entorno de ensayo.
Las pruebas de CI no sustituyen estas verificaciones del alojamiento real.

| Paso | Evidencia necesaria antes de activar |
|---|---|
| Configuración | `check:commerce-config` termina con código 0 en el servidor; no copiar secretos al informe |
| Compra | Invitado y comprador con cuenta pueden completar un pedido en Flow Sandbox; el callback coincide en monto y orden |
| Cupón | Un pago pendiente reserva capacidad, uno pagado se cuenta una sola vez y uno rechazado libera su uso; el panel refleja los tres casos |
| Aislamiento | Cada vendedor ve solo sus ventas; cada comprador ve solo su historial y exportación |
| Correo | Verificación y recuperación llegan al buzón de prueba; enlaces vencidos o reutilizados se rechazan |
| Avisos | El receptor deduplica `eventId`; un fallo mantiene el evento pendiente y el reintento lo entrega |
| Datos | Reiniciar/recrear el contenedor conserva pedidos y cuentas; restaurar un backup consistente en una base separada |
| Privacidad | Responsable, contacto, conservación y texto final validados; atención de solicitudes y proveedores definidos |

Antes del despliegue, conservar la versión anterior y un backup consistente con
su procedimiento de restauración. Ante un fallo, detener la ampliación y volver
a la versión anterior conservando el volumen y los pedidos; no eliminar la base
ni liberar reservas ambiguas para recuperar disponibilidad. Conciliar en Flow
los pagos recibidos durante el cambio antes de reabrir la ampliación.

`npm run test`, `npm run typecheck`, `npm run build` y
`node scripts/smoke-commerce.mjs`. El smoke crea cuentas/cupones ficticios en una
base temporal, prueba login, CSRF, consentimiento, cálculo y aislamiento por
vendedor, y elimina la base al terminar. No llama a pagos ni envía mensajes.
El pipeline de CI ejecuta el smoke después del build.
