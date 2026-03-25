import type { FmcsaCarrier, FmcsaLookupResult } from './types';

const FMCSA_API_BASE = 'https://mobile.fmcsa.dot.gov/qc/services/carriers';
const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CachedSnapshot {
  fmcsaSnapshot: Record<string, unknown> | null;
  fmcsaLastCheck: Date | null;
}

async function fetchWithRetry(
  url: string,
  retries = 3,
  baseDelay = 1000
): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      if (response.status === 429 || response.status >= 500) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      return response;
    } catch (error) {
      if (attempt === retries - 1) throw error;
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}

/**
 * Looks up a carrier by DOT number from the FMCSA API.
 *
 * If a `cachedData` snapshot is provided and is within the 7-day cache window,
 * the cached data is returned without hitting the FMCSA API. This uses the
 * existing carriers.fmcsaSnapshot/fmcsaLastCheck columns in the DB.
 *
 * @param dotNumber - The USDOT number to look up
 * @param cachedData - Optional cached snapshot from the carriers table
 */
export async function lookupCarrier(
  dotNumber: string,
  cachedData?: CachedSnapshot
): Promise<FmcsaLookupResult> {
  // Check DB-backed cache if provided
  if (cachedData?.fmcsaSnapshot && cachedData.fmcsaLastCheck) {
    const age = Date.now() - cachedData.fmcsaLastCheck.getTime();
    if (age < CACHE_DURATION_MS) {
      return {
        success: true,
        data: cachedData.fmcsaSnapshot as unknown as FmcsaCarrier,
        error: null,
        cachedAt: cachedData.fmcsaLastCheck,
      };
    }
  }

  const apiKey = process.env.FMCSA_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      data: null,
      error: 'FMCSA API key not configured',
      cachedAt: null,
    };
  }

  try {
    const url = FMCSA_API_BASE + '/' + dotNumber + '?webKey=' + apiKey;
    const response = await fetchWithRetry(url);

    if (!response.ok) {
      return {
        success: false,
        data: null,
        error: 'FMCSA API returned status ' + response.status,
        cachedAt: null,
      };
    }

    const json = await response.json();
    const carrier = json?.content?.carrier as FmcsaCarrier;

    if (!carrier) {
      return {
        success: false,
        data: null,
        error: 'Carrier not found in FMCSA database',
        cachedAt: null,
      };
    }

    return {
      success: true,
      data: carrier,
      error: null,
      cachedAt: new Date(),
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      cachedAt: null,
    };
  }
}
