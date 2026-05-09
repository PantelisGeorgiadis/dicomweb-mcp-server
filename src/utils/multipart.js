/**
 * Minimal MIME multipart/related parser for DICOMweb bulk-data responses.
 *
 * Each parsed part is an object with:
 *   - `headers` {Object<string,string>} — lower-cased header names to values
 *   - `data`    {Buffer}               — raw body bytes of the part
 */

/**
 * Extracts the `boundary` parameter from a Content-Type header value such as
 * `multipart/related; type=application/pdf; boundary=abc123`.
 *
 * @param {string} contentType
 * @returns {string} The boundary token (quotes stripped).
 * @throws {Error} If no boundary parameter is present.
 */
export function parseBoundary(contentType) {
  const match = contentType.match(/boundary=(?:"([^"]*)"|([^\s;]+))/i);
  if (!match) {
    throw new Error(`No boundary parameter in Content-Type: ${contentType}`);
  }
  return match[1] ?? match[2];
}

/**
 * Parses all parts from a multipart MIME body.
 *
 * Requires CRLF (`\r\n`) line endings as mandated by RFC 2046. Part headers are
 * parsed into a plain object with lower-cased names. The body of each part is
 * returned as a raw `Buffer` (no charset conversion).
 *
 * @param {Buffer} buffer   - The full response body.
 * @param {string} boundary - The MIME boundary string (without leading `--`).
 * @returns {{ headers: Object<string,string>, data: Buffer }[]} Ordered array of parts.
 * @throws {Error} If the boundary is not found or part headers are malformed.
 */
export function parseMultipart(buffer, boundary) {
  const delimBuf = Buffer.from(`--${boundary}`, 'binary');
  const parts = [];

  // Locate the first boundary.
  let pos = buffer.indexOf(delimBuf);
  if (pos === -1) {
    throw new Error(`Multipart boundary "${boundary}" not found in response`);
  }

  while (pos !== -1) {
    pos += delimBuf.length;

    // After each boundary delimiter comes CRLF (next part) or -- (epilogue).
    // pos now sits right after --<boundary>, i.e. at the CRLF or --.
    const twoBytes = buffer.subarray(pos, pos + 2).toString('binary');
    if (twoBytes === '--') {
      // Closing delimiter — no more parts.
      break;
    }

    // Find \r\n\r\n that terminates the part headers, starting from pos
    // (which points to the \r\n right after the boundary line).
    // This works whether there are zero headers or many: the search finds
    // the \r\n (after boundary) + \r\n (blank line) pair when headers are
    // absent, or the final \r\n\r\n when headers are present.
    const headerSectionEnd = buffer.indexOf(Buffer.from('\r\n\r\n', 'binary'), pos);
    if (headerSectionEnd === -1) {
      throw new Error('Multipart part headers are not properly terminated');
    }

    // Raw headers text sits between the opening \r\n (pos+2) and headerSectionEnd.
    const rawHeaders = buffer.subarray(pos + 2, headerSectionEnd).toString('binary');
    const headers = Object.create(null);
    for (const line of rawHeaders.split('\r\n')) {
      const colon = line.indexOf(':');
      if (colon === -1) continue;
      headers[line.slice(0, colon).trim().toLowerCase()] = line.slice(colon + 1).trim();
    }
    pos = headerSectionEnd + 4; // skip \r\n\r\n

    // Part body ends at \r\n--<boundary>.
    const endMarker = Buffer.from(`\r\n--${boundary}`, 'binary');
    const bodyEnd = buffer.indexOf(endMarker, pos);
    const data = bodyEnd === -1 ? buffer.subarray(pos) : buffer.subarray(pos, bodyEnd);

    parts.push({ headers, data });

    // Advance to the next boundary.
    pos = bodyEnd === -1 ? -1 : bodyEnd + 2; // +2 to land on '--<boundary>'
  }

  return parts;
}
