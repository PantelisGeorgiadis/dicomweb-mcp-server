import { DICOM_TAG_DICTIONARY } from './dataDictionary.js';

let _lookup = null;

/**
 * Builds and caches lookup tables for the DICOM data dictionary.
 * @method
 * @private
 * @returns {Object} Lookup tables.
 * @property {Map<string, Object>} byKeyword - Entries keyed by uppercase keyword name.
 * @property {Map<string, Object>} byHex     - Entries keyed by 8-character uppercase hex tag.
 */
function getLookup() {
  if (_lookup) {
    return _lookup;
  }

  const byKeyword = new Map();
  const byHex = new Map();

  for (const [key, entry] of Object.entries(DICOM_TAG_DICTIONARY)) {
    // key is formatted as "(GGGG,EEEE)" — normalise to "GGGGEEEE"
    const hex = key.replace(/[(),]/g, '').toUpperCase();
    const info = { tag: hex, vr: entry.vr, name: entry.name };
    byHex.set(hex, info);
    if (entry.name) {
      byKeyword.set(entry.name.toUpperCase(), info);
    }
  }

  _lookup = { byKeyword, byHex };
  return _lookup;
}

/**
 * Looks up a DICOM tag entry by keyword name (case-insensitive) or by
 * 8-character hexadecimal tag string (e.g. `"00100020"`).
 * @method
 * @private
 * @param {string} tagOrKeyword - DICOM keyword name or 8-char hex tag.
 * @returns {Object|null} Tag entry, or `null` if not found.
 * @property {string} tag  - 8-character uppercase hex tag.
 * @property {string} vr   - DICOM Value Representation.
 * @property {string} name - DICOM keyword name.
 */
function lookupTag(tagOrKeyword) {
  const { byKeyword, byHex } = getLookup();
  const upper = tagOrKeyword.replace(/[(),\s]/g, '').toUpperCase();

  if (byKeyword.has(upper)) {
    return byKeyword.get(upper);
  }

  if (/^[0-9A-F]{8}$/.test(upper) && byHex.has(upper)) {
    return byHex.get(upper);
  }

  return null;
}

/**
 * Parses a freeform DICOM query string into a structured query object.
 *
 * Tokens are whitespace-separated `key=value` pairs. Single- and double-quoted
 * values are supported. Special keys (case-insensitive):
 * - `includefield=Keyword1,00100020,...`
 * - `fuzzymatching=true|false`
 * - `limit=<integer>`
 * - `offset=<integer>`
 *
 * All other keys are resolved against the DICOM data dictionary by keyword name
 * (case-insensitive) or by 8-character hex tag. Unrecognised tokens are recorded
 * in `errors` and skipped rather than throwing.
 * @method
 * @param {string} queryString - Query string, e.g. `"PatientName=Smith* StudyDate=20240101-20241231 limit=20"`.
 * @returns {Object} Structured query object.
 * @property {Map<string, Object>} queryAttributes             - DICOM attribute filters keyed by hex tag.
 * @property {string}              queryAttributes[].tag       - 8-character uppercase hex tag.
 * @property {string}              queryAttributes[].name      - DICOM keyword name.
 * @property {string}              queryAttributes[].rawKey    - Original key as supplied by the caller.
 * @property {string}              queryAttributes[].rawValue  - Original value as supplied by the caller.
 * @property {string[]}            includeFields  - List of 8-char hex tags to request via `includefield`.
 * @property {boolean}             fuzzyMatching  - Whether fuzzy matching is requested.
 * @property {number}              limit          - Maximum number of results (default: `50`).
 * @property {number}              offset         - Result offset for pagination (default: `0`).
 * @property {string[]}            errors         - Non-fatal parse warnings (unknown tags, bad integers, etc.).
 * @example
 * parseQuery('PatientName=Smith* ModalitiesInStudy=CT limit=10');
 * parseQuery('00100040=M StudyDate=20240101-20241231 fuzzymatching=true');
 */
export function parseQuery(queryString) {
  const result = {
    queryAttributes: new Map(),
    includeFields: [],
    fuzzyMatching: false,
    limit: 50,
    offset: 0,
    errors: [],
  };

  if (!queryString?.trim()) {
    return result;
  }

  // Split on whitespace, respecting single- and double-quoted values
  const tokens = queryString.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];

  for (const token of tokens) {
    const eqIdx = token.indexOf('=');
    if (eqIdx === -1) {
      result.errors.push(`Token '${token}' has no '=', skipping`);
      continue;
    }

    const rawKey = token.substring(0, eqIdx).trim();
    const rawValue = token.substring(eqIdx + 1).replace(/^['"]|['"]$/g, '');
    const keyLower = rawKey.toLowerCase();

    if (keyLower === 'includefield') {
      for (const part of rawValue.split(',')) {
        const info = lookupTag(part.trim());
        if (!info) {
          result.errors.push(
            `includefield: unknown DICOM keyword or tag '${part.trim()}', skipping`
          );
        } else {
          result.includeFields.push(info.tag);
        }
      }
    } else if (keyLower === 'fuzzymatching') {
      result.fuzzyMatching = rawValue.toLowerCase() !== 'false';
    } else if (keyLower === 'limit') {
      const n = parseInt(rawValue, 10);
      if (!isNaN(n)) {
        result.limit = n;
      } else {
        result.errors.push(`limit: '${rawValue}' is not a valid integer, skipping`);
      }
    } else if (keyLower === 'offset') {
      const n = parseInt(rawValue, 10);
      if (!isNaN(n)) {
        result.offset = n;
      } else {
        result.errors.push(`offset: '${rawValue}' is not a valid integer, skipping`);
      }
    } else {
      const info = lookupTag(rawKey);
      if (!info) {
        result.errors.push(`Unknown DICOM keyword or tag '${rawKey}', skipping`);
        continue;
      }
      // Last write wins for duplicate keys (matches DICOMweb query semantics)
      result.queryAttributes.set(info.tag, {
        tag: info.tag,
        name: info.name,
        rawKey,
        rawValue,
      });
    }
  }

  return result;
}
