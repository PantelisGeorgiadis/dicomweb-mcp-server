/**
 * Parses a DICOM time string (`HHMMSS` or `HHMMSS.ffffff`) into its time components.
 * @method
 * @param {string} time - DICOM time string. Must be at least 2 characters (`HH`).
 *  Minutes (`MM`), seconds (`SS`), and fractional seconds (`.ffffff`) are optional trailing components.
 * @param {boolean} validate - When `true`, throws if the time string is absent, too short,
 * or contains out-of-range values.
 * @returns {{ hours: number, minutes: number|undefined, seconds: number|undefined, fractionalSeconds: number|undefined }|undefined}
 * Parsed time components, or `undefined` if the string is shorter than 2 characters
 * and `validate` is `false`.
 * @throws {string} If `validate` is `true` and the time string is absent, too short,
 * or contains invalid values.
 */
export function parseTM(time, validate) {
  if (time?.length >= 2) {
    // must at least have HH
    // 0123456789
    // HHMMSS.FFFFFF
    const hh = parseInt(time.substring(0, 2), 10);
    const mm = time.length >= 4 ? parseInt(time.substring(2, 4), 10) : undefined;
    const ss = time.length >= 6 ? parseInt(time.substring(4, 6), 10) : undefined;

    const fractionalStr = time.length >= 8 ? time.substring(7, 13) : undefined;
    const ffffff = fractionalStr
      ? parseInt(fractionalStr, 10) * Math.pow(10, 6 - fractionalStr.length)
      : undefined;

    if (validate) {
      if (
        isNaN(hh) ||
        (mm !== undefined && isNaN(mm)) ||
        (ss !== undefined && isNaN(ss)) ||
        (ffffff !== undefined && isNaN(ffffff)) ||
        hh < 0 ||
        hh > 23 ||
        (mm !== undefined && (mm < 0 || mm > 59)) ||
        (ss !== undefined && (ss < 0 || ss > 59)) ||
        (ffffff !== undefined && (ffffff < 0 || ffffff > 999999))
      ) {
        throw new Error(`invalid TM '${time}'`);
      }
    }

    return {
      hours: hh,
      minutes: mm,
      seconds: ss,
      fractionalSeconds: ffffff,
    };
  }

  if (validate) {
    throw new Error(`invalid TM '${time}'`);
  }

  return undefined;
}
