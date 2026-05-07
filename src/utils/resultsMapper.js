import { DICOM_TAG_DICTIONARY } from './dataDictionary.js';
import { dicomPersonName, dicomVal, formatDicomDate, formatDicomTime } from './utils.js';

// VRs whose values are raw binary blobs — excluded from mapping
const EXCLUDED_VRS = new Set(['OB', 'OD', 'OF', 'OL', 'OV', 'OW', 'UN']);

/**
 * Converts a PascalCase / ALLCAPS DICOM keyword to lowerCamelCase.
 * @method
 * @private
 * @param {string} str - DICOM keyword (e.g. `"StudyInstanceUID"`, `"PatientID"`).
 * @returns {string} camelCase property name (e.g. `"studyInstanceUid"`, `"patientId"`).
 */
function toCamelCase(str) {
  return str
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .split('_')
    .map((word, i) =>
      i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join('');
}

/**
 * Pre-built list of mappable DICOM fields derived from the data dictionary.
 * Binary VRs are excluded; sequences (`SQ`) are included for recursive mapping.
 * @type {Object[]}
 * @property {string} tag      - 8-character uppercase hex tag (e.g. `"00100020"`).
 * @property {string} propName - camelCase JavaScript property name (e.g. `"patientId"`).
 * @property {string} vr       - DICOM Value Representation.
 */
const FIELD_DESCRIPTORS = Object.entries(DICOM_TAG_DICTIONARY)
  .filter(
    ([, entry]) =>
      entry.name && !entry.vr.split(/\s*[|]\s*|\s+or\s+/i).some((v) => EXCLUDED_VRS.has(v.trim()))
  )
  .map(([key, entry]) => ({
    tag: key.replace(/[(),]/g, '').toUpperCase(),
    propName: toCamelCase(entry.name),
    vr: entry.vr,
  }));

/**
 * Maps a raw DICOM JSON object to a plain JavaScript object.
 *
 * Property names are derived from the DICOM keyword converted to camelCase.
 * The following VR-specific mappings are applied:
 * - `PN` (Person Name) — returns the Alphabetic component of the name.
 * - `DA` (Date) — formatted as an ISO 8601 date string via `formatDicomDate`.
 * - `SQ` (Sequence) — mapped recursively as an array of objects.
 * - All other non-binary VRs — values joined by `'/'` via `dicomVal`.
 * - Binary VRs (`OB`, `OD`, `OF`, `OL`, `OV`, `OW`, `UN`) — excluded.
 *
 * Tags not present in the source object are omitted from the result.
 * @method
 * @param {Object} item - Raw DICOM JSON object as returned by a DICOMweb QIDO response.
 * @returns {Object} Plain JavaScript object with camelCase properties.
 * @example
 * const studies = await res.json();
 * const mapped = studies.map(mapDicomItem);
 */
export function mapDicomItem(item) {
  const result = {};
  for (const { tag, propName, vr } of FIELD_DESCRIPTORS) {
    if (!(tag in item)) {
      continue;
    }
    if (vr === 'SQ') {
      result[propName] = (item[tag]?.Value ?? []).map(mapDicomItem);
    } else if (vr === 'PN') {
      result[propName] = dicomPersonName(item, tag);
    } else if (vr === 'DA') {
      result[propName] = formatDicomDate(dicomVal(item, tag));
    } else if (vr === 'TM') {
      result[propName] = formatDicomTime(dicomVal(item, tag));
    } else {
      result[propName] = dicomVal(item, tag);
    }
  }

  return result;
}
