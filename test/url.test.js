import { expect } from 'chai';

import { scrubUrl, urlJoin } from './../src/utils/url.js';

describe('urlJoin', () => {
  it('should join two simple segments', () => {
    expect(urlJoin('https://host', 'path')).to.equal('https://host/path');
  });

  it('should join three segments', () => {
    expect(urlJoin('https://host', 'studies', '1.2.3')).to.equal('https://host/studies/1.2.3');
  });

  it('should accept a single array of segments', () => {
    expect(urlJoin(['https://host', 'studies', '1.2.3'])).to.equal('https://host/studies/1.2.3');
  });

  it('should collapse a trailing slash on the host with a leading slash on the next segment', () => {
    expect(urlJoin('https://host/', '/path')).to.equal('https://host/path');
  });

  it('should collapse multiple slashes between segments', () => {
    expect(urlJoin('https://host///', '///path')).to.equal('https://host/path');
  });

  it('should preserve a single trailing slash on the last segment', () => {
    expect(urlJoin('https://host', 'path/')).to.equal('https://host/path/');
  });

  it('should collapse multiple trailing slashes on the last segment to one', () => {
    expect(urlJoin('https://host', 'path///')).to.equal('https://host/path/');
  });

  it('should normalise extra slashes after the protocol', () => {
    expect(urlJoin('https:///host', 'path')).to.equal('https://host/path');
  });

  it('should keep three slashes for file:// protocol', () => {
    expect(urlJoin('file:///home', 'user')).to.equal('file:///home/user');
  });

  it('should join a plain protocol token with the next segment', () => {
    expect(urlJoin('https:', '//host', 'path')).to.equal('https://host/path');
  });

  it('should preserve a query string on the last segment', () => {
    expect(urlJoin('https://host', 'studies?PatientName=Smith')).to.equal(
      'https://host/studies?PatientName=Smith'
    );
  });

  it('should not add a slash before a query string', () => {
    expect(urlJoin('https://host/studies', '?limit=10')).to.equal('https://host/studies?limit=10');
  });

  it('should merge multiple query params within one segment with &', () => {
    expect(urlJoin('https://host/studies?PatientName=Smith&limit=10')).to.equal(
      'https://host/studies?PatientName=Smith&limit=10'
    );
  });

  it('should preserve a hash fragment', () => {
    expect(urlJoin('https://host', 'path#section')).to.equal('https://host/path#section');
  });

  it('should not add a slash before a hash fragment', () => {
    expect(urlJoin('https://host/path', '#section')).to.equal('https://host/path#section');
  });

  it('should handle a leading slash as the first segment', () => {
    expect(urlJoin('/', 'studies', '1.2.3')).to.equal('/studies/1.2.3');
  });

  it('should return an empty string for an empty array', () => {
    expect(urlJoin([])).to.equal('');
  });

  it('should filter out empty-string segments', () => {
    expect(urlJoin('https://host', '', 'path')).to.equal('https://host/path');
  });

  it('should throw TypeError when a segment is not a string', () => {
    expect(() => urlJoin('https://host', 42)).to.throw(TypeError, /Url must be a string/);
  });
});

describe('scrubUrl', () => {
  it('should return origin + pathname for a URL with no query string', () => {
    expect(scrubUrl('https://host/studies/1.2.3/series/4.5.6')).to.equal(
      'https://host/studies/1.2.3/series/4.5.6'
    );
  });

  it('should replace a query string with ?[params redacted]', () => {
    expect(scrubUrl('https://host/studies?PatientName=Smith&limit=10')).to.equal(
      'https://host/studies?[params redacted]'
    );
  });

  it('should strip a hash fragment and leave no query marker', () => {
    expect(scrubUrl('https://host/studies#section')).to.equal('https://host/studies');
  });

  it('should strip both a query string and a hash fragment', () => {
    expect(scrubUrl('https://host/studies?q=1#section')).to.equal(
      'https://host/studies?[params redacted]'
    );
  });

  it('should preserve the port in the origin', () => {
    expect(scrubUrl('http://host:8080/wado?foo=bar')).to.equal(
      'http://host:8080/wado?[params redacted]'
    );
  });

  it('should return <invalid url> for a non-URL string', () => {
    expect(scrubUrl('not a url')).to.equal('<invalid url>');
  });

  it('should return <invalid url> for an empty string', () => {
    expect(scrubUrl('')).to.equal('<invalid url>');
  });
});
