import { buildAuthHeaders, buildSignal, makeQuery } from '../utils/query.js';
import { mapDicomItem } from '../utils/resultsMapper.js';
import { scrubUrl, urlJoin } from '../utils/url.js';

/**
 * Fetches an instance's metadata from the DICOMweb server and converts it to a human-readable text format.
 * @method
 * @param {string} studyInstanceUid - The Study Instance UID of the instance.
 * @param {string} seriesInstanceUid - The Series Instance UID of the instance.
 * @param {string} sopInstanceUid - The SOP Instance UID of the instance.
 * @param {Object} [env=process.env] - Environment variable map. Must contain
 * `DICOMWEB_HOST` and optionally `DICOMWEB_AUTH` (`basic` or `bearer`),
 * `DICOMWEB_USER`, `DICOMWEB_PASS`, `DICOMWEB_TOKEN` and `DICOMWEB_TIMEOUT`.
 * @returns {Promise<Object[]>} The metadata of the instance as an array of DICOM JSON objects.
 * @throws {Error} If the HTTP response status is not in the 2xx range or if the instance is not found.
 * @example
 * const metadata = await getInstanceMetadata('1.2.840.113619.2.55.3.604688123.123.1591781234.467', '1.2.840.113619.2.55.3.604688123.123.1591781234.468', '1.2.840.113619.2.55.3.604688123.123.1591781234.469');
 */

export async function getInstanceMetadata(
  studyInstanceUid,
  seriesInstanceUid,
  sopInstanceUid,
  env = process.env
) {
  // Build auth headers from the environment variables
  const headers = buildAuthHeaders(env);

  // Perform the HTTP request to the DICOMweb server's WADO-RS endpoint
  const res = await makeQuery(
    urlJoin(
      env.DICOMWEB_HOST,
      `/studies/${encodeURIComponent(studyInstanceUid)}/series/${encodeURIComponent(seriesInstanceUid)}/instances/${encodeURIComponent(sopInstanceUid)}/metadata`
    ),
    {
      headers,
      signal: buildSignal(env),
    }
  );
  if (!res.ok) {
    throw new Error(
      `Get instance metadata request failed with HTTP status ${res.status} [uri: ${scrubUrl(res.url)}]`
    );
  }

  // Parse the JSON response
  const items = await res.json();
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error(
      `Instance not found [Study Instance UID: ${studyInstanceUid}, Series Instance UID: ${seriesInstanceUid}, SOP Instance UID: ${sopInstanceUid}]`
    );
  }

  return items.map(mapDicomItem);
}
