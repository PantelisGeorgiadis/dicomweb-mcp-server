import { buildQuery, buildSignal, makeQuery } from '../utils/query.js';
import { mapDicomItem } from '../utils/resultsMapper.js';
import { scrubUrl, urlJoin } from '../utils/url.js';

/**
 * Searches for DICOM instances on a DICOMweb server using StudyInstanceUID, SeriesInstanceUID
 * and a freeform query string.
 * Parses the query string into QIDO-RS URL parameters, performs an HTTP GET request
 * against the configured DICOMweb host, and returns the results as an array of plain
 * objects with camelCase property names, sorted by series date/time descending.
 * @method
 * @param {string} studyInstanceUid - The Study Instance UID to search within.
 * @param {string} seriesInstanceUid - The Series Instance UID to search within.
 * @param {string} queryString - Freeform space-separated `key=value` query string.
 * Supports DICOM keyword names (e.g. `SOPClassUID=1.2.840.10008.5.1.4.1.1.2`), 8-character hex tags
 * (e.g. `00080016=1.2.840.10008.5.1.4.1.1.2`), and the special parameters `limit`, `offset`,
 * `fuzzymatching`, and `includefield`.
 * @param {Object} [env=process.env] - Environment variable map. Must contain
 * `DICOMWEB_HOST` and optionally `DICOMWEB_AUTH` (`basic` or `bearer`),
 * `DICOMWEB_USER`, `DICOMWEB_PASS`, `DICOMWEB_TOKEN` and `DICOMWEB_TIMEOUT`.
 * @returns {Promise<Object[]>} Mapped instance objects sorted by Instance Number ascending.
 * @throws {Error} If the HTTP response status is not in the 2xx range.
 * @example
 * const instances = await searchInstances('1.2.840.113619.2.55.3.604688123.123.1591781234.467', '1.2.840.113619.2.55.3.604688123.123.1591781234.468', 'SOPClassUID=1.2.840.10008.5.1.4.1.1.2 limit=10');
 */
export async function searchInstances(
  studyInstanceUid,
  seriesInstanceUid,
  queryString,
  env = process.env
) {
  // Build URL parameters and headers from the query string and environment variables
  const { urlParams, headers } = buildQuery(queryString, env);

  // Perform the HTTP request to the DICOMweb server's QIDO endpoint
  const res = await makeQuery(
    urlJoin(
      env.DICOMWEB_HOST,
      `/studies/${encodeURIComponent(studyInstanceUid)}/series/${encodeURIComponent(seriesInstanceUid)}/instances?${urlParams}`
    ),
    {
      headers,
      signal: buildSignal(env),
    }
  );
  if (!res.ok) {
    throw new Error(
      `Search instances request failed with HTTP status ${res.status} [uri: ${scrubUrl(res.url)}]`
    );
  }

  // Parse the JSON response
  const items = await res.json();
  if (!items || !Array.isArray(items) || items.length === 0) {
    return [];
  }

  // Map DICOM JSON items
  const instances = items.map(mapDicomItem).sort((a, b) => {
    const ai = parseInt(a.instanceNumber, 10);
    const bi = parseInt(b.instanceNumber, 10);
    if (isNaN(ai) && isNaN(bi)) {
      return 0;
    }
    if (isNaN(ai)) {
      return 1;
    }
    if (isNaN(bi)) {
      return -1;
    }
    return ai - bi;
  });

  return instances;
}
