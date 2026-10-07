# Revisión local con datos ficticios

Requiere Node >=22.13 y dependencias instaladas con `npm ci`.
Ejecutar `node scripts/local-commerce-review.mjs`; compila y abre el servidor
solo en `http://127.0.0.1:3017`. Cambiar el puerto con FAMORES_REVIEW_PORT.

No modifica `.env`. Mantiene SQLite, credenciales aleatorias y el buzón simulado
en `data/local-review`, fuera de public y excluido de Git. No introducir datos
reales. Los usuarios de demostración son admin@example.test, seller@example.test,
other@example.test y buyer@example.test. Consultar la contraseña en el archivo
credentials.json; todos comparten esta contraseña de demostración.

El cupón DEMO10 descuenta 10% y pertenece a seller@example.test. Abrir /ingresar,
/panel, /comprar y /mi-cuenta para comparar los permisos. El usuario other no debe
ver el cupón del primer vendedor. Los datos persisten al reiniciar y no se resetean.

Para probar registro, usar un nuevo correo @example.test y leer el enlace de
verificación en mailbox.jsonl. La recuperación también llega a ese archivo.
Este buzón contiene enlaces sensibles de cuentas ficticias; no publicarlo.
Las notificaciones quedan capturadas allí sin enviar mensajes reales.

El preload se carga únicamente en este arranque y bloquea todas las solicitudes
fetch externas. Las credenciales Flow se vacían: el pago no se simula ni se cobra.
La prueba de compra completa requiere después un entorno Flow Sandbox con sus
credenciales y callbacks. Este arranque no sustituye esa validación.

Los textos de privacidad de este entorno son ficticios y están marcados DEMO.
No constituyen información lista para publicar. Detener con Ctrl+C.

Verificación automatizada de este arranque:
`node scripts/smoke-local-review.mjs`. Usa el puerto 3018 y deja sus registros
ficticios en la misma base de demostración. No ejecuta pagos.
