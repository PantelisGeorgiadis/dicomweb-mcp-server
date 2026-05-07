import { expect } from 'chai';

import { parseQuery } from './../src/utils/queryParser.js';

describe('QueryParser', () => {
  it('should return default values for an empty query string', () => {
    const result = parseQuery('');
    expect(result.queryAttributes.size).to.be.eq(0);
    expect(result.includeFields).to.be.empty;
    expect(result.fuzzyMatching).to.be.eq(false);
    expect(result.limit).to.be.eq(50);
    expect(result.offset).to.be.eq(0);
    expect(result.errors).to.be.empty;
  });

  it('should return default values for a null or undefined query string', () => {
    for (const input of [null, undefined]) {
      const result = parseQuery(input);
      expect(result.queryAttributes.size).to.be.eq(0);
      expect(result.includeFields).to.be.empty;
      expect(result.fuzzyMatching).to.be.eq(false);
      expect(result.limit).to.be.eq(50);
      expect(result.offset).to.be.eq(0);
      expect(result.errors).to.be.empty;
    }
  });

  it('should correctly parse a DICOM keyword attribute', () => {
    const result = parseQuery('PatientName=Smith*');
    expect(result.queryAttributes.size).to.be.eq(1);
    const attr = result.queryAttributes.get('00100010');
    expect(attr).to.not.be.undefined;
    expect(attr.tag).to.be.eq('00100010');
    expect(attr.name).to.be.eq('PatientName');
    expect(attr.rawKey).to.be.eq('PatientName');
    expect(attr.rawValue).to.be.eq('Smith*');
    expect(result.errors).to.be.empty;
  });

  it('should parse a DICOM keyword attribute case-insensitively', () => {
    const result = parseQuery('patientname=Smith*');
    expect(result.queryAttributes.size).to.be.eq(1);
    const attr = result.queryAttributes.get('00100010');
    expect(attr).to.not.be.undefined;
    expect(attr.rawKey).to.be.eq('patientname');
    expect(attr.rawValue).to.be.eq('Smith*');
    expect(result.errors).to.be.empty;
  });

  it('should correctly parse a DICOM hex tag attribute', () => {
    const result = parseQuery('00100020=12345678');
    expect(result.queryAttributes.size).to.be.eq(1);
    const attr = result.queryAttributes.get('00100020');
    expect(attr).to.not.be.undefined;
    expect(attr.tag).to.be.eq('00100020');
    expect(attr.name).to.be.eq('PatientID');
    expect(attr.rawKey).to.be.eq('00100020');
    expect(attr.rawValue).to.be.eq('12345678');
    expect(result.errors).to.be.empty;
  });

  it('should correctly parse multiple DICOM attributes', () => {
    const result = parseQuery('PatientName=Smith* PatientID=12345 ModalitiesInStudy=CT');
    expect(result.queryAttributes.size).to.be.eq(3);
    expect(result.queryAttributes.has('00100010')).to.be.true;
    expect(result.queryAttributes.has('00100020')).to.be.true;
    expect(result.queryAttributes.has('00080061')).to.be.true;
    expect(result.errors).to.be.empty;
  });

  it('should correctly parse StudyDate range value', () => {
    const result = parseQuery('StudyDate=20240101-20241231');
    const attr = result.queryAttributes.get('00080020');
    expect(attr).to.not.be.undefined;
    expect(attr.rawValue).to.be.eq('20240101-20241231');
    expect(result.errors).to.be.empty;
  });

  it('should correctly parse the limit parameter', () => {
    const result = parseQuery('PatientName=Smith* limit=10');
    expect(result.limit).to.be.eq(10);
    expect(result.queryAttributes.size).to.be.eq(1);
    expect(result.errors).to.be.empty;
  });

  it('should correctly parse the offset parameter', () => {
    const result = parseQuery('PatientName=Smith* offset=25');
    expect(result.offset).to.be.eq(25);
    expect(result.errors).to.be.empty;
  });

  it('should parse limit and offset case-insensitively', () => {
    const result = parseQuery('LIMIT=5 OFFSET=10');
    expect(result.limit).to.be.eq(5);
    expect(result.offset).to.be.eq(10);
    expect(result.errors).to.be.empty;
  });

  it('should add an error for an invalid limit and keep the default', () => {
    const result = parseQuery('limit=notanumber');
    expect(result.limit).to.be.eq(50);
    expect(result.errors).to.have.lengthOf(1);
    expect(result.errors[0]).to.include('limit');
  });

  it('should add an error for an invalid offset and keep the default', () => {
    const result = parseQuery('offset=notanumber');
    expect(result.offset).to.be.eq(0);
    expect(result.errors).to.have.lengthOf(1);
    expect(result.errors[0]).to.include('offset');
  });

  it('should correctly parse fuzzymatching=true', () => {
    const result = parseQuery('PatientName=Smith* fuzzymatching=true');
    expect(result.fuzzyMatching).to.be.eq(true);
    expect(result.errors).to.be.empty;
  });

  it('should correctly parse fuzzymatching=false', () => {
    const result = parseQuery('fuzzymatching=false');
    expect(result.fuzzyMatching).to.be.eq(false);
    expect(result.errors).to.be.empty;
  });

  it('should parse fuzzymatching case-insensitively', () => {
    const result = parseQuery('FUZZYMATCHING=TRUE');
    expect(result.fuzzyMatching).to.be.eq(true);
    expect(result.errors).to.be.empty;
  });

  it('should correctly parse includefield by keyword', () => {
    const result = parseQuery('includefield=PatientBirthDate,PatientSex');
    expect(result.includeFields).to.have.members(['00100030', '00100040']);
    expect(result.errors).to.be.empty;
  });

  it('should correctly parse includefield by hex tag', () => {
    const result = parseQuery('includefield=00100030,00100040');
    expect(result.includeFields).to.have.members(['00100030', '00100040']);
    expect(result.errors).to.be.empty;
  });

  it('should add an error for an unknown includefield keyword', () => {
    const result = parseQuery('includefield=UnknownKeyword');
    expect(result.includeFields).to.be.empty;
    expect(result.errors).to.have.lengthOf(1);
    expect(result.errors[0]).to.include('includefield');
  });

  it('should add an error for an unknown DICOM keyword attribute and skip it', () => {
    const result = parseQuery('UnknownTag=value');
    expect(result.queryAttributes.size).to.be.eq(0);
    expect(result.errors).to.have.lengthOf(1);
    expect(result.errors[0]).to.include('UnknownTag');
  });

  it('should add an error for a token without "=" and skip it', () => {
    const result = parseQuery('PatientNameNoEquals');
    expect(result.queryAttributes.size).to.be.eq(0);
    expect(result.errors).to.have.lengthOf(1);
    expect(result.errors[0]).to.include('no');
  });

  it('should not add query attribute errors when encountering valid special keys', () => {
    const result = parseQuery('limit=10 offset=5 fuzzymatching=true');
    expect(result.queryAttributes.size).to.be.eq(0);
    expect(result.errors).to.be.empty;
  });

  it('should use last-write-wins for duplicate DICOM attribute keys', () => {
    const result = parseQuery('PatientID=111 PatientID=222');
    expect(result.queryAttributes.size).to.be.eq(1);
    const attr = result.queryAttributes.get('00100020');
    expect(attr.rawValue).to.be.eq('222');
    expect(result.errors).to.be.empty;
  });

  it('should correctly strip single quotes from values', () => {
    const result = parseQuery("PatientName='John Smith'");
    const attr = result.queryAttributes.get('00100010');
    expect(attr).to.not.be.undefined;
    expect(attr.rawValue).to.be.eq('John Smith');
  });

  it('should correctly strip double quotes from values', () => {
    const result = parseQuery('PatientName="John Smith"');
    const attr = result.queryAttributes.get('00100010');
    expect(attr).to.not.be.undefined;
    expect(attr.rawValue).to.be.eq('John Smith');
  });

  it('should handle a comprehensive real-world query', () => {
    const result = parseQuery(
      'PatientName=Smith* ModalitiesInStudy=CT StudyDate=20240101-20241231 fuzzymatching=true limit=20 offset=0'
    );
    expect(result.queryAttributes.size).to.be.eq(3);
    expect(result.queryAttributes.has('00100010')).to.be.true;
    expect(result.queryAttributes.has('00080061')).to.be.true;
    expect(result.queryAttributes.has('00080020')).to.be.true;
    expect(result.fuzzyMatching).to.be.eq(true);
    expect(result.limit).to.be.eq(20);
    expect(result.offset).to.be.eq(0);
    expect(result.errors).to.be.empty;
  });
});
