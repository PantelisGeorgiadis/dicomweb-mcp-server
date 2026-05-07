import http from 'http';

/**
 * Minimal HTTP server that records incoming requests and returns a
 * configurable DICOM JSON response. Binds to an OS-assigned port (0).
 */
export class FakeDicomWebServer {
  constructor() {
    this._responseStatus = 200;
    this._responseBody = [];
    this._binaryResponse = null;
    this._routes = [];
    this.requests = [];

    this._server = http.createServer((req, res) => {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        this.requests.push({
          url: req.url,
          method: req.method,
          headers: req.headers,
          body: Buffer.concat(chunks).toString(),
        });
        const path = req.url.split('?')[0];
        const route = this._routes.find((r) => r.pattern.test(path));
        if (this._binaryResponse && !route) {
          const { status, buffer, contentType } = this._binaryResponse;
          res.writeHead(status, {
            'Content-Type': contentType,
            'Content-Length': buffer.length,
          });
          res.end(buffer);
          return;
        }
        const status = route ? route.status : this._responseStatus;
        const body = route ? route.body : this._responseBody;
        const payload = JSON.stringify(body);
        res.writeHead(status, {
          'Content-Type': 'application/dicom+json',
          'Content-Length': Buffer.byteLength(payload),
        });
        res.end(payload);
      });
    });
  }

  start() {
    return new Promise((resolve) => {
      this._server.listen(0, '127.0.0.1', () => resolve());
    });
  }

  stop() {
    return new Promise((resolve, reject) => {
      this._server.close((err) => (err ? reject(err) : resolve()));
    });
  }

  get baseUrl() {
    const { address, port } = this._server.address();
    return `http://${address}:${port}`;
  }

  respondWith(status, body = []) {
    this._responseStatus = status;
    this._responseBody = body;
  }

  /**
   * Registers a per-URL route that takes priority over the default response.
   * @param {RegExp} pattern - Regular expression matched against the request path (without query string).
   * @param {*} body - Response body; will be JSON-serialised.
   * @param {number} [status=200] - HTTP status code for this route.
   */
  on(pattern, body, status = 200) {
    this._routes.push({ pattern, body, status });
  }

  /**
   * Configures the server to respond with raw binary data.
   * @param {number} status      - HTTP status code.
   * @param {Buffer} buffer      - Raw binary payload.
   * @param {string} contentType - MIME type for the response (e.g. `'image/jpeg'`).
   */
  respondWithBinary(status, buffer, contentType = 'image/jpeg') {
    this._binaryResponse = { status, buffer, contentType };
  }

  reset() {
    this.requests = [];
    this._responseStatus = 200;
    this._responseBody = [];
    this._binaryResponse = null;
    this._routes = [];
  }
}
