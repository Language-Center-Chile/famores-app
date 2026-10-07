export const PRIVACY_VERSION = '2026-10-06-v1';
export function privacySettings() {
  const responsible = process.env.FAMORES_DATA_CONTROLLER || '';
  const representative = process.env.FAMORES_LEGAL_REPRESENTATIVE || '';
  const address = process.env.FAMORES_CONTROLLER_ADDRESS || '';
  const email = process.env.FAMORES_PRIVACY_EMAIL || '';
  const retention = process.env.FAMORES_RETENTION_POLICY || '';
  return { responsible, representative, address, email, retention, ready:Boolean(responsible && address && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && retention) };
}
