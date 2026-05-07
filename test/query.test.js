import { expect } from 'chai';

import { buildAuthHeaders, buildQuery } from './../src/utils/query.js';

describe('buildQuery', () => {
  it('should include the default limit param', () => {
    const { urlParams } = buildQuery('');
    expect(urlParams.get('limit')).to.equal('50');
  });

  it('should pass a custom limit from the query string', () => {
    const { urlParams } = buildQuery('limit=5');
    expect(urlParams.get('limit')).to.equal('5');
  });

  it('should not include an offset param when offset is 0', () => {
    const { urlParams } = buildQuery('');
    expect(urlParams.has('offset')).to.be.false;
  });

  it('should include an offset param when offset > 0', () => {
    const { urlParams } = buildQuery('offset=10');
    expect(urlParams.get('offset')).to.equal('10');
  });

  it('should include fuzzymatching=true when requested', () => {
    const { urlParams } = buildQuery('fuzzymatching=true');
    expect(urlParams.get('fuzzymatching')).to.equal('true');
  });

  it('should not include a fuzzymatching param when not requested', () => {
    const { urlParams } = buildQuery('');
    expect(urlParams.has('fuzzymatching')).to.be.false;
  });

  it('should map a DICOM keyword attribute to a URL param by keyword name', () => {
    const { urlParams } = buildQuery('PatientName=DOE*');
    expect(urlParams.get('PatientName')).to.equal('DOE*');
  });

  it('should map a DICOM hex tag attribute to a URL param by keyword name', () => {
    // 00100020 = PatientID
    const { urlParams } = buildQuery('00100020=12345');
    expect(urlParams.get('PatientID')).to.equal('12345');
  });

  it('should include includefield when specified by keyword', () => {
    const { urlParams } = buildQuery('includefield=ModalitiesInStudy');
    expect(urlParams.get('includefield')).to.equal('00080061');
  });

  it('should include multiple DICOM attributes in URL params', () => {
    const { urlParams } = buildQuery('PatientName=SMITH* StudyDate=20240101-20241231 limit=10');
    expect(urlParams.get('PatientName')).to.equal('SMITH*');
    expect(urlParams.get('StudyDate')).to.equal('20240101-20241231');
    expect(urlParams.get('limit')).to.equal('10');
  });

  it('should always include Accept: application/dicom+json', () => {
    const { headers } = buildQuery('');
    expect(headers['Accept']).to.equal('application/dicom+json');
  });

  it('should not include an Authorization header when DICOMWEB_AUTH is unset', () => {
    const { headers } = buildQuery('', {});
    expect(headers).to.not.have.property('Authorization');
  });

  it('should send a Basic Authorization header when DICOMWEB_AUTH=basic', () => {
    const env = { DICOMWEB_AUTH: 'basic', DICOMWEB_USER: 'user', DICOMWEB_PASS: 'pass' };
    const { headers } = buildQuery('', env);
    const expected = 'Basic ' + Buffer.from('user:pass').toString('base64');
    expect(headers['Authorization']).to.equal(expected);
  });

  it('should send a Bearer Authorization header when DICOMWEB_AUTH=bearer', () => {
    const env = { DICOMWEB_AUTH: 'bearer', DICOMWEB_TOKEN: 'my-token' };
    const { headers } = buildQuery('', env);
    expect(headers['Authorization']).to.equal('Bearer my-token');
  });

  it('should match Basic auth case-insensitively (BASIC)', () => {
    const env = { DICOMWEB_AUTH: 'BASIC', DICOMWEB_USER: 'u', DICOMWEB_PASS: 'p' };
    const { headers } = buildQuery('', env);
    expect(headers['Authorization']).to.match(/^Basic /);
  });

  it('should match Bearer auth case-insensitively (BEARER)', () => {
    const env = { DICOMWEB_AUTH: 'BEARER', DICOMWEB_TOKEN: 'tok' };
    const { headers } = buildQuery('', env);
    expect(headers['Authorization']).to.equal('Bearer tok');
  });

  it('should return an empty errors array for a valid query string', () => {
    const { errors } = buildQuery('PatientName=DOE* limit=10');
    expect(errors).to.be.an('array').that.is.empty;
  });

  it('should return errors for an unknown attribute in the query string', () => {
    const { errors } = buildQuery('UnknownTag=value');
    expect(errors).to.have.lengthOf(1);
    expect(errors[0]).to.include('UnknownTag');
  });

  it('should return an object with urlParams, headers, and errors', () => {
    const result = buildQuery('');
    expect(result).to.have.keys(['urlParams', 'headers', 'errors']);
    expect(result.urlParams).to.be.instanceOf(URLSearchParams);
    expect(result.headers).to.be.an('object');
    expect(result.errors).to.be.an('array');
  });
});

describe('buildAuthHeaders', () => {
  it('should return Accept: application/dicom+json with no auth configured', () => {
    const headers = buildAuthHeaders({});
    expect(headers['Accept']).to.equal('application/dicom+json');
    expect(headers).to.not.have.property('Authorization');
  });

  it('should return a Basic Authorization header with valid credentials', () => {
    const env = { DICOMWEB_AUTH: 'basic', DICOMWEB_USER: 'user', DICOMWEB_PASS: 'pass' };
    const headers = buildAuthHeaders(env);
    const expected = 'Basic ' + Buffer.from('user:pass').toString('base64');
    expect(headers['Authorization']).to.equal(expected);
  });

  it('should return a Bearer Authorization header with a valid token', () => {
    const env = { DICOMWEB_AUTH: 'bearer', DICOMWEB_TOKEN: 'my-token' };
    const headers = buildAuthHeaders(env);
    expect(headers['Authorization']).to.equal('Bearer my-token');
  });

  it('should throw when DICOMWEB_AUTH=basic but DICOMWEB_USER is missing', () => {
    const env = { DICOMWEB_AUTH: 'basic', DICOMWEB_PASS: 'pass' };
    expect(() => buildAuthHeaders(env)).to.throw(/DICOMWEB_USER/);
  });

  it('should throw when DICOMWEB_AUTH=basic but DICOMWEB_PASS is missing', () => {
    const env = { DICOMWEB_AUTH: 'basic', DICOMWEB_USER: 'user' };
    expect(() => buildAuthHeaders(env)).to.throw(/DICOMWEB_PASS/);
  });

  it('should throw when DICOMWEB_AUTH=bearer but DICOMWEB_TOKEN is missing', () => {
    const env = { DICOMWEB_AUTH: 'bearer' };
    expect(() => buildAuthHeaders(env)).to.throw(/DICOMWEB_TOKEN/);
  });
});
