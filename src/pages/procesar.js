import fs from 'node:fs/promises';
import path from 'node:path';

// Configuramos este archivo como un endpoint dinámico del servidor (API)
export const prerender = false;

// ==========================================
// 1. CONFIGURACIÓN DE DATOS MAESTROS ( Katherine's Data )
// ==========================================
const PRECIOS = {
    "pintado": 39990,
    "sin_pintar": 25000
};

const COSTO_CAJA = 1500;

const DATOS_BANCO = `Nombre: Katherine Stehberg
Rut: 13.687.247-8
Banco: Santander
Tipo: Cuenta Corriente
Número cuenta: 68370043
Email: famoresporelmundo@gmail.com`;

export async function POST({ request }) {
    try {
        const data = await request.formData();

        const nombre_cliente = data.get('nombre') || 'Desconocido';
        const tipo_set = data.get('tipo_set') || 'sin_pintar';
        const metodo_envio = data.get('metodo_envio') || 'retiro';
        const comuna = data.get('comuna') || '';

        // Validar producto y obtener precio base
        const precio_base = PRECIOS[tipo_set.toLowerCase()] || 25000;
        let total_inmediato = precio_base;
        let nota_envio = "";

        // Aplicar reglas de negocio
        if (metodo_envio.toLowerCase() === "chilexpress") {
            total_inmediato = precio_base + COSTO_CAJA;
            nota_envio = "El envío se realiza por Chilexpress (por pagar). Yo pago el envío al dejarlo, y una vez que tenga el comprobante de la sucursal, te pediré el reembolso de ese monto exacto. En el total actual ya va incluido el valor de la caja de embalaje.";
        } else if (metodo_envio.toLowerCase() === "starken") {
            total_inmediato = precio_base;
            nota_envio = "El envío se realiza por Starken bajo la modalidad 'Por Pagar'. Tú pagas el costo del envío directamente a Starken cuando recibas el paquete en tu domicilio o sucursal.";
        } else {
            total_inmediato = precio_base;
            nota_envio = "Puedes retirar tu set directamente en el local cercano a Metro Grecia coordinando el horario.";
        }

        const tag_contacto = `Int Pal - ${nombre_cliente}`;

        // Generación del mensaje respuesta estructurado (por si lo necesitas usar después)
        const mensaje_whatsapp = `¡Hola ${nombre_cliente}! ✨
El set incluye dos familias de 7 integrantes cada una (Total: 14 figuras). 

El total de tu set ${tipo_set.charAt(0).toUpperCase() + tipo_set.slice(1)} es de $${total_inmediato.toLocaleString('es-CL')}.
📍 Despacho: ${nota_envio}

Para proceder con la preparación de tus Famores, puedes realizar la transferencia a los siguientes datos:

${DATOS_BANCO}

Por favor, me envías el comprobante de transferencia y tus datos de despacho (Dirección completa, Rut y Teléfono). ¡Muchas gracias! ❤️`;

        // ==========================================
        // DATA SCIENCE: Guardar en archivo histórico
        // ==========================================
        const registro_venta = {
            fecha: new Date().toISOString().replace('T', ' ').substring(0, 16),
            tag_contacto: tag_contacto,
            cliente: nombre_cliente,
            comuna: comuna,
            producto: tipo_set,
            metodo_envio: metodo_envio,
            total_cobrado: total_inmediato
        };

        // Ruta del archivo JSON donde se guardará todo el historial (Data Science)
        const dbPath = path.resolve(process.cwd(), 'ventas_historial.json');

        let registros = [];
        try {
            // Leemos el archivo si existe
            const content = await fs.readFile(dbPath, 'utf-8');
            if (content) registros = JSON.parse(content);
        } catch (e) {
            // Si el archivo no existe, no hay problema, empezamos con array vacío
        }

        registros.push(registro_venta);

        // Guardamos el JSON actualizado
        await fs.writeFile(dbPath, JSON.stringify(registros, null, 4), 'utf-8');

        // Retornamos un JSON para indicar éxito al frontend
        return new Response(JSON.stringify({
            success: true,
            mensaje_respuesta: mensaje_whatsapp,
            registro_guardado: registro_venta
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Error al procesar el pedido:", error);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
