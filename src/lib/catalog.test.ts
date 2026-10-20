import { expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { CATALOG, SALE_PRODUCTS } from './catalog';
import { normalizeCartItems } from './cart';

it('uses the October prices and keeps the mixed Pro immediately after painted Pro', () => {
  const index=CATALOG.findIndex(p=>p.code==='FAM-PRO-PIN-20');
  expect(CATALOG[index+1]).toMatchObject({code:'FAM-PRO-PSP-00',price:77500});
  expect(CATALOG.find(p=>p.code==='FAM-STD-PIN-14')?.price).toBe(48000);
  expect(CATALOG.find(p=>p.code==='FAM-MAS-NAT-01')?.price).toBe(2975);
  expect(CATALOG.find(p=>p.code==='FAM-MAS-PIN-01')?.price).toBe(5355);
  expect(CATALOG.find(p=>p.code==='FAM-PRO-PIN-20')).toMatchObject({price:69170,description:expect.stringContaining('color base')});
});
it('offers all confirmed variants with matching server prices and local photos',()=>{
  expect(SALE_PRODUCTS).toHaveLength(26);
  expect(new Set(SALE_PRODUCTS.map(p=>p.name)).size).toBe(26);
  expect(new Set(CATALOG.map(p=>p.slug)).size).toBe(CATALOG.length);
  for(const p of CATALOG) expect(existsSync('public'+p.image)).toBe(true);
  for(const p of SALE_PRODUCTS) expect(normalizeCartItems([{product:p.name,quantity:1}])[0].unitPrice).toBe(p.price);
  expect(SALE_PRODUCTS.filter(p=>p.slug.endsWith('-logo'))).toHaveLength(6);
  const naturalPets=CATALOG.filter(p=>p.code.startsWith('FAM-MAS-NAT-'));
  expect(naturalPets).toHaveLength(7);
  expect(new Set(naturalPets.map(p=>p.image)).size).toBe(7);
});
it('prevents direct purchase of PA-004 until its price is confirmed',()=>{
  const p=CATALOG.find(p=>p.code==='PA-004')!;
  expect(p.purchasable).toBe(false);
  expect(()=>normalizeCartItems([{product:p.name,quantity:1}])).toThrow('Producto');
});
