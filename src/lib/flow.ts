import crypto from "node:crypto";

type FlowParams = Record<string, string | number>;

function getFlowConfig() {
  const apiKey = process.env.FLOW_API_KEY;
  const secretKey = process.env.FLOW_SECRET_KEY;
  const apiUrl = process.env.FLOW_API_URL || "https://sandbox.flow.cl/api";

  if (!apiKey || !secretKey) {
    throw new Error("Flow no está configurado: faltan FLOW_API_KEY/FLOW_SECRET_KEY.");
  }

  if (!/^https:\/\/(?:www|sandbox)\.flow\.cl\/api$/.test(apiUrl)) {
    throw new Error("FLOW_API_URL no es un endpoint permitido de Flow.");
  }

  return { apiKey, secretKey, apiUrl };
}

export function signFlowParams(params: FlowParams, secretKey: string) {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join("");

  return crypto.createHmac("sha256", secretKey).update(toSign).digest("hex");
}

export async function flowPost(path: string, input: Omit<FlowParams, "apiKey">) {
  const config = getFlowConfig();
  const params: FlowParams = { apiKey: config.apiKey, ...input };
  const signature = signFlowParams(params, config.secretKey);
  const body = new URLSearchParams();

  for (const [key, value] of Object.entries({ ...params, s: signature })) {
    body.set(key, String(value));
  }

  const response = await fetch(`${config.apiUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const text = await response.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = { message: text };
  }

  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Flow respondió HTTP ${response.status}.`);
  }

  return data;
}

export async function flowGet(path: string, input: Omit<FlowParams, "apiKey">) {
  const config = getFlowConfig();
  const params: FlowParams = { apiKey: config.apiKey, ...input };
  const signature = signFlowParams(params, config.secretKey);
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries({ ...params, s: signature })) {
    query.set(key, String(value));
  }

  const response = await fetch(`${config.apiUrl}${path}?${query.toString()}`);
  const text = await response.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = { message: text };
  }

  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Flow respondió HTTP ${response.status}.`);
  }

  return data;
}

export async function getFlowPaymentStatus(token: string) {
  return flowGet("/payment/getStatus", { token });
}
