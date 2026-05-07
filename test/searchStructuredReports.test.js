import { expect } from 'chai';

import { searchStructuredReports } from './../src/tools/searchStructuredReports.js';
import { FakeDicomWebServer } from './FakeDicomWebServer.js';

const STUDY_UID = '1.2.840.113619.2.55.3.604688123.123.1591781234.467';
const SR_SERIES_UID = '1.2.840.113619.2.55.3.604688123.123.1591781234.100';
const NON_SR_SERIES_UID = '1.2.840.113619.2.55.3.604688123.123.1591781234.200';

const BASIC_TEXT_SR = '1.2.840.10008.5.1.4.1.1.88.11';
const COMPREHENSIVE_SR = '1.2.840.10008.5.1.4.1.1.88.33';
const CT_IMAGE_UID = '1.2.840.10008.5.1.4.1.1.2';

function makeRawSeries(seriesInstanceUid, modality = 'SR') {
  return {
    '0020000E': { vr: 'UI', Value: [seriesInstanceUid] },
    '00080060': { vr: 'CS', Value: [modality] },
  };
}

function makeRawInstance(sopInstanceUid, sopClassUid) {
  return {
    '00080018': { vr: 'UI', Value: [sopInstanceUid] },
    '00080016': { vr: 'UI', Value: [sopClassUid] },
  };
}

const server = new FakeDicomWebServer();

before(async () => server.start());
after(async () => server.stop());
beforeEach(() => server.reset());

describe('searchStructuredReports', () => {
  it('should call the series endpoint with Modality=SR', async () => {
    await searchStructuredReports(STUDY_UID, { DICOMWEB_HOST: server.baseUrl });
    const seriesReq = server.requests.find((r) => r.url.includes('/series?'));
    expect(seriesReq).to.exist;
    const params = new URLSearchParams(seriesReq.url.split('?')[1]);
    expect(params.get('Modality')).to.equal('SR');
  });

  it('should return an empty array when no SR series are found', async () => {
    const results = await searchStructuredReports(STUDY_UID, {
      DICOMWEB_HOST: server.baseUrl,
    });
    expect(results).to.be.an('array').that.is.empty;
  });

  it('should return an empty array when SR series have no instances', async () => {
    server.on(new RegExp(`/studies/${STUDY_UID}/series$`), [makeRawSeries(SR_SERIES_UID)]);
    const results = await searchStructuredReports(STUDY_UID, {
      DICOMWEB_HOST: server.baseUrl,
    });
    expect(results).to.be.an('array').that.is.empty;
  });

  it('should return SR instances matching known SOP Class UIDs', async () => {
    server.on(new RegExp(`/studies/${STUDY_UID}/series$`), [makeRawSeries(SR_SERIES_UID)]);
    server.on(new RegExp(`/studies/${STUDY_UID}/series/${SR_SERIES_UID}/instances$`), [
      makeRawInstance('1.1.1', BASIC_TEXT_SR),
    ]);
    const results = await searchStructuredReports(STUDY_UID, {
      DICOMWEB_HOST: server.baseUrl,
    });
    expect(results).to.have.lengthOf(1);
    expect(results[0].sopInstanceUid).to.equal('1.1.1');
    expect(results[0].sopClassUid).to.equal(BASIC_TEXT_SR);
  });

  it('should filter out instances whose SOP Class UID is not a known SR type', async () => {
    server.on(new RegExp(`/studies/${STUDY_UID}/series$`), [makeRawSeries(SR_SERIES_UID)]);
    server.on(new RegExp(`/studies/${STUDY_UID}/series/${SR_SERIES_UID}/instances$`), [
      makeRawInstance('1.1.1', BASIC_TEXT_SR),
      makeRawInstance('1.1.2', CT_IMAGE_UID),
    ]);
    const results = await searchStructuredReports(STUDY_UID, {
      DICOMWEB_HOST: server.baseUrl,
    });
    expect(results).to.have.lengthOf(1);
    expect(results[0].sopInstanceUid).to.equal('1.1.1');
  });

  it('should collect SR instances from multiple SR series', async () => {
    server.on(new RegExp(`/studies/${STUDY_UID}/series$`), [
      makeRawSeries(SR_SERIES_UID),
      makeRawSeries(NON_SR_SERIES_UID),
    ]);
    server.on(new RegExp(`/studies/${STUDY_UID}/series/${SR_SERIES_UID}/instances$`), [
      makeRawInstance('1.1.1', BASIC_TEXT_SR),
    ]);
    server.on(new RegExp(`/studies/${STUDY_UID}/series/${NON_SR_SERIES_UID}/instances$`), [
      makeRawInstance('2.2.2', COMPREHENSIVE_SR),
    ]);
    const results = await searchStructuredReports(STUDY_UID, {
      DICOMWEB_HOST: server.baseUrl,
    });
    expect(results).to.have.lengthOf(2);
    const uids = results.map((r) => r.sopInstanceUid);
    expect(uids).to.include('1.1.1');
    expect(uids).to.include('2.2.2');
  });

  it('should return an empty array when all instances across all SR series are non-SR', async () => {
    server.on(new RegExp(`/studies/${STUDY_UID}/series$`), [makeRawSeries(SR_SERIES_UID)]);
    server.on(new RegExp(`/studies/${STUDY_UID}/series/${SR_SERIES_UID}/instances$`), [
      makeRawInstance('1.1.1', CT_IMAGE_UID),
    ]);
    const results = await searchStructuredReports(STUDY_UID, {
      DICOMWEB_HOST: server.baseUrl,
    });
    expect(results).to.be.an('array').that.is.empty;
  });

  it('should query instances using the series UID from the mapped series object', async () => {
    server.on(new RegExp(`/studies/${STUDY_UID}/series$`), [makeRawSeries(SR_SERIES_UID)]);
    await searchStructuredReports(STUDY_UID, { DICOMWEB_HOST: server.baseUrl });
    const instancesReq = server.requests.find((r) => r.url.includes('/instances?'));
    expect(instancesReq).to.exist;
    expect(instancesReq.url).to.include(SR_SERIES_UID);
  });

  it('should pass Basic auth credentials to both series and instances requests', async () => {
    const env = {
      DICOMWEB_HOST: server.baseUrl,
      DICOMWEB_AUTH: 'basic',
      DICOMWEB_USER: 'user',
      DICOMWEB_PASS: 'pass',
    };
    server.on(new RegExp(`/studies/${STUDY_UID}/series$`), [makeRawSeries(SR_SERIES_UID)]);
    await searchStructuredReports(STUDY_UID, env);
    const expected = 'Basic ' + Buffer.from('user:pass').toString('base64');
    for (const req of server.requests) {
      expect(req.headers['authorization']).to.equal(expected);
    }
  });

  it('should throw when the series request returns a non-OK HTTP status', async () => {
    server.on(new RegExp(`/studies/${STUDY_UID}/series$`), [], 500);
    let threw = false;
    try {
      await searchStructuredReports(STUDY_UID, { DICOMWEB_HOST: server.baseUrl });
    } catch (err) {
      threw = true;
      expect(err.message).to.match(/500/);
    }
    expect(threw, 'expected searchStructuredReports to throw').to.be.true;
  });

  it('should throw when an instances request returns a non-OK HTTP status', async () => {
    server.on(new RegExp(`/studies/${STUDY_UID}/series$`), [makeRawSeries(SR_SERIES_UID)]);
    server.on(new RegExp(`/studies/${STUDY_UID}/series/${SR_SERIES_UID}/instances$`), [], 500);
    let threw = false;
    try {
      await searchStructuredReports(STUDY_UID, { DICOMWEB_HOST: server.baseUrl });
    } catch (err) {
      threw = true;
      expect(err.message).to.match(/500/);
    }
    expect(threw, 'expected searchStructuredReports to throw on instances error').to.be.true;
  });
});
