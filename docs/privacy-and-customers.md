# Compra opcional con cuenta y preparación de privacidad

Fecha de revisión: 6 de octubre de 2026. Propuesta en PR; no desplegada.

## Criterio de producto

Comprar sin registro continúa disponible. Registrar una cuenta, guardar datos de
entrega y recibir publicidad son decisiones distintas. La cuenta no suscribe a
marketing y el checkout no condiciona el pago al guardado opcional de datos.

- Cuenta: nombre y correo; contraseña elegida al verificar el correo, almacenada con hash.
- Perfil opcional: nombre/apellido, teléfono y destino, editables o retirables.
  No se conserva RUT/DNI ni tarjeta en ese perfil.
- Historial: solo pedidos vinculados por ID de la cuenta autenticada al comprar.
  No se importa el historial de invitados por coincidencia de correo.
- Datos propios: descarga JSON autenticada, sin contraseñas, tokens ni datos ajenos.
- Cierre: contraseña actual, confirmación explícita, revocación de sesiones y
  borrado del registro de cuenta/perfil. Pedidos operativos y evidencia mínima de
  autorizaciones no se borran indiscriminadamente; requieren conservación lícita.
- Vendedores: sin acceso a datos de compradores ni solicitud de privacidad ajena.
- Acceso/rectificación/supresión/oposición/portabilidad/bloqueo/revocación:
  formulario para compradores invitados y otros casos; recepción visible en
  administración. Requiere verificación de identidad proporcional y tramitación
  humana; el formulario no certifica que una solicitud haya sido resuelta.

Los avisos de servicio y recuperación son distintos de comunicaciones comerciales.
No hay opt-in de publicidad, píxeles ni almacenamiento automático de campañas.
Los estilos Tailwind se compilan localmente y los iconos son SVG propios; se
eliminaron los scripts de CDN y fuentes externas del Layout. El build requiere
instalar dependencias de desarrollo antes de compilar; pueden omitirse en el
runtime ya compilado. La fuente utiliza fallback de sistema, sin Google Fonts.

## Fundamento normativo comprobado

La Ley 21.719 modifica la Ley 19.628 y tiene entrada en vigencia registrada para
el 1 de diciembre de 2026. El régimen actual sigue aplicándose antes de esa fecha.
No se presume vigente una eventual propuesta de postergación sin modificación
legal promulgada/publicada.

Fuentes primarias:
- [BCN: Ley 21.719 y texto actualizado](https://www.bcn.cl/leychile/Navegar?idNorma=1209272).
- [Academia Judicial: entrada en vigencia y alcance](https://academiajudicial.cl/recursos/actualizaciones-normativas/ley-21-719-que-regula-la-proteccion-y-el-tratamiento-de-los-datos-personales-y-crea-la-agencia-de-proteccion-de-datos-personales/).

Artículos relevantes del texto reformado: 3 (principios), 4–11 (derechos y
procedimiento), 12 (consentimiento), 13 (otras bases, incluyendo contrato),
14 ter (información pública), 14 quinquies (seguridad), 14 sexies (incidentes),
15 bis (encargados) y 27–29 (transferencias internacionales).

La compra utiliza datos necesarios para gestionar un contrato/obligaciones; no
se sustituye esa base por un consentimiento genérico obligatorio a todo uso.
Las opciones de cuenta y autocompletado tienen evidencia separada y versionada
(PRIVACY_VERSION). Los plazos, bases concretas y excepciones deben validarse para
la operación real; un checkbox o una política no bastan para cumplir integralmente.

## Activación técnica (pendiente, sin valores reales en Git)

Además del módulo SQLite y Flow del PR:

| Variable | Contenido que debe validar la operación |
|---|---|
| FAMORES_DATA_CONTROLLER | Persona natural o razón social responsable, identificada correctamente |
| FAMORES_LEGAL_REPRESENTATIVE | Representante legal si corresponde |
| FAMORES_CONTROLLER_ADDRESS | Dirección/canal físico de contacto del responsable |
| FAMORES_PRIVACY_EMAIL | Correo que realmente atienda solicitudes |
| FAMORES_RETENTION_POLICY | Plazos aprobados por categoría, fines, fundamento, excepciones y backups |
| FAMORES_ACCOUNT_MAIL_WEBHOOK | Workflow HTTPS de correo transaccional autorizado |
| FAMORES_ACCOUNT_MAIL_TOKEN | Bearer secret del workflow, separado de avisos de ventas |
| FAMORES_MAIL_ENCRYPTION_KEY | Clave aleatoria de 32 bytes en hex; respaldo seguro y rotación planificada |
| PUBLIC_SITE_URL | Origen HTTPS canónico del sitio; localhost HTTP solo para pruebas |

No se inventan identidad del responsable, destinatarios ni plazos legales.
El registro exige datos de privacidad configurados y servicio de correo.
La política pública identifica los campos pendientes cuando no están definidos;
no debe considerarse una política final aprobada ni publicarse como cumplimiento
certificado. Revisar proveedores/transferencias y confirmar la política completa
antes de desplegar esta ampliación.

## Correo de cuentas y secretos

El workflow recibe `{eventId,type,recipient,url}` con autenticación bearer.
Tipos: `verify_customer_email` y `reset_customer_password`. Debe enviar solo el
mensaje de servicio, deduplicar por eventId, escapar variables y no divulgar los
enlaces a otros destinatarios. Configurar el workflow para no guardar tokens en
logs o historial de ejecución; comprobar proveedor de correo, permisos y encargo.
No se creó un workflow ni se enviaron correos reales durante implementación.

Tokens aleatorios de un solo uso: 24 horas para verificación y una hora para
recuperación. Hash en tabla de tokens; las URLs de envío se guardan cifradas con
AES-256-GCM en outbox hasta entrega. El token va en fragmento del enlace, se mueve
al formulario y se limpia de la barra; no aparece en query, Referer o access logs.
Tras confirmar/resetear se eliminan tokens y correos pendientes de ese propósito.
Al enviar se omiten avisos cuyo token ya expiró y se elimina su payload tras éxito.
Errores de transporte dejan el envío pendiente; no se promete entrega inmediata.
Reintento por registro/recuperación posterior o botón de administración; no hay
worker periódico. Una cuenta ya existente no se sobrescribe por un nuevo registro.
Repetir un registro pendiente puede reenviar verificación sin sobrescribir la cuenta.
La contraseña se elige después de acreditar posesión del correo, evitando que
un registro previo no verificado imponga una contraseña ajena.
La recuperación autoservicio es solo para compradores; roles elevados siguen
provisionados y recuperados por el operador.

## Gobernanza que debe cerrarse antes de afirmar cumplimiento

| Tema | Preparado en código | Pendiente de operación/legal |
|---|---|---|
| Identidad/transparencia | Política versionada y configuración | Responsable real, representante, contactos y texto final |
| Finalidades y minimización | Compra separada de perfil/cuenta, sin marketing automático | Justificar cada campo; especialmente RUT/DNI aún solicitado por el checkout operativo |
| Conservación | Retirada de perfil, cierre y separación del registro de pedidos | Plazos por pedido/consentimiento/postulación/solicitud/registro incompleto; borrado programado y backups |
| Derechos | Exportación propia, edición/retirada/cierre, bandeja de solicitudes | Identidad proporcional, responsable de atención, seguimiento y respuesta dentro de plazos aplicables, bloqueo efectivo cuando proceda |
| Seguridad | Hashes, correo verificado, tokens cifrados, sesiones, permisos, CSRF, rate limits | HTTPS efectivo, cifrado de volumen/backups, restauración probada, monitoreo y revisión de accesos |
| Incidentes | Datos minimizados y avisos sin información personal innecesaria | Protocolo, registro, valoración del riesgo y comunicaciones a autoridad/titulares cuando procedan |
| Proveedores | Roles y workflows separados | Inventario y acuerdos con Hostinger/hosting real, Flow, correo/n8n, transportistas, subencargados y localizaciones |
| Transferencias internacionales | Sin fuentes/scripts externos automáticos en páginas | Revisar dónde están servidores, backups, correo y proveedores, y aplicar el mecanismo legal pertinente |
| Cumplimiento continuo | Pruebas unitarias, smoke HTTP y CI | Revisar instrucciones de Agencia y cambios de normativa antes de producción |

No hay auto-borrado por antigüedad, importación de compras de invitados, marketing,
ni tramitación automática de derechos. Las peticiones de bloqueo requieren actuar
sobre el tratamiento real; registrar la solicitud por sí solo no implementa ese
bloqueo. La bandeja no sustituye un registro organizacional de tratamiento o un
protocolo de incidentes. Un flujo de correo configurado no prueba por sí mismo
que el encargado/proveedor cumple todas sus obligaciones.
