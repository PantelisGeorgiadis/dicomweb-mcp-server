import { searchInstances } from './searchInstances.js';
import { searchSeries } from './searchSeries.js';

export const SR_REPORTS_SOP_CLASS_UIDS = [
  // Basic Text SR Storage
  '1.2.840.10008.5.1.4.1.1.88.11',
  // Enhanced SR Storage
  '1.2.840.10008.5.1.4.1.1.88.22',
  // Comprehensive SR Storage
  '1.2.840.10008.5.1.4.1.1.88.33',
  // Mammography CAD SR Storage
  '1.2.840.10008.5.1.4.1.1.88.50',
  // Chest CAD SR Storage
  '1.2.840.10008.5.1.4.1.1.88.65',
  // X-Ray Radiation Dose SR Storage
  '1.2.840.10008.5.1.4.1.1.88.67',
];

/**
 *
 * Search for all Structured Report instances within a study by looking for series with Modality=SR
 * and then filtering instances by known SR SOP Class UIDs.
 * @method
 * @param {string} studyInstanceUid - The Study Instance UID to search within.
 * @param {Object} [env=process.env] - Environment variable map. Must contain
 * `DICOMWEB_HOST` and optionally `DICOMWEB_AUTH` (`basic` or `bearer`),
 * `DICOMWEB_USER`, `DICOMWEB_PASS`, `DICOMWEB_TOKEN` and `DICOMWEB_TIMEOUT`.
 * @returns {Promise<Object[]>} Array of instance objects representing Structured Reports.
 * @throws {Error} If any HTTP response status is not in the 2xx range during the search process.
 * @example
 * const reports = await searchStructuredReports('1.2.840.113619.2.55.3.604688123.123.1591781234.467');
 */
export async function searchStructuredReports(studyInstanceUid, env = process.env) {
  const reports = [];

  // Search for series in the study
  const series = await searchSeries(studyInstanceUid, 'Modality=SR', env);

  // For each SR series, fetch all instances in parallel and filter for SR SOP Class UIDs
  const instanceArrays = await Promise.all(
    series.map((s) => searchInstances(studyInstanceUid, s.seriesInstanceUid, '', env))
  );
  for (const instances of instanceArrays) {
    for (const instance of instances) {
      if (SR_REPORTS_SOP_CLASS_UIDS.includes(instance.sopClassUid)) {
        reports.push(instance);
      }
    }
  }

  return reports;
}
