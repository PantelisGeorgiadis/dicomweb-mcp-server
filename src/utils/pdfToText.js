import { createRequire } from 'module';
import { PDFParse } from 'pdf-parse';
import { GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { pathToFileURL } from 'url';

import { parseBoundary, parseMultipart } from './multipart.js';
import { buildAuthHeaders, buildSignal, makeQuery } from './query.js';
import { isSameOrigin, scrubUrl } from './url.js';

// DICOM tag (0042,0011) — Encapsulated Document (OB), stores the raw PDF bytes.
const ENCAPSULATED_DOCUMENT_TAG = '00420011';

// pdfjs-dist uses a relative import("./pdf.worker.mjs") to load its worker.
// After bundling that resolves against the bundle file, not node_modules.
// We override workerSrc with an absolute file:// URL so pdfjs-dist always finds
// the worker regardless of where the bundle lives.
//
// __non_webpack_require__ is webpack's escape hatch to the real Node.js require;
// its .resolve() returns a filesystem path. createRequire() is the source/test fallback
// (webpack intercepts createRequire().resolve() and returns a numeric module ID).
/* global __non_webpack_require__ */
const _nativeRequire =
  typeof __non_webpack_require__ === 'function'
    ? __non_webpack_require__
    : createRequire(import.meta.url);
GlobalWorkerOptions.workerSrc = pathToFileURL(
  _nativeRequire.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')
).href;

/**
 * Resolves the raw PDF bytes from a DICOM JSON instance.
 *
 * The EncapsulatedDocument tag (0042,0011) carries binary data in one of two ways:
 *   - `InlineBinary`: base64-encoded string embedded directly in the metadata JSON.
 *   - `BulkDataURI`: a URL that must be fetched separately to retrieve the bytes.
 *
 * @param {Object} pdfInstance - A single DICOM JSON instance object (metadata format).
 * @param {Object} [env=process.env] - Environment variable map used to build auth headers
 *   when a BulkDataURI fetch is required.
 * @returns {Promise<Buffer>} The raw PDF bytes.
 * @throws {Error} If the EncapsulatedDocument tag is absent or neither InlineBinary
 *   nor BulkDataURI is present.
 */
async function resolvePdfBytes(pdfInstance, env) {
  const tag = pdfInstance[ENCAPSULATED_DOCUMENT_TAG];
  if (!tag) {
    throw new Error(
      `DICOM instance is missing the EncapsulatedDocument tag (${ENCAPSULATED_DOCUMENT_TAG})`
    );
  }

  if (tag.InlineBinary) {
    return Buffer.from(tag.InlineBinary, 'base64');
  }

  if (tag.BulkDataURI) {
    // Only forward auth credentials to the same origin as DICOMWEB_HOST.
    // A BulkDataURI may legitimately point to separate storage (e.g. a pre-signed
    // cloud storage URL); sending credentials there would leak them to an unintended server.
    const sameOrigin = isSameOrigin(tag.BulkDataURI, env.DICOMWEB_HOST);
    const res = await makeQuery(tag.BulkDataURI, {
      headers: {
        ...(sameOrigin ? buildAuthHeaders(env) : {}),
        Accept:
          'multipart/related; type=application/octet-stream, multipart/related; type=application/pdf, application/pdf',
      },
      signal: buildSignal(env),
    });
    if (!res.ok) {
      throw new Error(
        `Failed to fetch BulkDataURI for EncapsulatedDocument: HTTP ${res.status} [uri: ${scrubUrl(tag.BulkDataURI)}]`
      );
    }

    const responseBuffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('Content-Type') ?? '';
    if (contentType.toLowerCase().startsWith('multipart/')) {
      const parts = parseMultipart(responseBuffer, parseBoundary(contentType));
      if (parts.length === 0) {
        throw new Error(
          `BulkDataURI multipart response contained no parts [uri: ${scrubUrl(tag.BulkDataURI)}]`
        );
      }
      return parts[0].data;
    }

    return responseBuffer;
  }

  throw new Error(
    `EncapsulatedDocument tag (${ENCAPSULATED_DOCUMENT_TAG}) has neither InlineBinary nor BulkDataURI`
  );
}

/**
 * Converts an Encapsulated PDF DICOM instance (DICOM JSON format, as returned
 * by a DICOMweb metadata endpoint) into a human-readable text string.
 * @method
 * @param {Object} pdfInstance - A single DICOM JSON instance object.
 * @param {Object} [env=process.env] - Environment variable map. Must contain
 * `DICOMWEB_HOST` and optionally `DICOMWEB_AUTH` (`basic` or `bearer`),
 * `DICOMWEB_USER`, `DICOMWEB_PASS`, `DICOMWEB_TOKEN` and `DICOMWEB_TIMEOUT`.
 * @returns {Promise<string>} The encapsulated PDF content as plain text.
 * @throws {Error} If the EncapsulatedDocument tag is missing or the PDF cannot be parsed.
 */
export async function pdfToText(pdfInstance, env = process.env) {
  const pdfBytes = await resolvePdfBytes(pdfInstance, env);
  const parser = new PDFParse({ data: pdfBytes });
  const result = await parser.getText();

  return result.text;
}
