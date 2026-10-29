import { test } from 'vitest';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkCommerceConfig } from './check-commerce-config.mjs';

const fixture = () => ({
  PUBLIC_SITE_URL: 'https://famores.com', FAMORES_DB_PATH: '/data/famores/commerce.sqlite',
  FAMORES_ACCOUNTS_JSON: JSON.stringify([{id:'admin',name:'Test operator',email:'operator@example.test',role:'admin',passwordHash:`scrypt:${'a'.repeat(32)}:${'b'.repeat(128)}`}]),
  FLOW_API_KEY:'fixture-api-secret',FLOW_SECRET_KEY:'fixture-flow-secret',FLOW_API_URL:'https://sandbox.flow.cl/api',
  FAMORES_DATA_CONTROLLER:'Fixture operator',FAMORES_CONTROLLER_ADDRESS:'Fixture address',FAMORES_RETENTION_POLICY:'Fixture policy',FAMORES_PRIVACY_EMAIL:'privacy@example.test',
  FAMORES_ACCOUNT_MAIL_WEBHOOK:'https://mail.famores.com/workflow',FAMORES_NOTIFICATION_WEBHOOK:'https://mail.famores.com/notifications',
  FAMORES_ACCOUNT_MAIL_TOKEN:'fixture-account-secret',FAMORES_NOTIFICATION_TOKEN:'fixture-notification-secret',FAMORES_MAIL_ENCRYPTION_KEY:'c'.repeat(64),
});
test('accepts a complete format and reports every missing requirement without exposing values', () => {
  assert(checkCommerceConfig(fixture(), '24.0.0').every(check => check.ok));
  assert(checkCommerceConfig({}, '22.12.0').every(check => !check.ok));
  assert(!JSON.stringify(checkCommerceConfig(fixture())).includes('fixture-api-secret'));
});
test('rejects public database paths and memory or relative storage', () => {
  for (const path of [':memory:', 'data/commerce.sqlite', resolve('public/commerce.sqlite'), resolve('public')]) {
    assert.equal(checkCommerceConfig({...fixture(), FAMORES_DB_PATH:path}).find(c=>c.name==='FAMORES_DB_PATH').ok,false);
  }
});
test('rejects invalid origins, provider endpoints and placeholder secrets', () => {
  for (const origin of ['http://famores.com','https://user:secret@famores.com','https://famores.com/path','https://your-public-domain.example']) {
    assert.equal(checkCommerceConfig({...fixture(), PUBLIC_SITE_URL:origin}).find(c=>c.name==='PUBLIC_SITE_URL').ok,false);
  }
  assert.equal(checkCommerceConfig({...fixture(),FLOW_API_KEY:'replace_me'}).find(c=>c.name==='FLOW_API_KEY').ok,false);
  assert.equal(checkCommerceConfig({...fixture(),FLOW_API_URL:'https://unknown.test/api'}).find(c=>c.name==='FLOW_API_URL').ok,false);
});
test('requires an administrator and rejects duplicate account identities and malformed JSON', () => {
  const account=JSON.parse(fixture().FAMORES_ACCOUNTS_JSON)[0];
  for (const accounts of ['invalid','[]',JSON.stringify([{...account,role:'seller'}]),JSON.stringify([account,account])]) {
    assert.equal(checkCommerceConfig({...fixture(),FAMORES_ACCOUNTS_JSON:accounts}).find(c=>c.name==='FAMORES_ACCOUNTS_JSON').ok,false);
  }
});
test('CLI fails on missing configuration and never prints supplied secrets', () => {
  const result=spawnSync(process.execPath,['scripts/check-commerce-config.mjs'],{encoding:'utf8',env:{FLOW_API_KEY:'do-not-print-this-secret'}});
  assert.equal(result.status,1);assert(result.stdout.includes('FALTA PUBLIC_SITE_URL'));assert(!result.stdout.includes('do-not-print-this-secret'));assert.equal(result.stderr,'');
});
