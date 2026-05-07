import { expect } from 'chai';

import { formatResults } from './../src/utils/resultsFormatter.js';

describe('formatResults', () => {
  it('should use default item name "Item" in the header', () => {
    const result = formatResults([{ id: '1' }]);
    expect(result).to.match(/^Item 1 of 1/);
  });

  it('should use a custom item name in the header', () => {
    const result = formatResults([{ id: '1' }], 'Study');
    expect(result).to.match(/^Study 1 of 1/);
  });

  it('should number blocks sequentially and include the total count', () => {
    const result = formatResults([{ id: '1' }, { id: '2' }, { id: '3' }], 'Series');
    expect(result).to.contain('Series 1 of 3');
    expect(result).to.contain('Series 2 of 3');
    expect(result).to.contain('Series 3 of 3');
  });

  it('should capitalise a simple lowercase key', () => {
    const result = formatResults([{ name: 'Alice' }]);
    expect(result).to.contain('Name');
  });

  it('should convert a camelCase key to space-separated capitalised label', () => {
    const result = formatResults([{ studyDate: '2024-01-01' }]);
    expect(result).to.contain('Study Date');
  });

  it('should handle multiple uppercase segments in a key', () => {
    const result = formatResults([{ studyInstanceUid: '1.2.3' }]);
    expect(result).to.contain('Study Instance Uid');
  });

  it('should display a truthy string value as-is', () => {
    const result = formatResults([{ modality: 'CT' }]);
    expect(result).to.contain('CT');
  });

  it('should display "" for an empty string value', () => {
    const result = formatResults([{ modality: '' }]);
    expect(result).to.contain('');
  });

  it('should display "" for a null value', () => {
    const result = formatResults([{ modality: null }]);
    expect(result).to.contain('');
  });

  it('should display "" for an undefined value', () => {
    const result = formatResults([{ modality: undefined }]);
    expect(result).to.contain('');
  });

  it('should display a numeric value as-is', () => {
    const result = formatResults([{ numberOfSeries: 5 }]);
    expect(result).to.contain('5');
  });

  it('should display the numeric value 0 as-is (not N/A)', () => {
    const result = formatResults([{ instanceNumber: 0 }]);
    expect(result).to.contain('0');
    expect(result).to.not.contain('N/A');
  });

  it('should pad shorter labels to match the longest label in the block', () => {
    const result = formatResults([{ id: '1', studyDate: '2024-01-01' }]);
    const lines = result.split('\n');
    // 'Study Date' (10 chars) is longest; 'Id' (2 chars) must be padded to 10
    const idLine = lines.find((l) => l.trimStart().startsWith('Id'));
    const studyDateLine = lines.find((l) => l.trimStart().startsWith('Study Date'));
    // Both value columns should start at the same character position
    expect(idLine.indexOf('1')).to.equal(studyDateLine.indexOf('2024-01-01'));
  });

  it('should separate blocks with a blank line', () => {
    const result = formatResults([{ id: '1' }, { id: '2' }]);
    expect(result).to.contain('\n\n');
  });

  it('should return one block per item', () => {
    const result = formatResults([{ id: '1' }, { id: '2' }, { id: '3' }]);
    const blocks = result.split('\n\n');
    expect(blocks).to.have.lengthOf(3);
  });

  it('should return an empty string for an empty array', () => {
    expect(formatResults([])).to.equal('');
  });

  it('should handle an item with a single property', () => {
    const result = formatResults([{ patientId: '007' }], 'Patient');
    expect(result).to.contain('Patient 1 of 1');
    expect(result).to.contain('Patient Id');
    expect(result).to.contain('007');
  });

  it('should handle an item with many properties without throwing', () => {
    const item = {
      patientId: 'P001',
      patientName: 'Doe^John',
      studyDate: '2024-12-05',
      modality: 'CT',
      numberOfSeries: 3,
    };
    expect(() => formatResults([item], 'Study')).to.not.throw();
  });

  it('should render an array property as a sequence header suffixed with ":"', () => {
    const result = formatResults([{ patientName: 'Doe', procedureCodeSequence: [] }], 'Study');
    expect(result).to.contain('Procedure Code Sequence:');
  });

  it('should print "Item N:" for each element in an array property', () => {
    const result = formatResults(
      [{ procedureCodeSequence: [{ codeValue: '1234' }, { codeValue: '5678' }] }],
      'Study'
    );
    expect(result).to.contain('Item 1:');
    expect(result).to.contain('Item 2:');
  });

  it('should indent each nesting level deeper than the previous', () => {
    const result = formatResults(
      [{ referencedSeriesSequence: [{ seriesInstanceUid: '1.2.3' }] }],
      'Study'
    );
    const lines = result.split('\n');
    const headerLine = lines.find((l) => l.includes('Referenced Series Sequence:'));
    const itemLine = lines.find((l) => l.includes('Item 1:'));
    const propLine = lines.find((l) => l.includes('Series Instance Uid'));
    expect(headerLine.search(/\S/)).to.be.lessThan(itemLine.search(/\S/));
    expect(itemLine.search(/\S/)).to.be.lessThan(propLine.search(/\S/));
  });

  it('should handle an empty array property without throwing', () => {
    expect(() => formatResults([{ patientName: 'Doe', procedureCodeSequence: [] }])).to.not.throw();
  });
});
