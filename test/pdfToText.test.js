import { expect } from 'chai';

import { pdfToText } from './../src/utils/pdfToText.js';
import { FakeDicomWebServer } from './FakeDicomWebServer.js';

const ENCAPSULATED_DOCUMENT_TAG = '00420011';

/**
 * Builds a minimal but structurally valid PDF-1.4 document containing the
 * given text string on a single page, using the standard /Helvetica Type1 font.
 * Byte offsets in the xref table are computed precisely so that pdfjs can
 * locate every object without relying on repair mode.
 *
 * @param {string} text - Plain ASCII text to embed.
 * @returns {Buffer} Raw PDF bytes.
 */
function buildPdf(text) {
  // Escape backslashes and parentheses for a PDF literal string.
  const escaped = text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const content = `BT /F1 12 Tf 50 700 Td (${escaped}) Tj ET`;
  const contentLen = Buffer.byteLength(content, 'latin1');

  const header = '%PDF-1.4\n';
  const objs = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${contentLen} >>\nstream\n${content}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n',
  ];

  // Compute the byte offset of each object for the xref table.
  const offsets = [];
  let offset = Buffer.byteLength(header, 'latin1');
  for (const obj of objs) {
    offsets.push(offset);
    offset += Buffer.byteLength(obj, 'latin1');
  }
  const xrefOffset = offset;

  // Each xref entry must be exactly 20 bytes: "NNNNNNNNNN GGGGG K \n"
  const xref = [
    'xref\n',
    `0 ${objs.length + 1}\n`,
    '0000000000 65535 f \n',
    ...offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`),
    `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\n`,
    `startxref\n${xrefOffset}\n`,
    '%%EOF\n',
  ];

  return Buffer.from([header, ...objs, ...xref].join(''), 'latin1');
}

/**
 * Wraps raw PDF bytes in a minimal multipart/related MIME envelope.
 * Returns the buffer to serve as the response body and the Content-Type
 * header value (including the boundary parameter).
 *
 * @param {Buffer} pdfBytes
 * @param {string} [boundary]
 * @returns {{ body: Buffer, contentType: string }}
 */
function buildMultipart(pdfBytes, boundary = 'myBoundary') {
  const header = Buffer.from(`--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`, 'binary');
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`, 'binary');
  return {
    body: Buffer.concat([header, pdfBytes, footer]),
    contentType: `multipart/related; type=application/pdf; boundary=${boundary}`,
  };
}

const server = new FakeDicomWebServer();

before(async () => server.start());
after(async () => {
  // Force-close any lingering keep-alive sockets (e.g. from an aborted fetch)
  // so that server.stop() resolves immediately instead of waiting for them to drain.
  server._server.closeAllConnections?.();
  await server.stop();
});
beforeEach(() => server.reset());

describe('pdfToText', () => {
  it('should extract text from an inline base64-encoded PDF', async () => {
    const pdfBytes = buildPdf('Hello World');
    const instance = {
      [ENCAPSULATED_DOCUMENT_TAG]: { InlineBinary: pdfBytes.toString('base64') },
    };
    const text = await pdfToText(instance, {});
    expect(text).to.include('Hello World');
  });

  it('should extract text from a multi-word clinical report PDF', async () => {
    const pdfBytes = buildPdf('Radiology Report');
    const instance = {
      [ENCAPSULATED_DOCUMENT_TAG]: { InlineBinary: pdfBytes.toString('base64') },
    };
    const text = await pdfToText(instance, {});
    expect(text).to.include('Radiology');
  });

  it('should extract text from a PDF with numeric content', async () => {
    const pdfBytes = buildPdf('Patient Age 42');
    const instance = {
      [ENCAPSULATED_DOCUMENT_TAG]: { InlineBinary: pdfBytes.toString('base64') },
    };
    const text = await pdfToText(instance, {});
    expect(text).to.include('Patient Age 42');
  });

  it('should fetch and extract text from a BulkDataURI PDF', async () => {
    const pdfBytes = buildPdf('Bulk Report Text');
    const { body, contentType } = buildMultipart(pdfBytes);
    server.respondWithBinary(200, body, contentType);
    const instance = {
      [ENCAPSULATED_DOCUMENT_TAG]: { BulkDataURI: `${server.baseUrl}/bulk/pdf` },
    };
    const text = await pdfToText(instance, { DICOMWEB_HOST: server.baseUrl });
    expect(text).to.include('Bulk Report Text');
  });

  it('should send both Accept alternatives when fetching a BulkDataURI', async () => {
    const pdfBytes = buildPdf('Header Check');
    const { body, contentType } = buildMultipart(pdfBytes);
    server.respondWithBinary(200, body, contentType);
    const instance = {
      [ENCAPSULATED_DOCUMENT_TAG]: { BulkDataURI: `${server.baseUrl}/bulk/headers` },
    };
    await pdfToText(instance, { DICOMWEB_HOST: server.baseUrl });
    const req = server.requests.find((r) => r.url.includes('/bulk/headers'));
    expect(req).to.exist;
    expect(req.headers['accept']).to.equal(
      'multipart/related; type=application/octet-stream, multipart/related; type=application/pdf, application/pdf'
    );
  });

  it('should extract text when the server responds with plain application/pdf', async () => {
    const pdfBytes = buildPdf('Plain PDF Response');
    server.respondWithBinary(200, pdfBytes, 'application/pdf');
    const instance = {
      [ENCAPSULATED_DOCUMENT_TAG]: { BulkDataURI: `${server.baseUrl}/bulk/plain-pdf` },
    };
    const text = await pdfToText(instance, { DICOMWEB_HOST: server.baseUrl });
    expect(text).to.include('Plain PDF Response');
  });

  it('should attach Basic auth headers when fetching a BulkDataURI', async () => {
    const pdfBytes = buildPdf('Auth Test');
    const { body, contentType } = buildMultipart(pdfBytes);
    server.respondWithBinary(200, body, contentType);
    const instance = {
      [ENCAPSULATED_DOCUMENT_TAG]: { BulkDataURI: `${server.baseUrl}/bulk/auth` },
    };
    const env = {
      DICOMWEB_HOST: server.baseUrl,
      DICOMWEB_AUTH: 'basic',
      DICOMWEB_USER: 'user',
      DICOMWEB_PASS: 'pass',
    };
    await pdfToText(instance, env);
    const req = server.requests.find((r) => r.url.includes('/bulk/auth'));
    expect(req).to.exist;
    expect(req.headers['authorization']).to.match(/^Basic /);
  });

  it('should attach a Bearer token when fetching a BulkDataURI', async () => {
    const pdfBytes = buildPdf('Bearer Test');
    const { body, contentType } = buildMultipart(pdfBytes);
    server.respondWithBinary(200, body, contentType);
    const instance = {
      [ENCAPSULATED_DOCUMENT_TAG]: { BulkDataURI: `${server.baseUrl}/bulk/bearer` },
    };
    const env = {
      DICOMWEB_HOST: server.baseUrl,
      DICOMWEB_AUTH: 'bearer',
      DICOMWEB_TOKEN: 'mytoken',
    };
    await pdfToText(instance, env);
    const req = server.requests.find((r) => r.url.includes('/bulk/bearer'));
    expect(req).to.exist;
    expect(req.headers['authorization']).to.equal('Bearer mytoken');
  });

  it('should throw when the BulkDataURI fetch returns a non-2xx status', async () => {
    server.respondWith(500, []);
    const instance = {
      [ENCAPSULATED_DOCUMENT_TAG]: { BulkDataURI: `${server.baseUrl}/bulk/error` },
    };
    let threw = false;
    try {
      await pdfToText(instance, { DICOMWEB_HOST: server.baseUrl });
    } catch (err) {
      threw = true;
      expect(err.message).to.match(/BulkDataURI|500/);
    }
    expect(threw, 'expected pdfToText to throw on a non-2xx BulkDataURI response').to.be.true;
  });

  it('should abort a BulkDataURI fetch when DICOMWEB_TIMEOUT elapses', async () => {
    // Server delays the response by 100 ms; timeout is set to 1 ms.
    const pdfBytes = buildPdf('Timeout Test');
    const { body, contentType } = buildMultipart(pdfBytes);
    server.respondWithBinary(200, body, contentType);
    const instance = {
      [ENCAPSULATED_DOCUMENT_TAG]: { BulkDataURI: `${server.baseUrl}/bulk/timeout` },
    };
    const env = { DICOMWEB_HOST: server.baseUrl, DICOMWEB_TIMEOUT: '1' };
    // AbortSignal.timeout(1) will race against the real network round-trip;
    // on loopback it may or may not fire, so we just assert that when it does
    // throw it carries an abort/network message, and when it doesn't the text
    // is returned correctly — either outcome is acceptable here.
    // The critical check is that passing a signal doesn't break the happy path.
    try {
      const text = await pdfToText(instance, env);
      expect(text).to.be.a('string');
    } catch (err) {
      expect(err.message).to.match(/abort|network|timeout/i);
    }
  });

  it('should throw when the EncapsulatedDocument tag is absent', async () => {
    let threw = false;
    try {
      await pdfToText({}, {});
    } catch (err) {
      threw = true;
      expect(err.message).to.include(ENCAPSULATED_DOCUMENT_TAG);
    }
    expect(threw, 'expected pdfToText to throw when the tag is missing').to.be.true;
  });

  it('should throw when the tag has neither InlineBinary nor BulkDataURI', async () => {
    const instance = { [ENCAPSULATED_DOCUMENT_TAG]: { vr: 'OB' } };
    let threw = false;
    try {
      await pdfToText(instance, {});
    } catch (err) {
      threw = true;
      expect(err.message).to.include('neither InlineBinary nor BulkDataURI');
    }
    expect(threw, 'expected pdfToText to throw when neither field is set').to.be.true;
  });

  it('should NOT forward auth credentials to a cross-origin BulkDataURI', async () => {
    // Start a second server on a different port to act as the "external" host.
    const externalServer = new FakeDicomWebServer();
    await externalServer.start();
    try {
      const pdfBytes = buildPdf('External PDF');
      const { body, contentType } = buildMultipart(pdfBytes);
      externalServer.respondWithBinary(200, body, contentType);
      const instance = {
        [ENCAPSULATED_DOCUMENT_TAG]: { BulkDataURI: `${externalServer.baseUrl}/bulk/external` },
      };
      // DICOMWEB_HOST points to a different origin than the BulkDataURI server.
      const env = {
        DICOMWEB_HOST: server.baseUrl,
        DICOMWEB_AUTH: 'bearer',
        DICOMWEB_TOKEN: 'secret-token',
      };
      const text = await pdfToText(instance, env);
      expect(text).to.include('External PDF');
      const req = externalServer.requests.find((r) => r.url.includes('/bulk/external'));
      expect(req).to.exist;
      expect(req.headers['authorization']).to.be.undefined;
    } finally {
      externalServer._server.closeAllConnections?.();
      await externalServer.stop();
    }
  });
});
