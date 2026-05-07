import { buildAuthHeaders, buildSignal, makeQuery } from '../utils/query.js';
import { srToText } from '../utils/srToText.js';
import { scrubUrl, urlJoin } from '../utils/url.js';
import { SR_REPORTS_SOP_CLASS_UIDS } from './searchStructuredReports.js';

/**
 * Fetches a Structured Report instance's metadata from the DICOMweb server and converts it to a human-readable text format.
 * @method
 * @param {string} studyInstanceUid - The Study Instance UID of the SR instance.
 * @param {string} seriesInstanceUid - The Series Instance UID of the SR instance.
 * @param {string} sopInstanceUid - The SOP Instance UID of the SR instance.
 * @param {Object} [env=process.env] - Environment variable map. Must contain
 * `DICOMWEB_HOST` and optionally `DICOMWEB_AUTH` (`basic` or `bearer`),
 * `DICOMWEB_USER`, `DICOMWEB_PASS`, `DICOMWEB_TOKEN` and `DICOMWEB_TIMEOUT`.
 * @returns {Promise<string>} The human-readable text representation of the Structured Report.
 * @throws {Error} If the HTTP response status is not in the 2xx range or if the instance is not found.
 * @example
 * const text = await getStructuredReportText('1.2.840.113619.2.55.3.604688123.123.1591781234.467', '1.2.840.113619.2.55.3.604688123.123.1591781234.468', '1.2.840.113619.2.55.3.604688123.123.1591781234.469');
 */

export async function getStructuredReportText(
  studyInstanceUid,
  seriesInstanceUid,
  sopInstanceUid,
  env = process.env
) {
  // Fetch the instance metadata
  const headers = buildAuthHeaders(env);
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

  const items = await res.json();
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error(
      `Instance not found [Study Instance UID: ${studyInstanceUid}, Series Instance UID: ${seriesInstanceUid}, SOP Instance UID: ${sopInstanceUid}]`
    );
  }

  // Find the first item that matches a known SR SOP Class UID and convert it to text
  const srItem = items.find((item) =>
    SR_REPORTS_SOP_CLASS_UIDS.includes(item['00080016']?.Value?.[0])
  );
  if (srItem) {
    return srToText(srItem);
  }

  throw new Error(
    `Structured report not found [Study Instance UID: ${studyInstanceUid}, Series Instance UID: ${seriesInstanceUid}, SOP Instance UID: ${sopInstanceUid}]`
  );
}
