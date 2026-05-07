import { expect } from 'chai';

import { getInstanceMetadata } from './../src/tools/getInstanceMetadata.js';
import { FakeDicomWebServer } from './FakeDicomWebServer.js';

const STUDY_UID = '1.2.840.113619.2.55.3.604688123.123.1591781234.467';
const SERIES_UID = '1.2.840.113619.2.55.3.604688123.123.1591781234.468';
const SOP_UID = '1.2.840.113619.2.55.3.604688123.123.1591781234.469';

function makeRawInstance(extra = {}) {
  return {
    '00080016': { vr: 'UI', Value: ['1.2.840.10008.5.1.4.1.1.2'] },
    '00100010': { vr: 'PN', Value: [{ Alphabetic: 'DOE^JOHN' }] },
    ...extra,
  };
}

const server = new FakeDicomWebServer();

before(async () => server.start());
after(async () => server.stop());
beforeEach(() => server.reset());

describe('getInstanceMetadata', () => {
  it('should call the WADO-RS /metadata endpoint with the correct path', async () => {
    server.respondWith(200, [makeRawInstance()]);
    await getInstanceMetadata(STUDY_UID, SERIES_UID, SOP_UID, {
      DICOMWEB_HOST: server.baseUrl,
    });
    expect(server.requests).to.have.lengthOf(1);
    expect(server.requests[0].url).to.equal(
      `/studies/${STUDY_UID}/series/${SERIES_UID}/instances/${SOP_UID}/metadata`
    );
  });

  it('should percent-encode UIDs with special characters in the URL', async () => {
    const uidWithSpace = '1.2.3 4';
    server.respondWith(200, [makeRawInstance()]);
    await getInstanceMetadata(uidWithSpace, SERIES_UID, SOP_UID, {
      DICOMWEB_HOST: server.baseUrl,
    });
    expect(server.requests[0].url).to.include(encodeURIComponent(uidWithSpace));
  });

  it('should always send Accept: application/dicom+json', async () => {
    server.respondWith(200, [makeRawInstance()]);
    await getInstanceMetadata(STUDY_UID, SERIES_UID, SOP_UID, {
      DICOMWEB_HOST: server.baseUrl,
    });
    expect(server.requests[0].headers['accept']).to.equal('application/dicom+json');
  });

  it('should not include an Authorization header when DICOMWEB_AUTH is unset', async () => {
    server.respondWith(200, [makeRawInstance()]);
    await getInstanceMetadata(STUDY_UID, SERIES_UID, SOP_UID, {
      DICOMWEB_HOST: server.baseUrl,
    });
    expect(server.requests[0].headers).to.not.have.property('authorization');
  });

  it('should send a Basic Authorization header when DICOMWEB_AUTH=basic', async () => {
    server.respondWith(200, [makeRawInstance()]);
    const env = {
      DICOMWEB_HOST: server.baseUrl,
      DICOMWEB_AUTH: 'basic',
      DICOMWEB_USER: 'user',
      DICOMWEB_PASS: 'pass',
    };
    await getInstanceMetadata(STUDY_UID, SERIES_UID, SOP_UID, env);
    const expected = 'Basic ' + Buffer.from('user:pass').toString('base64');
    expect(server.requests[0].headers['authorization']).to.equal(expected);
  });

  it('should send a Bearer Authorization header when DICOMWEB_AUTH=bearer', async () => {
    server.respondWith(200, [makeRawInstance()]);
    const env = {
      DICOMWEB_HOST: server.baseUrl,
      DICOMWEB_AUTH: 'bearer',
      DICOMWEB_TOKEN: 'my-token',
    };
    await getInstanceMetadata(STUDY_UID, SERIES_UID, SOP_UID, env);
    expect(server.requests[0].headers['authorization']).to.equal('Bearer my-token');
  });

  it('should throw when the server returns a non-OK HTTP status', async () => {
    server.respondWith(500);
    let threw = false;
    try {
      await getInstanceMetadata(STUDY_UID, SERIES_UID, SOP_UID, {
        DICOMWEB_HOST: server.baseUrl,
      });
    } catch (err) {
      threw = true;
      expect(err.message).to.match(/500/);
    }
    expect(threw, 'expected getInstanceMetadata to throw on 500').to.be.true;
  });

  it('should throw when the server returns a 404', async () => {
    server.respondWith(404);
    let threw = false;
    try {
      await getInstanceMetadata(STUDY_UID, SERIES_UID, SOP_UID, {
        DICOMWEB_HOST: server.baseUrl,
      });
    } catch (err) {
      threw = true;
      expect(err.message).to.match(/404/);
    }
    expect(threw, 'expected getInstanceMetadata to throw on 404').to.be.true;
  });

  it('should throw when the server returns an empty array', async () => {
    server.respondWith(200, []);
    let threw = false;
    try {
      await getInstanceMetadata(STUDY_UID, SERIES_UID, SOP_UID, {
        DICOMWEB_HOST: server.baseUrl,
      });
    } catch (err) {
      threw = true;
      expect(err.message).to.include('not found');
    }
    expect(threw, 'expected getInstanceMetadata to throw on empty result').to.be.true;
  });

  it('should include the Study, Series and SOP UIDs in the not-found error message', async () => {
    server.respondWith(200, []);
    let message = '';
    try {
      await getInstanceMetadata(STUDY_UID, SERIES_UID, SOP_UID, {
        DICOMWEB_HOST: server.baseUrl,
      });
    } catch (err) {
      message = err.message;
    }
    expect(message).to.include(STUDY_UID);
    expect(message).to.include(SERIES_UID);
    expect(message).to.include(SOP_UID);
  });

  it('should always return mapped plain objects', async () => {
    server.respondWith(200, [makeRawInstance()]);
    const result = await getInstanceMetadata(STUDY_UID, SERIES_UID, SOP_UID, {
      DICOMWEB_HOST: server.baseUrl,
    });
    expect(result).to.be.an('array').with.lengthOf(1);
    expect(result[0]).to.not.have.property('00080016');
    expect(result[0]).to.have.property('patientName', 'DOE^JOHN');
  });

  it('should return all items when the server returns multiple objects', async () => {
    server.respondWith(200, [makeRawInstance(), makeRawInstance(), makeRawInstance()]);
    const result = await getInstanceMetadata(STUDY_UID, SERIES_UID, SOP_UID, {
      DICOMWEB_HOST: server.baseUrl,
    });
    expect(result).to.have.lengthOf(3);
  });
});
