# 🪵 Proyecto FAMORES - MVP Transaccional

Plataforma web transaccional diseñada para digitalizar y automatizar la cotización y venta de herramientas terapéuticas sistémicas. 

Este MVP (Producto Mínimo Viable) elimina la fricción operativa de las ventas manuales por chat, ofreciendo una experiencia de usuario fluida y capturando datos estructurados para futuros modelos predictivos de fidelización.

## 🚀 Arquitectura y Tecnologías (Fase 1)

El proyecto opera bajo una arquitectura moderna y Serverless:

* **Frontend:** Framework Astro y Tailwind CSS para una carga ultrarrápida, diseño responsivo y alta conversión.
* **Backend y Base de Datos:** Integración mediante Fetch API hacia un Webhook de Google Apps Script, almacenando los datos de forma estructurada y en tiempo real en Google Sheets.
* **Checkout Inteligente:** Generación automatizada de links de WhatsApp pre-formateados con el resumen exacto de la compra.

## ⚙️ Características Principales

1. **Cotizador Dinámico:** Selección visual de productos y cálculo de envíos (Starken, Chilexpress, Retiro) en tiempo real.
2. **Captura de Datos Silenciosa:** Funcionalidad asíncrona que registra los datos del cliente (incluyendo correo y teléfono) en el CRM antes de redirigir a WhatsApp.
3. **Botón de Soporte Continuo:** Acceso rápido a asistencia directa para reducir la tasa de abandono.

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
