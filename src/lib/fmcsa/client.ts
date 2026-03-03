import type { FmcsaCarrier, FmcsaLookupResult } from './types';

const FMCSA_API_BASE = 'https://mobile.fmcsa.dot.gov/qc/services/carriers';
const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// In-memory cache (in production, use Redis or database)
const cache = new Map<string, { data: FmcsaCarrier; cachedAt: Date }>();

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

export async function lookupCarrier(dotNumber: string): Promise<FmcsaLookupResult> {
  // Check cache first
  const cached = cache.get(dotNumber);
  if (cached) {
    const age = Date.now() - cached.cachedAt.getTime();
    if (age < CACHE_DURATION_MS) {
      return {
        success: true,
        data: cached.data,
        error: null,
        cachedAt: cached.cachedAt,
      };
    }
    cache.delete(dotNumber);
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

    // Cache the result
    const cachedAt = new Date();
    cache.set(dotNumber, { data: carrier, cachedAt });

    return {
      success: true,
      data: carrier,
      error: null,
      cachedAt,
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

export function clearCache(dotNumber?: string): void {
  if (dotNumber) {
    cache.delete(dotNumber);
  } else {
    cache.clear();
  }
}
