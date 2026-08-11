export const BOX_PRICE = 1500;

export const PRODUCTS = {
  "Set Standard Pintado": 39990,
  "Set Standard con Expresiones": 42990,
  "Set Sin Pintar": 25000,
  "Set Personalizado": 45000,
} as const;

export const PETS = {
  "Mascota Pintada": 4500,
  "Mascota Sin Pintar": 2500,
} as const;

export const DOMESTIC_COURIERS = ["blue", "starken", "chilexpress"] as const;
export type DomesticCourier = (typeof DOMESTIC_COURIERS)[number];

export const COURIER_LABELS: Record<DomesticCourier, string> = {
  blue: "Blue Express",
  starken: "Starken",
  chilexpress: "Chilexpress",
};

export const RM_COMMUNE_ZONES = {
  cercana: ["Peñalolén", "La Reina", "Ñuñoa", "Macul", "La Florida"],
  urbana: [
    "Providencia", "Santiago", "Las Condes", "San Joaquín", "San Miguel",
    "La Cisterna", "La Granja", "San Ramón", "Vitacura", "Independencia", "Recoleta",
  ],
  extendida: [
    "Puente Alto", "Maipú", "Pudahuel", "Quilicura", "Huechuraba", "Conchalí",
    "Renca", "Quinta Normal", "Cerro Navia", "Lo Prado", "Estación Central", "Cerrillos",
    "Pedro Aguirre Cerda", "Lo Espejo", "El Bosque", "La Pintana", "San Bernardo", "Lo Barnechea",
  ],
  periferica: [
    "Colina", "Lampa", "Tiltil", "Padre Hurtado", "Peñaflor", "Talagante", "El Monte",
    "Isla de Maipo", "Buin", "Paine", "Pirque", "Calera de Tango", "Curacaví", "Melipilla",
    "María Pinto", "San José de Maipo", "San Pedro", "Alhué",
  ],
} as const;

export const SHIPPING_RATES = {
  rm: {
    cercana: { blue: 3490, starken: 3990, chilexpress: 4490 },
    urbana: { blue: 4490, starken: 4990, chilexpress: 5490 },
    extendida: { blue: 5490, starken: 5990, chilexpress: 6490 },
    periferica: { blue: 6490, starken: 6990, chilexpress: 7490 },
  },
  centroSur: { blue: 7490, starken: 7990, chilexpress: 8490 },
  extremoNorte: { blue: 11490, starken: 11990, chilexpress: 12490 },
  extremoAustral: { blue: 11990, starken: 12490, chilexpress: 12990 },
} as const;

const CENTRO_SUR = new Set([
  "Atacama", "Coquimbo", "Valparaíso", "Libertador Gral. Bernardo O'Higgins",
  "Maule", "Ñuble", "Biobío", "Araucanía", "Los Ríos", "Los Lagos",
]);
const EXTREMO_NORTE = new Set(["Arica y Parinacota", "Tarapacá", "Antofagasta"]);
const EXTREMO_AUSTRAL = new Set(["Aysén", "Magallanes y de la Antártica Chilena"]);

export function getShippingRate(courier: string, region: string, commune: string): number | null {
  if (!DOMESTIC_COURIERS.includes(courier as DomesticCourier)) return null;
  const key = courier as DomesticCourier;

  if (region === "Metropolitana de Santiago") {
    for (const [zone, communes] of Object.entries(RM_COMMUNE_ZONES)) {
      if ((communes as readonly string[]).includes(commune)) {
        return SHIPPING_RATES.rm[zone as keyof typeof SHIPPING_RATES.rm][key];
      }
    }
    return null;
  }

  if (CENTRO_SUR.has(region)) return SHIPPING_RATES.centroSur[key];
  if (EXTREMO_NORTE.has(region)) return SHIPPING_RATES.extremoNorte[key];
  if (EXTREMO_AUSTRAL.has(region)) return SHIPPING_RATES.extremoAustral[key];
  return null;
}

export type OrderSelection = {
  product: string;
  pet?: string | null;
  courier: string;
  region?: string;
  commune?: string;
};

export function calculateOrder(selection: OrderSelection) {
  const productPrice = PRODUCTS[selection.product as keyof typeof PRODUCTS];
  if (typeof productPrice !== "number") throw new Error("Producto no válido.");

  const petPrice = selection.pet
    ? PETS[selection.pet as keyof typeof PETS]
    : 0;
  if (selection.pet && typeof petPrice !== "number") throw new Error("Mascota no válida.");

  if (selection.courier === "retiro") {
    return {
      productPrice,
      petPrice,
      shippingPrice: 0,
      boxPrice: 0,
      total: productPrice + petPrice,
      courierLabel: "Retiro presencial",
    };
  }

  const shippingPrice = getShippingRate(
    selection.courier,
    selection.region || "",
    selection.commune || "",
  );
  if (shippingPrice === null) throw new Error("Destino o courier sin tarifa configurada.");

  const courier = selection.courier as DomesticCourier;
  return {
    productPrice,
    petPrice,
    shippingPrice,
    boxPrice: BOX_PRICE,
    total: productPrice + petPrice + shippingPrice + BOX_PRICE,
    courierLabel: COURIER_LABELS[courier],
  };
}
