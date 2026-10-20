# Imágenes de mascotas pintadas

Revisión local del 20/10/2026 sobre el commit a2634e3. Se incorporan siete
imágenes ilustrativas generadas con la herramienta integrada `image_gen`;
no son fotografías de inventario. Se mantienen las siete imágenes de madera
natural y todos los precios, códigos, nombres y condiciones de compra.
Los originales anteriores permanecen en el repositorio.

## Archivos finales

En `public/images/products/`, WebP de 960 × 960:

| Archivo | Contenido |
|---|---|
| fam-mas-pin-01-v2.webp | Una mascota pintada, sola y sin caja |
| fam-mas-pin-03-v2.webp | Tres mascotas, tres divisiones ocupadas, tapa lisa |
| fam-mas-pin-03-logo-v3.webp | Tres mascotas, tres divisiones, «Tu logo aquí» |
| fam-mas-pin-06-v2.webp | Seis mascotas, dos filas de tres divisiones ocupadas, tapa lisa |
| fam-mas-pin-06-logo-v3.webp | Seis mascotas, seis divisiones, «Tu logo aquí» |
| fam-mas-pin-08-v2.webp | Ocho mascotas, dos filas de cuatro divisiones ocupadas, tapa lisa |
| fam-mas-pin-08-logo-v3.webp | Ocho mascotas, ocho divisiones, «Tu logo aquí» |

El catálogo y la compra comparten estas referencias en `src/lib/catalog.ts`.
Las notas indican que las imágenes son ilustrativas y que el texto del logo
es una muestra de personalización.

## Prompts empleados con la herramienta integrada

Prompt común: editar la imagen natural de la misma cantidad conservando
geometría, cantidad, divisiones, cámara, fondo cálido claro, iluminación,
caja, tul y composición. Pintar las figuras siguiendo la foto original
`fam-mas-pin-01.webp` solo como referencia de pintura: gato naranja atigrado,
gato blanco con corazón rosa y gato dorado con nariz y patas rosas; conservar
el aspecto de pintura artesanal, orejas triangulares, cabeza redonda y cuerpo
ahusado. Cada figura debe verse completa y poder contarse. No añadir ni quitar
figuras, cabezas, divisiones ni objetos. Una sola imagen cuadrada, sin montaje,
texto, marcas ni logos.

Variaciones:

- **Individual:** exactamente una mascota naranja pintada, de pie, sin caja.
- **Tres:** exactamente tres mascotas en tres divisiones ocupadas, una por
  división. Tapa interior completamente lisa.
- **Seis:** exactamente seis mascotas en dos filas de tres; exactamente seis
  divisiones, todas ocupadas. No usar caja de ocho ni dejar espacios vacíos.
  Repetir los tres diseños por fila. Tapa interior completamente lisa.
- **Ocho:** exactamente ocho mascotas en dos filas de cuatro; exactamente ocho
  divisiones, todas ocupadas. Tapa interior completamente lisa.
- **Con logo (3, 6 y 8):** editar la imagen pintada correspondiente cambiando
  únicamente la tapa por una tapa extraíble apoyada detrás de la caja,
  con su cara exterior superior visible. Añadir un marco rectangular fino grabado
  y el texto exacto «Tu logo aquí», incluida la tilde, en marrón legible sobre esa cara exterior; el interior queda sin texto.
  Mantener cantidad de figuras y divisiones, pintura, posiciones, cámara,
  caja, tul, sombras y fondo. No añadir otras marcas ni ocultar figuras.

Las salidas se revisaron visualmente antes de convertirlas a WebP. La
conversión solo reduce el tamaño a 960 × 960 y codifica con calidad 88.

## Corrección de tapa exterior (20/10/2026)

Las tres variantes pintadas con logo (3, 6 y 8 figuras) usan ahora v3, con
la inscripción en la cara exterior de una tapa extraíble apoyada detrás de
la caja abierta. Se conservan las cantidades, compartimentos, diseños pintados,
tul amarillo y fondo crema. Las versiones v2 permanecen solo como historial.

Edición con la herramienta integrada `image_gen` (precise-object-edit): cada
imagen pintada v2 como objetivo y la natural de tres figuras con logo v3 como
referencia de posición de tapa. Instrucción: sustituir la tapa con grabado
interior por una tapa plana extraíble con «Tu logo aquí» grabado en su cara
exterior superior; preservar exactamente 3/6/8 mascotas pintadas y sus
compartimentos, colores, poses, luz y fondo. Sin elementos adicionales.

Los archivos finales son `public/images/products/fam-mas-pin-03-logo-v3.webp`,
`fam-mas-pin-06-logo-v3.webp` y `fam-mas-pin-08-logo-v3.webp`. Catálogo y compra
consumen las mismas referencias de `src/lib/catalog.ts`.
