import { parseQuery } from './queryParser.js';
import { scrubUrl } from './url.js';

/**
 * Builds HTTP request headers for a DICOMweb request, including authentication if configured.
 * @method
 * @param {Object} [env=process.env] - Environment variable map. Optionally contains
 * `DICOMWEB_AUTH` (`basic` or `bearer`), `DICOMWEB_USER`, `DICOMWEB_PASS`, and `DICOMWEB_TOKEN`.
 * @returns {Object} HTTP headers object with at least `Accept: application/dicom+json`.
 * @throws {Error} If `DICOMWEB_AUTH=basic` but `DICOMWEB_USER` or `DICOMWEB_PASS` are missing.
 * @throws {Error} If `DICOMWEB_AUTH=bearer` but `DICOMWEB_TOKEN` is missing.
 */
export function buildAuthHeaders(env = process.env) {
  const headers = { Accept: 'application/dicom+json' };
  const authType = env.DICOMWEB_AUTH?.toLowerCase();
  if (authType === 'basic') {
    if (!env.DICOMWEB_USER || !env.DICOMWEB_PASS) {
      throw new Error('DICOMWEB_USER and DICOMWEB_PASS are required for basic auth');
    }
    const credentials = Buffer.from(`${env.DICOMWEB_USER}:${env.DICOMWEB_PASS}`).toString('base64');
    headers['Authorization'] = `Basic ${credentials}`;
  } else if (authType === 'bearer') {
    if (!env.DICOMWEB_TOKEN) {
      throw new Error('DICOMWEB_TOKEN is required for bearer auth');
    }
    headers['Authorization'] = `Bearer ${env.DICOMWEB_TOKEN}`;
  }
  return headers;
}

/**
 * Builds a QIDO-RS query URL and headers from a freeform query string.
 * Parses the query string into URL parameters and headers, including authentication if configured.
 * This function is used internally by searchStudies, searchSeries, and searchInstances to construct
 * the appropriate URL and headers for the DICOMweb request based on the provided query string and
 * environment variables.
 * @method
 * @param {string} queryString - Freeform space-separated `key=value` query string.
 * Supports DICOM keyword names (e.g. `PatientName=DOE*`), 8-character hex tags
 * (e.g. `00100020=12345`), and the special parameters `limit`, `offset`,
 * `fuzzymatching`, and `includefield`.
 * @param {Object} [env=process.env] - Environment variable map. Must contain
 * `DICOMWEB_HOST` and optionally `DICOMWEB_AUTH` (`basic` or `bearer`),
 * `DICOMWEB_USER`, `DICOMWEB_PASS`, `DICOMWEB_TOKEN` and `DICOMWEB_TIMEOUT`.
 * @returns {Object} Object containing `urlParams`, `headers`, and `errors` for the QIDO request.
 * @property {URLSearchParams} urlParams - URL search parameters for the QIDO request.
 * @property {Object}          headers   - HTTP headers for the QIDO request.
 * @property {string[]}        errors    - Non-fatal parse warnings from the query string (e.g. unknown tags).
 * @throws {Error} If `DICOMWEB_AUTH=basic` but `DICOMWEB_USER` or `DICOMWEB_PASS` are missing.
 * @throws {Error} If `DICOMWEB_AUTH=bearer` but `DICOMWEB_TOKEN` is missing.
 */
export function buildQuery(queryString, env = process.env) {
  const parsed = parseQuery(queryString);
  const urlParams = new URLSearchParams();

  // Attribute filters
  for (const attr of parsed.queryAttributes.values()) {
    // Prefer the keyword name when available (more readable URLs); fall back to hex tag
    urlParams.set(attr.name ?? attr.tag, attr.rawValue);
  }

  // Standard QIDO parameters
  if (parsed.fuzzyMatching) {
    urlParams.set('fuzzymatching', 'true');
  }
  urlParams.set('limit', String(parsed.limit));
  if (parsed.offset > 0) {
    urlParams.set('offset', String(parsed.offset));
  }
  if (parsed.includeFields.length > 0) {
    urlParams.set('includefield', parsed.includeFields.join(','));
  }

  return { urlParams, headers: buildAuthHeaders(env), errors: parsed.errors };
}

/**
 * Builds an `AbortSignal` from the `DICOMWEB_TIMEOUT` environment variable.
 *
 * Returns `undefined` when the variable is unset, empty, or not a positive finite number,
 * preventing a `RangeError` from `AbortSignal.timeout` on invalid input.
 * @method
 * @param {Object} [env=process.env] - Environment variable map. Optionally contains
 * `DICOMWEB_TIMEOUT` (milliseconds as a numeric string).
 * @returns {AbortSignal|undefined} An `AbortSignal` that times out after the configured
 * number of milliseconds, or `undefined` if no valid timeout is configured.
 */
export function buildSignal(env = process.env) {
  const timeout = Number(env.DICOMWEB_TIMEOUT);
  return Number.isFinite(timeout) && timeout > 0 ? AbortSignal.timeout(timeout) : undefined;
}

/**
 * Thin wrapper around the global `fetch` that converts low-level network errors
 * (e.g. DNS failure, connection refused) into a descriptive `Error` that includes
 * the request URL, instead of the opaque `TypeError: fetch failed` Node.js emits.
 * @method
 * @param {string} url - The URL to fetch.
 * @param {RequestInit} [options] - Fetch options (headers, signal, …).
 * @returns {Promise<Response>} The fetch response.
 * @throws {Error} If a network-level error occurs before a response is received.
 */
export async function makeQuery(url, options) {
  try {
    return await fetch(url, options);
  } catch (err) {
    const cause = err.cause?.message ?? err.message;
    throw new Error(
      `Network error connecting to DICOMweb server [uri: ${scrubUrl(url)}]: ${cause}`,
      { cause: err }
    );
  }
}
