import { buildAuthHeaders, buildSignal, makeQuery } from '../utils/query.js';
import { scrubUrl, urlJoin } from '../utils/url.js';

export const ALLOWED_OUTPUT_FORMATS = ['image/jpeg', 'image/png'];

/**
 * Fetches a rendered frame from a DICOM instance via the DICOMweb WADO-RS endpoint.
 * @method
 * @param {string} studyInstanceUid  - The Study Instance UID of the instance.
 * @param {string} seriesInstanceUid - The Series Instance UID of the instance.
 * @param {string} sopInstanceUid    - The SOP Instance UID of the instance.
 * @param {number} [frame=1]         - 1-based frame index to retrieve.
 * @param {string} [outputFormat='image/jpeg'] - Desired MIME type for the rendered output (e.g. `'image/jpeg'`, `'image/png'`).
 * @param {Object} [env=process.env] - Environment variable map. Must contain
 * `DICOMWEB_HOST` and optionally `DICOMWEB_AUTH` (`basic` or `bearer`),
 * `DICOMWEB_USER`, `DICOMWEB_PASS`, `DICOMWEB_TOKEN` and `DICOMWEB_TIMEOUT`.
 * @returns {Promise<Buffer>} The raw image data for the requested frame.
 * @throws {Error} If the HTTP response status is not in the 2xx range or if the frame data is empty.
 * @example
 * const imageData = await renderInstanceFrame('1.2.840.113619.2.55.3.604688123.123.1591781234.467', '1.2.840.113619.2.55.3.604688123.123.1591781234.468', '1.2.840.113619.2.55.3.604688123.123.1591781234.469', 1, 'image/jpeg');
 */

export async function renderInstanceFrame(
  studyInstanceUid,
  seriesInstanceUid,
  sopInstanceUid,
  frame = 1,
  outputFormat = 'image/jpeg',
  env = process.env
) {
  // Check if the output format is valid
  if (!ALLOWED_OUTPUT_FORMATS.includes(outputFormat)) {
    throw new Error(
      `Invalid output format: ${outputFormat}. Allowed formats are: ${ALLOWED_OUTPUT_FORMATS.join(', ')}`
    );
  }

  // Validate that the frame index is a positive integer
  if (frame < 1) {
    throw new Error(`Frame index must be a positive integer. Received: ${frame}`);
  }

  // Build auth headers from the environment variables
  const headers = buildAuthHeaders(env);

  // Perform the HTTP request to the DICOMweb server's WADO-RS endpoint
  const res = await makeQuery(
    urlJoin(
      env.DICOMWEB_HOST,
      `/studies/${encodeURIComponent(studyInstanceUid)}/series/${encodeURIComponent(seriesInstanceUid)}/instances/${encodeURIComponent(sopInstanceUid)}/frames/${encodeURIComponent(frame)}/rendered`
    ),
    {
      headers: {
        ...headers,
        Accept: outputFormat,
      },
      signal: buildSignal(env),
    }
  );
  if (!res.ok) {
    throw new Error(
      `Get instance frame request failed with HTTP status ${res.status} [uri: ${scrubUrl(res.url)}]`
    );
  }

  // Read the response body as raw binary
  const buffer = await res.arrayBuffer();
  if (!buffer) {
    throw new Error(
      `Instance frame not found [Study Instance UID: ${studyInstanceUid}, Series Instance UID: ${seriesInstanceUid}, SOP Instance UID: ${sopInstanceUid}, Frame: ${frame}]`
    );
  }

  return Buffer.from(buffer);
}
