import { expect } from 'chai';

import { searchInstances } from './../src/tools/searchInstances.js';
import { FakeDicomWebServer } from './FakeDicomWebServer.js';

const STUDY_UID = '1.2.840.113619.2.55.3.604688123.123.1591781234.467';
const SERIES_UID = '1.2.840.113619.2.55.3.604688123.123.1591781234.468';

function makeRawInstance(sopInstanceUid, instanceNumber) {
  const item = {
    '00080018': { vr: 'UI', Value: [sopInstanceUid] },
  };
  if (instanceNumber !== undefined) {
    item['00200013'] = { vr: 'IS', Value: [String(instanceNumber)] };
  }
  return item;
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

describe('searchInstances', () => {
  it('should call the QIDO /instances endpoint for the given study and series UIDs', async () => {
    await searchInstances(STUDY_UID, SERIES_UID, '', { DICOMWEB_HOST: server.baseUrl });
    expect(server.requests).to.have.lengthOf(1);
    expect(server.requests[0].url).to.match(
      new RegExp(`^/studies/${STUDY_UID}/series/${SERIES_UID}/instances\\?`)
    );
  });

  it('should include the default limit param in the URL', async () => {
    await searchInstances(STUDY_UID, SERIES_UID, '', { DICOMWEB_HOST: server.baseUrl });
    const params = new URLSearchParams(server.requests[0].url.split('?')[1]);
    expect(params.get('limit')).to.equal('50');
  });

  it('should pass a custom limit from the query string', async () => {
    await searchInstances(STUDY_UID, SERIES_UID, 'limit=5', { DICOMWEB_HOST: server.baseUrl });
    const params = new URLSearchParams(server.requests[0].url.split('?')[1]);
    expect(params.get('limit')).to.equal('5');
  });

  it('should not include an offset param when offset is 0', async () => {
    await searchInstances(STUDY_UID, SERIES_UID, '', { DICOMWEB_HOST: server.baseUrl });
    const params = new URLSearchParams(server.requests[0].url.split('?')[1]);
    expect(params.has('offset')).to.be.false;
  });

  it('should include an offset param when offset > 0', async () => {
    await searchInstances(STUDY_UID, SERIES_UID, 'offset=10', { DICOMWEB_HOST: server.baseUrl });
    const params = new URLSearchParams(server.requests[0].url.split('?')[1]);
    expect(params.get('offset')).to.equal('10');
  });

  it('should include fuzzymatching=true when requested', async () => {
    await searchInstances(STUDY_UID, SERIES_UID, 'fuzzymatching=true', {
      DICOMWEB_HOST: server.baseUrl,
    });
    const params = new URLSearchParams(server.requests[0].url.split('?')[1]);
    expect(params.get('fuzzymatching')).to.equal('true');
  });

  it('should not include a fuzzymatching param when not requested', async () => {
    await searchInstances(STUDY_UID, SERIES_UID, '', { DICOMWEB_HOST: server.baseUrl });
    const params = new URLSearchParams(server.requests[0].url.split('?')[1]);
    expect(params.has('fuzzymatching')).to.be.false;
  });

  it('should map a DICOM keyword attribute to a URL param', async () => {
    await searchInstances(STUDY_UID, SERIES_UID, 'SOPClassUID=1.2.840.10008.5.1.4.1.1.2', {
      DICOMWEB_HOST: server.baseUrl,
    });
    const params = new URLSearchParams(server.requests[0].url.split('?')[1]);
    expect(params.get('SOPClassUID')).to.equal('1.2.840.10008.5.1.4.1.1.2');
  });

  it('should always send Accept: application/dicom+json', async () => {
    await searchInstances(STUDY_UID, SERIES_UID, '', { DICOMWEB_HOST: server.baseUrl });
    expect(server.requests[0].headers['accept']).to.equal('application/dicom+json');
  });

  it('should not include an Authorization header when DICOMWEB_AUTH is unset', async () => {
    await searchInstances(STUDY_UID, SERIES_UID, '', { DICOMWEB_HOST: server.baseUrl });
    expect(server.requests[0].headers).to.not.have.property('authorization');
  });

  it('should send a Basic Authorization header when DICOMWEB_AUTH=basic', async () => {
    const env = {
      DICOMWEB_HOST: server.baseUrl,
      DICOMWEB_AUTH: 'basic',
      DICOMWEB_USER: 'user',
      DICOMWEB_PASS: 'pass',
    };
    await searchInstances(STUDY_UID, SERIES_UID, '', env);
    const expected = 'Basic ' + Buffer.from('user:pass').toString('base64');
    expect(server.requests[0].headers['authorization']).to.equal(expected);
  });

  it('should send a Bearer Authorization header when DICOMWEB_AUTH=bearer', async () => {
    const env = {
      DICOMWEB_HOST: server.baseUrl,
      DICOMWEB_AUTH: 'bearer',
      DICOMWEB_TOKEN: 'my-token',
    };
    await searchInstances(STUDY_UID, SERIES_UID, '', env);
    expect(server.requests[0].headers['authorization']).to.equal('Bearer my-token');
  });

  it('should return an empty array when the server returns no results', async () => {
    const results = await searchInstances(STUDY_UID, SERIES_UID, '', {
      DICOMWEB_HOST: server.baseUrl,
    });
    expect(results).to.be.an('array').that.is.empty;
  });

  it('should map raw DICOM JSON items to plain objects', async () => {
    server.respondWith(200, [makeRawInstance('1.2.3.4.5', 1)]);
    const results = await searchInstances(STUDY_UID, SERIES_UID, '', {
      DICOMWEB_HOST: server.baseUrl,
    });
    expect(results).to.have.lengthOf(1);
    expect(results[0].sopInstanceUid).to.equal('1.2.3.4.5');
    expect(results[0].instanceNumber).to.equal('1');
  });

  it('should sort results by instanceNumber ascending', async () => {
    server.respondWith(200, [
      makeRawInstance('1.1', 3),
      makeRawInstance('1.2', 1),
      makeRawInstance('1.3', 2),
    ]);
    const results = await searchInstances(STUDY_UID, SERIES_UID, '', {
      DICOMWEB_HOST: server.baseUrl,
    });
    expect(results.map((r) => r.sopInstanceUid)).to.deep.equal(['1.2', '1.3', '1.1']);
  });

  it('should sort instances with missing instanceNumber to the end', async () => {
    server.respondWith(200, [
      makeRawInstance('1.missing'),
      makeRawInstance('1.2', 1),
      makeRawInstance('1.3', 2),
    ]);
    const results = await searchInstances(STUDY_UID, SERIES_UID, '', {
      DICOMWEB_HOST: server.baseUrl,
    });
    expect(results.map((r) => r.sopInstanceUid)).to.deep.equal(['1.2', '1.3', '1.missing']);
  });

  it('should throw when the server returns a non-OK HTTP status', async () => {
    server.respondWith(500);
    let threw = false;
    try {
      await searchInstances(STUDY_UID, SERIES_UID, '', { DICOMWEB_HOST: server.baseUrl });
    } catch (err) {
      threw = true;
      expect(err.message).to.match(/500/);
    }
    expect(threw, 'expected searchInstances to throw').to.be.true;
  });
});
