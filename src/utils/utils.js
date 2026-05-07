import { parseDA } from './parseDA.js';
import { parseTM } from './parseTM.js';

/**
 * Returns the values of a DICOM tag from a raw DICOM JSON object, joined by `'/'`.
 * @method
 * @param {Object} item - Raw DICOM JSON object.
 * @param {string} tag  - 8-character uppercase hex tag.
 * @returns {string} Tag values joined by `'/'`, or an empty string if absent.
 */
export function dicomVal(item, tag) {
  return (item[tag]?.Value ?? []).join('/');
}

/**
 * Returns the Alphabetic component of a Person Name (PN) DICOM value.
 * @method
 * @private
 * @param {Object} item - Raw DICOM JSON object.
 * @param {string} tag  - 8-character uppercase hex tag.
 * @returns {string} Alphabetic person name or empty string.
 */
export function dicomPersonName(item, tag) {
  return item[tag]?.Value?.[0]?.Alphabetic ?? '';
}

/**
 * Formats a DICOM date string (`YYYYMMDD`) as an ISO 8601 date string (`YYYY-MM-DD`).
 * @method
 * @param {string} dicomDate - DICOM date string in `YYYYMMDD` format.
 * @returns {string|null} Formatted date string, or `null` if the input is empty or invalid.
 */
export function formatDicomDate(dicomDate) {
  if (!dicomDate) {
    return null;
  }
  const parsed = parseDA(dicomDate, false);
  if (!parsed) {
    return null;
  }
  const { year, month, day } = parsed;

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Formats a DICOM time string (`HHMMSS`) as an ISO 8601 time string (`HH:MM:SS`).
 * @method
 * @param {string} dicomTime - DICOM time string in `HHMMSS` or `HHMMSS.ffffff` format.
 * @returns {string|null} Formatted time string, or `null` if the input is empty or invalid.
 */
export function formatDicomTime(dicomTime) {
  if (!dicomTime) {
    return null;
  }
  const parsed = parseTM(dicomTime, false);
  if (!parsed) {
    return null;
  }
  const { hours = 0, minutes = 0, seconds = 0 } = parsed;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Formats a DICOM date and time into an ISO 8601 datetime string (`YYYY-MM-DDTHH:mm:ss`).
 * @method
 * @param {string} dicomDate - DICOM date string in `YYYYMMDD` format.
 * @param {string} dicomTime - DICOM time string in `HHMMSS` or `HHMMSS.ffffff` format.
 * @returns {string|null} Formatted datetime string, or `null` if the date is empty or invalid.
 */
export function formatDicomDateTime(dicomDate, dicomTime) {
  const date = formatDicomDate(dicomDate);
  if (!date) {
    return null;
  }
  if (!dicomTime) {
    return date;
  }
  const parsed = parseTM(dicomTime, false);
  if (!parsed) {
    return date;
  }
  const { hours = 0, minutes = 0, seconds = 0 } = parsed;

  return `${date}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
