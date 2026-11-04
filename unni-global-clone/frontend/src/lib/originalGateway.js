/**
 * React/Vite adapter: keep the original API path/query verbatim after our gateway prefix.
 * The original API must be verified before choosing a service/path pair.
 * All requests are GET; private user flows are not cached by FastAPI.
 */
export const UNNI_SERVICES = Object.freeze({
  MOBILE: 'mobile-bff',
  OFFER: 'service-offer',
  HOSPITAL: 'hospital-detail',
  DOCTOR: 'doctor',
  PUBLIC_WEB: 'public-web',
});

export function gatewayUrl(service, originalPathAndQuery) {
  if (!Object.values(UNNI_SERVICES).includes(service)) {
    throw new Error('Unknown service');
  }
  if (typeof originalPathAndQuery !== 'string' || !originalPathAndQuery.startsWith('/') || originalPathAndQuery.startsWith('//')) {
    throw new Error('Original path must start with one slash');
  }
  const backend = (import.meta.env.VITE_GATEWAY_BASE ?? '').replace(/\/$/, '');
  return `${backend}/gateway/${service}${originalPathAndQuery}`;
}

export async function fetchOriginal(service, originalPathAndQuery, { language = 'en', signal } = {}) {
  const response = await fetch(gatewayUrl(service, originalPathAndQuery), {
    method: 'GET',
    credentials: 'omit',
    headers: { Accept: 'application/json', 'Accept-Language': language },
    signal,
  });
  if (!response.ok) throw new Error(`Original data unavailable (${response.status})`);
  return response.json(); // FastAPI preserves original bytes; decode only in UI.
}
