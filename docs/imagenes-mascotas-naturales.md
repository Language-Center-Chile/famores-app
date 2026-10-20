# Imágenes de mascotas naturales

Actualización 20/10/2026. Siete imágenes ilustrativas generadas con la herramienta
integrada de imágenes de ChatGPT, usando las figuras existentes como referencia.
Se revisaron visualmente cantidad, compartimentos y presencia de personalización.
Las fichas y el carrito comparten las mismas referencias de `src/lib/catalog.ts`.
Los precios, códigos y condiciones de compra no cambian.

## Archivos y variantes

Todos los archivos están en `public/images/products/`, en WebP de 960 × 960.
Las versiones previas se conservan; las fichas usan estos nombres nuevos para
evitar que una imagen antigua quede en caché.

| Variante | Archivo | Composición |
|---|---|---|
| Individual | fam-mas-nat-01-v2.webp | Una figura, sin caja |
| 3 sin logo | fam-mas-nat-03-v2.webp | Tres figuras, tres divisiones, tapa lisa |
| 3 con logo | fam-mas-nat-03-logo-v2.webp | Misma cantidad, «Tu logo aquí» en la tapa |
| 6 sin logo | fam-mas-nat-06-v2.webp | Seis figuras en seis divisiones, sin espacios vacíos |
| 6 con logo | fam-mas-nat-06-logo-v2.webp | Misma cantidad, «Tu logo aquí» en la tapa |
| 8 sin logo | fam-mas-nat-08-v2.webp | Ocho figuras en ocho divisiones, tapa lisa |
| 8 con logo | fam-mas-nat-08-logo-v2.webp | Misma cantidad, «Tu logo aquí» en la tapa |

## Prompts de producción

Instrucción visual común: fotografía ilustrativa de producto para ecommerce,
fondo de estudio cálido y claro, luz suave, madera natural sin pintar, figuras
tipo palito con cabeza redonda, dos orejas triangulares y cuerpo ligeramente
ahusado. Conservar el diseño de la figura de referencia. Composición cuadrada,
producto completo y figuras contables sin ocultamientos. Ninguna marca adicional.

- **Individual:** conservar una sola figura del modelo; retirar todas las otras,
  caja y relleno. Una mascota completa, de pie, centrada, sombra suave, sin texto.
- **3 sin logo:** exactamente tres figuras en una caja abierta de tres divisiones,
  una por división, tul amarillo suave. Tapa y caja completamente lisas.
- **3 con logo:** conservar exactamente la imagen de tres figuras y añadir solo
  un marco rectangular fino con el texto exacto «Tu logo aquí», incluida la tilde,
  como grabado marrón en el interior de la tapa.
- **6 sin logo:** caja exclusiva de seis divisiones en dos filas de tres, una figura
  por división. Total seis figuras, seis compartimentos ocupados y ningún espacio
  vacío. Cámara elevada para ver todas. Caja y tapa lisas, sin texto.
- **6 con logo:** conservar las seis figuras y sus posiciones; añadir únicamente
  el grabado rectangular «Tu logo aquí» al interior de la tapa.
- **8 sin logo:** ocho divisiones en dos filas de cuatro y exactamente una figura
  en cada una. Total ocho figuras, todas visibles. Caja y tapa lisas, sin texto.
- **8 con logo:** conservar las ocho figuras y sus posiciones; añadir únicamente
  el grabado rectangular «Tu logo aquí» al interior de la tapa.

«Tu logo aquí» es una muestra de personalización, no el logo que recibe el cliente.
Las notas públicas identifican las imágenes como ilustrativas. Las variantes
pintadas conservan sus imágenes anteriores; esta actualización corresponde a
las mascotas naturales solicitadas.
