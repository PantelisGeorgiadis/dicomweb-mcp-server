import { expect } from 'chai';

import { mapDicomItem } from './../src/utils/resultsMapper.js';

describe('ResultsMapper', () => {
  it('should return an empty object for an empty DICOM item', () => {
    const result = mapDicomItem({});
    expect(result).to.be.an('object');
    expect(Object.keys(result)).to.be.empty;
  });

  it('should correctly map a string VR tag by keyword name in camelCase', () => {
    // PatientID (00100020, LO) → patientId
    const result = mapDicomItem({ '00100020': { vr: 'LO', Value: ['12345678'] } });
    expect(result.patientId).to.be.eq('12345678');
  });

  it('should correctly map a PN tag to the Alphabetic component', () => {
    // PatientName (00100010, PN) → patientName
    const result = mapDicomItem({
      '00100010': { vr: 'PN', Value: [{ Alphabetic: 'SMITH^JOHN' }] },
    });
    expect(result.patientName).to.be.eq('SMITH^JOHN');
  });

  it('should return empty string for a PN tag with no Alphabetic component', () => {
    const result = mapDicomItem({ '00100010': { vr: 'PN', Value: [{}] } });
    expect(result.patientName).to.be.eq('');
  });

  it('should correctly format a DA tag as an ISO date string', () => {
    // StudyDate (00080020, DA) → studyDate
    const result = mapDicomItem({ '00080020': { vr: 'DA', Value: ['20240315'] } });
    expect(result.studyDate).to.be.eq('2024-03-15');
  });

  it('should return null for a DA tag with an empty value', () => {
    const result = mapDicomItem({ '00080020': { vr: 'DA', Value: [''] } });
    expect(result.studyDate).to.be.null;
  });

  it('should omit tags not present in the source item', () => {
    const result = mapDicomItem({ '00100020': { vr: 'LO', Value: ['12345'] } });
    expect(result.patientName).to.be.undefined;
    expect(result.studyDate).to.be.undefined;
  });

  it('should correctly map multiple tags at once', () => {
    const result = mapDicomItem({
      '00100020': { vr: 'LO', Value: ['12345'] },
      '00100010': { vr: 'PN', Value: [{ Alphabetic: 'DOE^JANE' }] },
      '00080020': { vr: 'DA', Value: ['20231201'] },
      '00080050': { vr: 'SH', Value: ['ACC001'] },
    });
    expect(result.patientId).to.be.eq('12345');
    expect(result.patientName).to.be.eq('DOE^JANE');
    expect(result.studyDate).to.be.eq('2023-12-01');
    expect(result.accessionNumber).to.be.eq('ACC001');
  });

  it('should correctly map an SQ tag to an array of mapped objects', () => {
    // ProcedureCodeSequence (00081032, SQ) → procedureCodeSequence
    const result = mapDicomItem({
      '00081032': {
        vr: 'SQ',
        Value: [
          { '00080100': { vr: 'SH', Value: ['PROC001'] } },
          { '00080100': { vr: 'SH', Value: ['PROC002'] } },
        ],
      },
    });
    expect(result.procedureCodeSequence).to.be.an('array').with.lengthOf(2);
    expect(result.procedureCodeSequence[0].codeValue).to.be.eq('PROC001');
    expect(result.procedureCodeSequence[1].codeValue).to.be.eq('PROC002');
  });

  it('should return an empty array for an SQ tag with no values', () => {
    const result = mapDicomItem({ '00081032': { vr: 'SQ', Value: [] } });
    expect(result.procedureCodeSequence).to.be.an('array').that.is.empty;
  });

  it('should recursively map nested SQ tags', () => {
    // Outer SQ: ProcedureCodeSequence (00081032)
    // Inner SQ: ConceptNameCodeSequence (00080104 is CM, but let's use a real SQ: ReferencedStudySequence 00081110)
    const result = mapDicomItem({
      '00081032': {
        vr: 'SQ',
        Value: [
          {
            '00080100': { vr: 'SH', Value: ['OUTER_CODE'] },
            '00081110': {
              vr: 'SQ',
              Value: [{ '00080100': { vr: 'SH', Value: ['INNER_CODE'] } }],
            },
          },
        ],
      },
    });
    const outer = result.procedureCodeSequence[0];
    expect(outer.codeValue).to.be.eq('OUTER_CODE');
    expect(outer.referencedStudySequence).to.be.an('array').with.lengthOf(1);
    expect(outer.referencedStudySequence[0].codeValue).to.be.eq('INNER_CODE');
  });

  it('should correctly convert ALLCAPS acronym tags to camelCase', () => {
    // StudyInstanceUID (0020000D, UI) → studyInstanceUid
    const result = mapDicomItem({ '0020000D': { vr: 'UI', Value: ['1.2.3.4.5'] } });
    expect(result.studyInstanceUid).to.be.eq('1.2.3.4.5');
  });

  it('should correctly convert mixed-acronym tags to camelCase', () => {
    // SOPClassUID (00080016, UI) → sopClassUid
    const result = mapDicomItem({ '00080016': { vr: 'UI', Value: ['1.2.840.10008.5.1.4.1.1.2'] } });
    expect(result.sopClassUid).to.be.eq('1.2.840.10008.5.1.4.1.1.2');
  });

  it('should return empty string for a scalar tag with no Value array', () => {
    const result = mapDicomItem({ '00100020': { vr: 'LO' } });
    expect(result.patientId).to.be.eq('');
  });

  it('should exclude binary VR tags (OB, OW, UN, etc.)', () => {
    // PixelData (7FE00010, OW) must not appear in the result
    const result = mapDicomItem({ '7FE00010': { vr: 'OW', Value: ['...'] } });
    expect(result.pixelData).to.be.undefined;
  });

  it('should map a TM tag to a formatted HH:MM:SS string', () => {
    // StudyTime (00080030, TM) → studyTime as HH:MM:SS
    const result = mapDicomItem({ '00080030': { vr: 'TM', Value: ['143022'] } });
    expect(result.studyTime).to.equal('14:30:22');
  });

  it('should map a TM tag with fractional seconds to HH:MM:SS without fractional part', () => {
    const result = mapDicomItem({ '00080030': { vr: 'TM', Value: ['090000.000000'] } });
    expect(result.studyTime).to.equal('09:00:00');
  });
});
