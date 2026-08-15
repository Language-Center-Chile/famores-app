import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { signFlowParams } from "./flow";

describe("signFlowParams", () => {
  it("signs params sorted alphabetically by key, independent of insertion order", () => {
    const secret = "test-secret";
    const a = signFlowParams({ b: 2, a: 1, c: "x" }, secret);
    const b = signFlowParams({ c: "x", a: 1, b: 2 }, secret);
    expect(a).toBe(b);
  });

  it("matches a manually computed HMAC-SHA256 signature over sorted key+value pairs", () => {
    const secret = "test-secret";
    const params = { amount: 1000, apiKey: "abc", commerceOrder: "FAM-1" };
    // Keys sorted alphabetically: amount, apiKey, commerceOrder
    const toSign = "amount1000apiKeyabccommerceOrderFAM-1";
    const expected = crypto.createHmac("sha256", secret).update(toSign).digest("hex");
    expect(signFlowParams(params, secret)).toBe(expected);
  });

  it("produces a different signature when any param value changes", () => {
    const secret = "test-secret";
    const base = signFlowParams({ amount: 1000, commerceOrder: "FAM-1" }, secret);
    const changed = signFlowParams({ amount: 1001, commerceOrder: "FAM-1" }, secret);
    expect(base).not.toBe(changed);
  });

  it("produces a different signature for a different secret key", () => {
    const params = { amount: 1000, commerceOrder: "FAM-1" };
    const signedA = signFlowParams(params, "secret-a");
    const signedB = signFlowParams(params, "secret-b");
    expect(signedA).not.toBe(signedB);
  });
});
