import { searchInstances } from './searchInstances.js';
import { searchSeries } from './searchSeries.js';

export const ENCAPSULATED_PDF_REPORT_SOP_CLASS_UID = '1.2.840.10008.5.1.4.1.1.104.1';

/**
 *
 * Search for all Encapsulated PDF instances within a study by looking for series with Modality=DOC
 * and then filtering instances by known Encapsulated PDF SOP Class UIDs.
 * @method
 * @param {string} studyInstanceUid - The Study Instance UID to search within.
 * @param {Object} [env=process.env] - Environment variable map. Must contain
 * `DICOMWEB_HOST` and optionally `DICOMWEB_AUTH` (`basic` or `bearer`),
 * `DICOMWEB_USER`, `DICOMWEB_PASS`, `DICOMWEB_TOKEN` and `DICOMWEB_TIMEOUT`.
 * @returns {Promise<Object[]>} Array of instance objects representing Encapsulated PDF Reports.
 * @throws {Error} If any HTTP response status is not in the 2xx range during the search process.
 * @example
 * const reports = await searchEncapsulatedPdfReports('1.2.840.113619.2.55.3.604688123.123.1591781234.467');
 */
export async function searchEncapsulatedPdfReports(studyInstanceUid, env = process.env) {
  const reports = [];

  // Search for series in the study
  const series = await searchSeries(studyInstanceUid, 'Modality=DOC', env);

  // For each Encapsulated PDF series, fetch all instances in parallel and filter for Encapsulated PDF SOP Class UIDs
  const instanceArrays = await Promise.all(
    series.map((s) => searchInstances(studyInstanceUid, s.seriesInstanceUid, '', env))
  );
  for (const instances of instanceArrays) {
    for (const instance of instances) {
      if (instance.sopClassUid === ENCAPSULATED_PDF_REPORT_SOP_CLASS_UID) {
        reports.push(instance);
      }
    }
  }

  return reports;
}
