import { buildQuery, buildSignal, makeQuery } from '../utils/query.js';
import { mapDicomItem } from '../utils/resultsMapper.js';
import { scrubUrl, urlJoin } from '../utils/url.js';

/**
 * Searches for DICOM studies on a DICOMweb server using a freeform query string.
 * Parses the query string into QIDO-RS URL parameters, performs an HTTP GET request
 * against the configured DICOMweb host, and returns the results as an array of plain
 * objects with camelCase property names, sorted by study date/time descending.
 * @method
 * @param {string} queryString - Freeform space-separated `key=value` query string.
 * Supports DICOM keyword names (e.g. `PatientName=DOE*`), 8-character hex tags
 * (e.g. `00100020=12345`), and the special parameters `limit`, `offset`,
 * `fuzzymatching`, and `includefield`.
 * @param {Object} [env=process.env] - Environment variable map. Must contain
 * `DICOMWEB_HOST` and optionally `DICOMWEB_AUTH` (`basic` or `bearer`),
 * `DICOMWEB_USER`, `DICOMWEB_PASS`, `DICOMWEB_TOKEN` and `DICOMWEB_TIMEOUT`.
 * @returns {Promise<Object[]>} Mapped study objects sorted by study date/time descending.
 * @throws {Error} If the HTTP response status is not in the 2xx range.
 * @example
 * const studies = await searchStudies('PatientName=DOE* StudyDate=20240101- limit=10');
 */
export async function searchStudies(queryString, env = process.env) {
  // Build URL parameters and headers from the query string and environment variables
  const { urlParams, headers } = buildQuery(queryString, env);

  // Perform the HTTP request to the DICOMweb server's QIDO endpoint
  const res = await makeQuery(urlJoin(env.DICOMWEB_HOST, `/studies?${urlParams}`), {
    headers,
    signal: buildSignal(env),
  });
  if (!res.ok) {
    throw new Error(
      `Search studies request failed with HTTP status ${res.status} [uri: ${scrubUrl(res.url)}]`
    );
  }

  // Parse the JSON response
  const items = await res.json();
  if (!items || !Array.isArray(items) || items.length === 0) {
    return [];
  }

  // Map DICOM JSON items
  const studies = items
    .map(mapDicomItem)
    .sort((a, b) =>
      `${b.studyDate ?? ''}${b.studyTime ?? ''}`.localeCompare(
        `${a.studyDate ?? ''}${a.studyTime ?? ''}`
      )
    );

  return studies;
}
