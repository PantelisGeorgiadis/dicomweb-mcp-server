import { expect } from 'chai';

import { parseBoundary, parseMultipart } from './../src/utils/multipart.js';

/**
 * Builds a multipart/related body buffer from an array of parts.
 * Each part is { headers: Object<string,string>, data: Buffer }.
 */
function buildMultipartBody(parts, boundary) {
  const chunks = [];
  for (const part of parts) {
    chunks.push(Buffer.from(`--${boundary}\r\n`, 'binary'));
    for (const [name, value] of Object.entries(part.headers)) {
      chunks.push(Buffer.from(`${name}: ${value}\r\n`, 'binary'));
    }
    chunks.push(Buffer.from('\r\n', 'binary'));
    chunks.push(part.data);
    chunks.push(Buffer.from('\r\n', 'binary'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`, 'binary'));
  return Buffer.concat(chunks);
}

describe('parseBoundary', () => {
  it('should extract an unquoted boundary', () => {
    expect(parseBoundary('multipart/related; boundary=abc123')).to.equal('abc123');
  });

  it('should extract a quoted boundary', () => {
    expect(parseBoundary('multipart/related; boundary="my boundary"')).to.equal('my boundary');
  });

  it('should be case-insensitive for the boundary parameter', () => {
    expect(parseBoundary('multipart/related; Boundary=XYZ')).to.equal('XYZ');
  });

  it('should extract boundary when other parameters are present', () => {
    expect(
      parseBoundary('multipart/related; type=application/pdf; boundary=sep; start="<root>"')
    ).to.equal('sep');
  });

  it('should throw when boundary is absent', () => {
    expect(() => parseBoundary('multipart/related; type=application/pdf')).to.throw(
      /No boundary parameter/
    );
  });
});

describe('parseMultipart', () => {
  it('should parse a single part', () => {
    const data = Buffer.from('Hello PDF', 'binary');
    const body = buildMultipartBody(
      [{ headers: { 'content-type': 'application/pdf' }, data }],
      'b1'
    );
    const parts = parseMultipart(body, 'b1');
    expect(parts).to.have.length(1);
    expect(parts[0].data.equals(data)).to.be.true;
    expect(parts[0].headers['content-type']).to.equal('application/pdf');
  });

  it('should parse multiple parts', () => {
    const data1 = Buffer.from('Part One', 'binary');
    const data2 = Buffer.from('Part Two', 'binary');
    const data3 = Buffer.from('Part Three', 'binary');
    const body = buildMultipartBody(
      [
        { headers: { 'content-type': 'application/pdf' }, data: data1 },
        { headers: { 'content-type': 'application/pdf' }, data: data2 },
        { headers: { 'content-type': 'application/pdf' }, data: data3 },
      ],
      'boundary42'
    );
    const parts = parseMultipart(body, 'boundary42');
    expect(parts).to.have.length(3);
    expect(parts[0].data.equals(data1)).to.be.true;
    expect(parts[1].data.equals(data2)).to.be.true;
    expect(parts[2].data.equals(data3)).to.be.true;
  });

  it('should parse lower-cased header names', () => {
    const body = buildMultipartBody(
      [{ headers: { 'Content-Type': 'application/octet-stream' }, data: Buffer.from('x') }],
      'bnd'
    );
    const parts = parseMultipart(body, 'bnd');
    expect(parts[0].headers['content-type']).to.equal('application/octet-stream');
  });

  it('should preserve binary part data intact', () => {
    const data = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x00, 0xff, 0xfe]); // %PDF\0\xff\xfe
    const body = buildMultipartBody([{ headers: {}, data }], 'bnd');
    const parts = parseMultipart(body, 'bnd');
    expect(parts[0].data.equals(data)).to.be.true;
  });

  it('should throw when the boundary is not found', () => {
    const body = Buffer.from('--wrongBoundary\r\n\r\ndata\r\n--wrongBoundary--\r\n', 'binary');
    expect(() => parseMultipart(body, 'otherBoundary')).to.throw(/boundary.*not found/i);
  });

  it('should return an empty array for a body with only a closing delimiter', () => {
    const body = Buffer.from('--bnd--\r\n', 'binary');
    const parts = parseMultipart(body, 'bnd');
    expect(parts).to.have.length(0);
  });
});
