import { expect } from 'chai';

import {
  ENCAPSULATED_PDF_REPORT_SOP_CLASS_UID,
  searchEncapsulatedPdfReports,
} from './../src/tools/searchEncapsulatedPdfReports.js';
import { FakeDicomWebServer } from './FakeDicomWebServer.js';

const STUDY_UID = '1.2.840.113619.2.55.3.604688123.123.1591781234.467';
const DOC_SERIES_UID = '1.2.840.113619.2.55.3.604688123.123.1591781234.100';
const DOC_SERIES_UID_2 = '1.2.840.113619.2.55.3.604688123.123.1591781234.200';

const ENCAPSULATED_PDF_UID = ENCAPSULATED_PDF_REPORT_SOP_CLASS_UID;
const CT_IMAGE_UID = '1.2.840.10008.5.1.4.1.1.2';

function makeRawSeries(seriesInstanceUid, modality = 'DOC') {
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

describe('searchEncapsulatedPdfReports', () => {
  it('should call the series endpoint with Modality=DOC', async () => {
    await searchEncapsulatedPdfReports(STUDY_UID, { DICOMWEB_HOST: server.baseUrl });
    const seriesReq = server.requests.find((r) => r.url.includes('/series?'));
    expect(seriesReq).to.exist;
    const params = new URLSearchParams(seriesReq.url.split('?')[1]);
    expect(params.get('Modality')).to.equal('DOC');
  });

  it('should return an empty array when no DOC series are found', async () => {
    const results = await searchEncapsulatedPdfReports(STUDY_UID, {
      DICOMWEB_HOST: server.baseUrl,
    });
    expect(results).to.be.an('array').that.is.empty;
  });

  it('should return an empty array when DOC series have no instances', async () => {
    server.on(new RegExp(`/studies/${STUDY_UID}/series$`), [makeRawSeries(DOC_SERIES_UID)]);
    const results = await searchEncapsulatedPdfReports(STUDY_UID, {
      DICOMWEB_HOST: server.baseUrl,
    });
    expect(results).to.be.an('array').that.is.empty;
  });

  it('should return instances matching the Encapsulated PDF SOP Class UID', async () => {
    server.on(new RegExp(`/studies/${STUDY_UID}/series$`), [makeRawSeries(DOC_SERIES_UID)]);
    server.on(new RegExp(`/studies/${STUDY_UID}/series/${DOC_SERIES_UID}/instances$`), [
      makeRawInstance('1.1.1', ENCAPSULATED_PDF_UID),
    ]);
    const results = await searchEncapsulatedPdfReports(STUDY_UID, {
      DICOMWEB_HOST: server.baseUrl,
    });
    expect(results).to.have.lengthOf(1);
    expect(results[0].sopInstanceUid).to.equal('1.1.1');
    expect(results[0].sopClassUid).to.equal(ENCAPSULATED_PDF_UID);
  });

  it('should filter out instances whose SOP Class UID is not Encapsulated PDF', async () => {
    server.on(new RegExp(`/studies/${STUDY_UID}/series$`), [makeRawSeries(DOC_SERIES_UID)]);
    server.on(new RegExp(`/studies/${STUDY_UID}/series/${DOC_SERIES_UID}/instances$`), [
      makeRawInstance('1.1.1', ENCAPSULATED_PDF_UID),
      makeRawInstance('1.1.2', CT_IMAGE_UID),
    ]);
    const results = await searchEncapsulatedPdfReports(STUDY_UID, {
      DICOMWEB_HOST: server.baseUrl,
    });
    expect(results).to.have.lengthOf(1);
    expect(results[0].sopInstanceUid).to.equal('1.1.1');
  });

  it('should collect PDF instances from multiple DOC series', async () => {
    server.on(new RegExp(`/studies/${STUDY_UID}/series$`), [
      makeRawSeries(DOC_SERIES_UID),
      makeRawSeries(DOC_SERIES_UID_2),
    ]);
    server.on(new RegExp(`/studies/${STUDY_UID}/series/${DOC_SERIES_UID}/instances$`), [
      makeRawInstance('1.1.1', ENCAPSULATED_PDF_UID),
    ]);
    server.on(new RegExp(`/studies/${STUDY_UID}/series/${DOC_SERIES_UID_2}/instances$`), [
      makeRawInstance('2.2.2', ENCAPSULATED_PDF_UID),
    ]);
    const results = await searchEncapsulatedPdfReports(STUDY_UID, {
      DICOMWEB_HOST: server.baseUrl,
    });
    expect(results).to.have.lengthOf(2);
    const uids = results.map((r) => r.sopInstanceUid);
    expect(uids).to.include('1.1.1');
    expect(uids).to.include('2.2.2');
  });

  it('should return an empty array when all instances across all DOC series are non-PDF', async () => {
    server.on(new RegExp(`/studies/${STUDY_UID}/series$`), [makeRawSeries(DOC_SERIES_UID)]);
    server.on(new RegExp(`/studies/${STUDY_UID}/series/${DOC_SERIES_UID}/instances$`), [
      makeRawInstance('1.1.1', CT_IMAGE_UID),
    ]);
    const results = await searchEncapsulatedPdfReports(STUDY_UID, {
      DICOMWEB_HOST: server.baseUrl,
    });
    expect(results).to.be.an('array').that.is.empty;
  });

  it('should query instances using the series UID from the mapped series object', async () => {
    server.on(new RegExp(`/studies/${STUDY_UID}/series$`), [makeRawSeries(DOC_SERIES_UID)]);
    await searchEncapsulatedPdfReports(STUDY_UID, { DICOMWEB_HOST: server.baseUrl });
    const instancesReq = server.requests.find((r) => r.url.includes('/instances?'));
    expect(instancesReq).to.exist;
    expect(instancesReq.url).to.include(DOC_SERIES_UID);
  });

  it('should pass Basic auth credentials to both series and instances requests', async () => {
    const env = {
      DICOMWEB_HOST: server.baseUrl,
      DICOMWEB_AUTH: 'basic',
      DICOMWEB_USER: 'user',
      DICOMWEB_PASS: 'pass',
    };
    server.on(new RegExp(`/studies/${STUDY_UID}/series$`), [makeRawSeries(DOC_SERIES_UID)]);
    server.on(new RegExp(`/studies/${STUDY_UID}/series/${DOC_SERIES_UID}/instances$`), [
      makeRawInstance('1.1.1', ENCAPSULATED_PDF_UID),
    ]);
    await searchEncapsulatedPdfReports(STUDY_UID, env);
    for (const req of server.requests) {
      const auth = req.headers['authorization'];
      expect(auth).to.exist;
      expect(auth).to.match(/^Basic /);
    }
  });

  it('should pass Bearer token to both series and instances requests', async () => {
    const env = {
      DICOMWEB_HOST: server.baseUrl,
      DICOMWEB_AUTH: 'bearer',
      DICOMWEB_TOKEN: 'mytoken',
    };
    server.on(new RegExp(`/studies/${STUDY_UID}/series$`), [makeRawSeries(DOC_SERIES_UID)]);
    server.on(new RegExp(`/studies/${STUDY_UID}/series/${DOC_SERIES_UID}/instances$`), [
      makeRawInstance('1.1.1', ENCAPSULATED_PDF_UID),
    ]);
    await searchEncapsulatedPdfReports(STUDY_UID, env);
    for (const req of server.requests) {
      const auth = req.headers['authorization'];
      expect(auth).to.exist;
      expect(auth).to.equal('Bearer mytoken');
    }
  });
});
