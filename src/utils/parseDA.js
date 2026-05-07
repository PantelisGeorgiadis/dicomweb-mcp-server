/**
 * Returns the number of days in a given month of a given year.
 * @method
 * @private
 * @param {number} m - 1-based month number (1–12).
 * @param {number} y - Full four-digit year.
 * @returns {number} Number of days in the month.
 */
function daysInMonth(m, y) {
  // m is 1-based: 1-12
  switch (m) {
    case 2:
      return (y % 4 === 0 && y % 100) || y % 400 === 0 ? 29 : 28;
    case 9:
    case 4:
    case 6:
    case 11:
      return 30;
    default:
      return 31;
  }
}

/**
 * Returns whether the given day, month, and year represent a valid calendar date.
 * @method
 * @private
 * @param {number} d - Day of the month.
 * @param {number} m - Month (1–12).
 * @param {number} y - Full four-digit year.
 * @returns {boolean} `true` if the date is valid, `false` otherwise.
 */
function isValidDate(d, m, y) {
  // make year is a number
  if (isNaN(y)) {
    return false;
  }

  return m > 0 && m <= 12 && d > 0 && d <= daysInMonth(m, y);
}

/**
 * Parses a DICOM date string (`YYYYMMDD`) into its year, month, and day components.
 * @method
 * @param {string} date     - DICOM date string in `YYYYMMDD` format.
 * @param {boolean} validate - When `true`, throws if the date string is absent or invalid.
 * @returns {{ year: number, month: number, day: number }|undefined}
 *   Parsed date components, or `undefined` if the string is not exactly 8 characters
 *   and `validate` is `false`.
 * @throws {string} If `validate` is `true` and the date is absent or not a valid calendar date.
 */
export function parseDA(date, validate) {
  if (date && date.length === 8) {
    const yyyy = parseInt(date.substring(0, 4), 10);
    const mm = parseInt(date.substring(4, 6), 10);
    const dd = parseInt(date.substring(6, 8), 10);

    if (validate) {
      if (isValidDate(dd, mm, yyyy) !== true) {
        throw new Error(`invalid DA '${date}'`);
      }
    }

    return {
      year: yyyy,
      month: mm,
      day: dd,
    };
  }
  if (validate) {
    throw new Error(`invalid DA '${date}'`);
  }

  return undefined;
}
