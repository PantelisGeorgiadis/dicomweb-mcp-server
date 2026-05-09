// Taken from https://github.com/jfromaniello/url-join/blob/main/lib/url-join.js

/**
 * Normalises an array of URL parts into a single well-formed URL string.
 *
 * Handles protocol prefixes, leading/trailing slashes, IPv6 hosts, `file://`
 * URLs, query-string separators, and hash fragments.
 * @method
 * @private
 * @param {string[]} strArray - Array of URL path components.
 * @returns {string} Normalised URL string, or `''` if the array is empty.
 * @throws {TypeError} If any element in the array is not a string.
 */
function normalize(strArray) {
  const resultArray = [];
  if (strArray.length === 0) {
    return '';
  }

  // Filter out any empty string values.
  strArray = strArray.filter((part) => part !== '');

  if (typeof strArray[0] !== 'string') {
    throw new TypeError('Url must be a string. Received ' + strArray[0]);
  }

  // If the first part is a plain protocol, we combine it with the next part.
  if (strArray[0].match(/^[^/:]+:\/*$/) && strArray.length > 1) {
    strArray[0] = strArray.shift() + strArray[0];
  }

  // If the first part is a leading slash, we combine it with the next part.
  if (strArray[0] === '/' && strArray.length > 1) {
    strArray[0] = strArray.shift() + strArray[0];
  }

  // There must be two or three slashes in the file protocol, two slashes in anything else.
  if (strArray[0].match(/^file:\/\/\//)) {
    strArray[0] = strArray[0].replace(/^([^/:]+):\/*/, '$1:///');
  } else if (!strArray[0].match(/^\[.*:.*\]/)) {
    // If the first part is not an IPv6 host, we replace the protocol.
    strArray[0] = strArray[0].replace(/^([^/:]+):\/*/, '$1://');
  }

  for (let i = 0; i < strArray.length; i++) {
    let component = strArray[i];

    if (typeof component !== 'string') {
      throw new TypeError('Url must be a string. Received ' + component);
    }

    if (i > 0) {
      // Removing the starting slashes for each component but the first.
      component = component.replace(/^[/]+/, '');
    }
    if (i < strArray.length - 1) {
      // Removing the ending slashes for each component but the last.
      component = component.replace(/[/]+$/, '');
    } else {
      // For the last component we will combine multiple slashes to a single one.
      component = component.replace(/[/]+$/, '/');
    }

    if (component === '') {
      continue;
    }

    resultArray.push(component);
  }

  let str = '';

  for (let i = 0; i < resultArray.length; i++) {
    const part = resultArray[i];

    // Do not add a slash if this is the first part.
    if (i === 0) {
      str += part;
      continue;
    }

    const prevPart = resultArray[i - 1];

    // Do not add a slash if the previous part ends with start of the query param or hash.
    if ((prevPart && prevPart.endsWith('?')) || prevPart.endsWith('#')) {
      str += part;
      continue;
    }

    str += '/' + part;
  }

  // Each input component is now separated by a single slash except the possible first plain protocol part.
  // remove trailing slash before parameters or hash
  str = str.replace(/\/(\?|&|#[^!])/g, '$1');

  // replace ? and & in parameters with &
  const [beforeHash, afterHash] = str.split('#');
  const parts = beforeHash.split(/(?:\?|&)+/).filter(Boolean);
  str =
    parts.shift() +
    (parts.length > 0 ? '?' : '') +
    parts.join('&') +
    (afterHash && afterHash.length > 0 ? '#' + afterHash : '');

  return str;
}

/**
 * Joins any number of URL segments into a single normalised URL string.
 *
 * Accepts either a variable number of string arguments or a single array of
 * strings. Redundant slashes between segments are collapsed, protocol prefixes
 * are preserved, and query-string / hash characters are handled correctly.
 * @method
 * @param {...string|string[]} args - URL segments to join, or a single array of segments.
 * @returns {string} Joined and normalised URL string.
 * @example
 * urlJoin('https://host', 'studies', '1.2.3');   // 'https://host/studies/1.2.3'
 * urlJoin('https://host/', '/series/', '/1.2.3'); // 'https://host/series/1.2.3'
 */
export function urlJoin(...args) {
  const parts = Array.from(Array.isArray(args[0]) ? args[0] : args);
  return normalize(parts);
}

/**
 * Returns the origin + pathname of a URL, stripping query parameters and fragments
 * to avoid leaking PII (e.g. patient name filters) in error messages.
 * @method
 * @param {string} url - Full URL string.
 * @returns {string} URL with query params replaced by `?[params redacted]`, or `'<invalid url>'` if unparseable.
 */
export function scrubUrl(url) {
  try {
    const { origin, pathname, search } = new URL(url);
    return `${origin}${pathname}${search ? '?[params redacted]' : ''}`;
  } catch {
    return '<invalid url>';
  }
}

/**
 * Returns `true` when both URLs parse successfully and share the same origin
 * (scheme + host + port). Returns `false` if either URL is falsy or unparseable.
 * @method
 * @param {string} urlA - First URL to compare.
 * @param {string} urlB - Second URL to compare.
 * @returns {boolean} Whether the two URLs have the same origin.
 */
export function isSameOrigin(urlA, urlB) {
  if (!urlA || !urlB) {
    return false;
  }

  try {
    return new URL(urlA).origin === new URL(urlB).origin;
  } catch {
    return false;
  }
}
