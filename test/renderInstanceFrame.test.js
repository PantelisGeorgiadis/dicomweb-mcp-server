import { expect } from 'chai';

import { ALLOWED_OUTPUT_FORMATS, renderInstanceFrame } from './../src/tools/renderInstanceFrame.js';
import { FakeDicomWebServer } from './FakeDicomWebServer.js';

const STUDY_UID = '1.2.840.113619.2.55.3.604688123.123.1591781234.467';
const SERIES_UID = '1.2.840.113619.2.55.3.604688123.123.1591781234.468';
const SOP_UID = '1.2.840.113619.2.55.3.604688123.123.1591781234.469';

const FAKE_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

const server = new FakeDicomWebServer();

before(async () => server.start());
after(async () => server.stop());
beforeEach(() => server.reset());

describe('renderInstanceFrame', () => {
  it('should call the WADO-RS /frames/{n}/rendered endpoint with the correct path', async () => {
    server.respondWithBinary(200, FAKE_JPEG);
    await renderInstanceFrame(STUDY_UID, SERIES_UID, SOP_UID, 1, 'image/jpeg', {
      DICOMWEB_HOST: server.baseUrl,
    });
    expect(server.requests).to.have.lengthOf(1);
    expect(server.requests[0].url).to.equal(
      `/studies/${STUDY_UID}/series/${SERIES_UID}/instances/${SOP_UID}/frames/1/rendered`
    );
  });

  it('should use frame 1 by default', async () => {
    server.respondWithBinary(200, FAKE_JPEG);
    await renderInstanceFrame(STUDY_UID, SERIES_UID, SOP_UID, 1, 'image/jpeg', {
      DICOMWEB_HOST: server.baseUrl,
    });
    expect(server.requests[0].url).to.include('/frames/1/rendered');
  });

  it('should use the supplied frame index in the URL', async () => {
    server.respondWithBinary(200, FAKE_JPEG);
    await renderInstanceFrame(STUDY_UID, SERIES_UID, SOP_UID, 3, 'image/jpeg', {
      DICOMWEB_HOST: server.baseUrl,
    });
    expect(server.requests[0].url).to.include('/frames/3/rendered');
  });

  it('should percent-encode UIDs with special characters in the URL', async () => {
    const uidWithSpace = '1.2.3 4';
    server.respondWithBinary(200, FAKE_JPEG);
    await renderInstanceFrame(uidWithSpace, SERIES_UID, SOP_UID, 1, 'image/jpeg', {
      DICOMWEB_HOST: server.baseUrl,
    });
    expect(server.requests[0].url).to.include(encodeURIComponent(uidWithSpace));
  });

  it('should send Accept: image/jpeg when outputFormat is image/jpeg', async () => {
    server.respondWithBinary(200, FAKE_JPEG);
    await renderInstanceFrame(STUDY_UID, SERIES_UID, SOP_UID, 1, 'image/jpeg', {
      DICOMWEB_HOST: server.baseUrl,
    });
    expect(server.requests[0].headers['accept']).to.equal('image/jpeg');
  });

  it('should send Accept: image/png when outputFormat is image/png', async () => {
    server.respondWithBinary(200, FAKE_JPEG, 'image/png');
    await renderInstanceFrame(STUDY_UID, SERIES_UID, SOP_UID, 1, 'image/png', {
      DICOMWEB_HOST: server.baseUrl,
    });
    expect(server.requests[0].headers['accept']).to.equal('image/png');
  });

  it('should not include an Authorization header when DICOMWEB_AUTH is unset', async () => {
    server.respondWithBinary(200, FAKE_JPEG);
    await renderInstanceFrame(STUDY_UID, SERIES_UID, SOP_UID, 1, 'image/jpeg', {
      DICOMWEB_HOST: server.baseUrl,
    });
    expect(server.requests[0].headers).to.not.have.property('authorization');
  });

  it('should send a Basic Authorization header when DICOMWEB_AUTH=basic', async () => {
    server.respondWithBinary(200, FAKE_JPEG);
    const env = {
      DICOMWEB_HOST: server.baseUrl,
      DICOMWEB_AUTH: 'basic',
      DICOMWEB_USER: 'user',
      DICOMWEB_PASS: 'pass',
    };
    await renderInstanceFrame(STUDY_UID, SERIES_UID, SOP_UID, 1, 'image/jpeg', env);
    const expected = 'Basic ' + Buffer.from('user:pass').toString('base64');
    expect(server.requests[0].headers['authorization']).to.equal(expected);
  });

  it('should send a Bearer Authorization header when DICOMWEB_AUTH=bearer', async () => {
    server.respondWithBinary(200, FAKE_JPEG);
    const env = {
      DICOMWEB_HOST: server.baseUrl,
      DICOMWEB_AUTH: 'bearer',
      DICOMWEB_TOKEN: 'my-token',
    };
    await renderInstanceFrame(STUDY_UID, SERIES_UID, SOP_UID, 1, 'image/jpeg', env);
    expect(server.requests[0].headers['authorization']).to.equal('Bearer my-token');
  });

  it('should return a Buffer on success', async () => {
    server.respondWithBinary(200, FAKE_JPEG);
    const result = await renderInstanceFrame(STUDY_UID, SERIES_UID, SOP_UID, 1, 'image/jpeg', {
      DICOMWEB_HOST: server.baseUrl,
    });
    expect(result).to.be.instanceof(Buffer);
    expect(result.byteLength).to.equal(FAKE_JPEG.length);
  });

  it('should throw when the server returns a non-OK HTTP status', async () => {
    server.respondWith(500);
    let threw = false;
    try {
      await renderInstanceFrame(STUDY_UID, SERIES_UID, SOP_UID, 1, 'image/jpeg', {
        DICOMWEB_HOST: server.baseUrl,
      });
    } catch (err) {
      threw = true;
      expect(err.message).to.match(/500/);
    }
    expect(threw, 'expected renderInstanceFrame to throw on 500').to.be.true;
  });

  it('should throw when the server returns a 404', async () => {
    server.respondWith(404);
    let threw = false;
    try {
      await renderInstanceFrame(STUDY_UID, SERIES_UID, SOP_UID, 1, 'image/jpeg', {
        DICOMWEB_HOST: server.baseUrl,
      });
    } catch (err) {
      threw = true;
      expect(err.message).to.match(/404/);
    }
    expect(threw, 'expected renderInstanceFrame to throw on 404').to.be.true;
  });

  it('should throw immediately for an unsupported output format', async () => {
    let threw = false;
    try {
      await renderInstanceFrame(STUDY_UID, SERIES_UID, SOP_UID, 1, 'image/bmp', {
        DICOMWEB_HOST: server.baseUrl,
      });
    } catch (err) {
      threw = true;
      expect(err.message).to.include('image/bmp');
    }
    expect(threw, 'expected renderInstanceFrame to throw for unsupported format').to.be.true;
    expect(server.requests).to.be.empty;
  });

  it('should throw immediately when frame index is less than 1', async () => {
    let threw = false;
    try {
      await renderInstanceFrame(STUDY_UID, SERIES_UID, SOP_UID, 0, 'image/jpeg', {
        DICOMWEB_HOST: server.baseUrl,
      });
    } catch (err) {
      threw = true;
      expect(err.message).to.include('positive integer');
    }
    expect(threw, 'expected renderInstanceFrame to throw for frame < 1').to.be.true;
    expect(server.requests).to.be.empty;
  });

  it('ALLOWED_OUTPUT_FORMATS should include image/jpeg and image/png', () => {
    expect(ALLOWED_OUTPUT_FORMATS).to.include('image/jpeg');
    expect(ALLOWED_OUTPUT_FORMATS).to.include('image/png');
  });
});
