import { expect } from 'chai';

import { searchSeries } from './../src/tools/searchSeries.js';
import { FakeDicomWebServer } from './FakeDicomWebServer.js';

const STUDY_UID = '1.2.840.113619.2.55.3.604688123.123.1591781234.467';

function makeRawSeries(seriesInstanceUid, seriesDate = '20240101', modality = 'CT') {
  return {
    '0020000E': { vr: 'UI', Value: [seriesInstanceUid] },
    '00080021': { vr: 'DA', Value: [seriesDate] },
    '00080031': { vr: 'TM', Value: ['120000'] },
    '00080060': { vr: 'CS', Value: [modality] },
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

describe('searchSeries', () => {
  it('should call the QIDO /series endpoint for the given study UID', async () => {
    await searchSeries(STUDY_UID, '', { DICOMWEB_HOST: server.baseUrl });
    expect(server.requests).to.have.lengthOf(1);
    expect(server.requests[0].url).to.match(new RegExp(`^/studies/${STUDY_UID}/series\\?`));
  });

  it('should include the default limit param in the URL', async () => {
    await searchSeries(STUDY_UID, '', { DICOMWEB_HOST: server.baseUrl });
    const params = new URLSearchParams(server.requests[0].url.split('?')[1]);
    expect(params.get('limit')).to.equal('50');
  });

  it('should pass a custom limit from the query string', async () => {
    await searchSeries(STUDY_UID, 'limit=5', { DICOMWEB_HOST: server.baseUrl });
    const params = new URLSearchParams(server.requests[0].url.split('?')[1]);
    expect(params.get('limit')).to.equal('5');
  });

  it('should not include an offset param when offset is 0', async () => {
    await searchSeries(STUDY_UID, '', { DICOMWEB_HOST: server.baseUrl });
    const params = new URLSearchParams(server.requests[0].url.split('?')[1]);
    expect(params.has('offset')).to.be.false;
  });

  it('should include an offset param when offset > 0', async () => {
    await searchSeries(STUDY_UID, 'offset=10', { DICOMWEB_HOST: server.baseUrl });
    const params = new URLSearchParams(server.requests[0].url.split('?')[1]);
    expect(params.get('offset')).to.equal('10');
  });

  it('should include fuzzymatching=true when requested', async () => {
    await searchSeries(STUDY_UID, 'fuzzymatching=true', { DICOMWEB_HOST: server.baseUrl });
    const params = new URLSearchParams(server.requests[0].url.split('?')[1]);
    expect(params.get('fuzzymatching')).to.equal('true');
  });

  it('should not include a fuzzymatching param when not requested', async () => {
    await searchSeries(STUDY_UID, '', { DICOMWEB_HOST: server.baseUrl });
    const params = new URLSearchParams(server.requests[0].url.split('?')[1]);
    expect(params.has('fuzzymatching')).to.be.false;
  });

  it('should map a DICOM keyword attribute to a URL param', async () => {
    await searchSeries(STUDY_UID, 'Modality=MR', { DICOMWEB_HOST: server.baseUrl });
    const params = new URLSearchParams(server.requests[0].url.split('?')[1]);
    expect(params.get('Modality')).to.equal('MR');
  });

  it('should include includefield when specified', async () => {
    await searchSeries(STUDY_UID, 'includefield=Modality', { DICOMWEB_HOST: server.baseUrl });
    const params = new URLSearchParams(server.requests[0].url.split('?')[1]);
    expect(params.get('includefield')).to.equal('00080060');
  });

  it('should always send Accept: application/dicom+json', async () => {
    await searchSeries(STUDY_UID, '', { DICOMWEB_HOST: server.baseUrl });
    expect(server.requests[0].headers['accept']).to.equal('application/dicom+json');
  });

  it('should not include an Authorization header when DICOMWEB_AUTH is unset', async () => {
    await searchSeries(STUDY_UID, '', { DICOMWEB_HOST: server.baseUrl });
    expect(server.requests[0].headers).to.not.have.property('authorization');
  });

  it('should send a Basic Authorization header when DICOMWEB_AUTH=basic', async () => {
    const env = {
      DICOMWEB_HOST: server.baseUrl,
      DICOMWEB_AUTH: 'basic',
      DICOMWEB_USER: 'user',
      DICOMWEB_PASS: 'pass',
    };
    await searchSeries(STUDY_UID, '', env);
    const expected = 'Basic ' + Buffer.from('user:pass').toString('base64');
    expect(server.requests[0].headers['authorization']).to.equal(expected);
  });

  it('should send a Bearer Authorization header when DICOMWEB_AUTH=bearer', async () => {
    const env = {
      DICOMWEB_HOST: server.baseUrl,
      DICOMWEB_AUTH: 'bearer',
      DICOMWEB_TOKEN: 'my-token',
    };
    await searchSeries(STUDY_UID, '', env);
    expect(server.requests[0].headers['authorization']).to.equal('Bearer my-token');
  });

  it('should return an empty array when the server returns no results', async () => {
    const results = await searchSeries(STUDY_UID, '', { DICOMWEB_HOST: server.baseUrl });
    expect(results).to.be.an('array').that.is.empty;
  });

  it('should map raw DICOM JSON items to plain objects', async () => {
    server.respondWith(200, [makeRawSeries('1.2.3.4', '20240315', 'MR')]);
    const results = await searchSeries(STUDY_UID, '', { DICOMWEB_HOST: server.baseUrl });
    expect(results).to.have.lengthOf(1);
    expect(results[0].seriesInstanceUid).to.equal('1.2.3.4');
    expect(results[0].seriesDate).to.equal('2024-03-15');
    expect(results[0].modality).to.equal('MR');
  });

  it('should sort results by seriesDate descending', async () => {
    server.respondWith(200, [
      makeRawSeries('1.1', '20220101'),
      makeRawSeries('1.3', '20240101'),
      makeRawSeries('1.2', '20230101'),
    ]);
    const results = await searchSeries(STUDY_UID, '', { DICOMWEB_HOST: server.baseUrl });
    expect(results.map((r) => r.seriesInstanceUid)).to.deep.equal(['1.3', '1.2', '1.1']);
  });

  it('should throw when the server returns a non-OK HTTP status', async () => {
    server.respondWith(500);
    let threw = false;
    try {
      await searchSeries(STUDY_UID, '', { DICOMWEB_HOST: server.baseUrl });
    } catch (err) {
      threw = true;
      expect(err.message).to.match(/500/);
    }
    expect(threw, 'expected searchSeries to throw').to.be.true;
  });
});
