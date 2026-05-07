import { expect } from 'chai';

import { searchStudies } from './../src/tools/searchStudies.js';
import { FakeDicomWebServer } from './FakeDicomWebServer.js';

function makeRawStudy(studyInstanceUid, studyDate = '20240101', patientName = 'DOE^JANE') {
  return {
    '0020000D': { vr: 'UI', Value: [studyInstanceUid] },
    '00080020': { vr: 'DA', Value: [studyDate] },
    '00100010': { vr: 'PN', Value: [{ Alphabetic: patientName }] },
  };
}

const server = new FakeDicomWebServer();

before(async () => {
  await server.start();
});

after(async () => {
  await server.stop();
});

beforeEach(() => {
  server.reset();
});

describe('searchStudies', () => {
  it('should call the QIDO /studies endpoint on DICOMWEB_HOST', async () => {
    await searchStudies('', { DICOMWEB_HOST: server.baseUrl });
    expect(server.requests).to.have.lengthOf(1);
    expect(server.requests[0].url).to.match(/^\/studies\?/);
  });

  it('should include the default limit param in the URL', async () => {
    await searchStudies('', { DICOMWEB_HOST: server.baseUrl });
    const params = new URLSearchParams(server.requests[0].url.split('?')[1]);
    expect(params.get('limit')).to.equal('50');
  });

  it('should pass a custom limit from the query string', async () => {
    await searchStudies('limit=5', { DICOMWEB_HOST: server.baseUrl });
    const params = new URLSearchParams(server.requests[0].url.split('?')[1]);
    expect(params.get('limit')).to.equal('5');
  });

  it('should not include an offset param when offset is 0', async () => {
    await searchStudies('', { DICOMWEB_HOST: server.baseUrl });
    const params = new URLSearchParams(server.requests[0].url.split('?')[1]);
    expect(params.has('offset')).to.be.false;
  });

  it('should include an offset param when offset > 0', async () => {
    await searchStudies('offset=10', { DICOMWEB_HOST: server.baseUrl });
    const params = new URLSearchParams(server.requests[0].url.split('?')[1]);
    expect(params.get('offset')).to.equal('10');
  });

  it('should include fuzzymatching=true when requested', async () => {
    await searchStudies('fuzzymatching=true', { DICOMWEB_HOST: server.baseUrl });
    const params = new URLSearchParams(server.requests[0].url.split('?')[1]);
    expect(params.get('fuzzymatching')).to.equal('true');
  });

  it('should not include a fuzzymatching param when not requested', async () => {
    await searchStudies('', { DICOMWEB_HOST: server.baseUrl });
    const params = new URLSearchParams(server.requests[0].url.split('?')[1]);
    expect(params.has('fuzzymatching')).to.be.false;
  });

  it('should map a DICOM keyword attribute to a URL param by keyword name', async () => {
    await searchStudies('PatientName=DOE*', { DICOMWEB_HOST: server.baseUrl });
    const params = new URLSearchParams(server.requests[0].url.split('?')[1]);
    expect(params.get('PatientName')).to.equal('DOE*');
  });

  it('should include includefield when specified', async () => {
    await searchStudies('includefield=ModalitiesInStudy', { DICOMWEB_HOST: server.baseUrl });
    const params = new URLSearchParams(server.requests[0].url.split('?')[1]);
    expect(params.get('includefield')).to.equal('00080061');
  });

  it('should always send Accept: application/dicom+json', async () => {
    await searchStudies('', { DICOMWEB_HOST: server.baseUrl });
    expect(server.requests[0].headers['accept']).to.equal('application/dicom+json');
  });

  it('should not include an Authorization header when DICOMWEB_AUTH is unset', async () => {
    await searchStudies('', { DICOMWEB_HOST: server.baseUrl });
    expect(server.requests[0].headers).to.not.have.property('authorization');
  });

  it('should send a Basic Authorization header when DICOMWEB_AUTH=basic', async () => {
    const env = {
      DICOMWEB_HOST: server.baseUrl,
      DICOMWEB_AUTH: 'basic',
      DICOMWEB_USER: 'user',
      DICOMWEB_PASS: 'pass',
    };
    await searchStudies('', env);
    const expected = 'Basic ' + Buffer.from('user:pass').toString('base64');
    expect(server.requests[0].headers['authorization']).to.equal(expected);
  });

  it('should send a Bearer Authorization header when DICOMWEB_AUTH=bearer', async () => {
    const env = {
      DICOMWEB_HOST: server.baseUrl,
      DICOMWEB_AUTH: 'bearer',
      DICOMWEB_TOKEN: 'my-token',
    };
    await searchStudies('', env);
    expect(server.requests[0].headers['authorization']).to.equal('Bearer my-token');
  });

  it('should return an empty array when the server returns no results', async () => {
    const results = await searchStudies('', { DICOMWEB_HOST: server.baseUrl });
    expect(results).to.be.an('array').that.is.empty;
  });

  it('should map raw DICOM JSON items to plain objects', async () => {
    server.respondWith(200, [makeRawStudy('1.2.3.4', '20240315', 'SMITH^JOHN')]);
    const results = await searchStudies('', { DICOMWEB_HOST: server.baseUrl });
    expect(results).to.have.lengthOf(1);
    expect(results[0].studyInstanceUid).to.equal('1.2.3.4');
    expect(results[0].studyDate).to.equal('2024-03-15');
    expect(results[0].patientName).to.equal('SMITH^JOHN');
  });

  it('should sort results by studyDate descending', async () => {
    server.respondWith(200, [
      makeRawStudy('1.1', '20220101'),
      makeRawStudy('1.3', '20240101'),
      makeRawStudy('1.2', '20230101'),
    ]);
    const results = await searchStudies('', { DICOMWEB_HOST: server.baseUrl });
    expect(results.map((r) => r.studyInstanceUid)).to.deep.equal(['1.3', '1.2', '1.1']);
  });

  it('should throw when the server returns a non-OK HTTP status', async () => {
    server.respondWith(500);
    let threw = false;
    try {
      await searchStudies('', { DICOMWEB_HOST: server.baseUrl });
    } catch (err) {
      threw = true;
      expect(err.message).to.match(/500/);
    }
    expect(threw, 'expected searchStudies to throw').to.be.true;
  });
});
