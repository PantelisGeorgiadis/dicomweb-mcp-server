import { expect } from 'chai';

import { srToText } from './../src/utils/srToText.js';

function codeSeq(meaning) {
  return { Value: [{ '00080104': { vr: 'LO', Value: [meaning] } }] };
}

function textItem(conceptMeaning, text) {
  return {
    '0040A040': { vr: 'CS', Value: ['TEXT'] },
    '0040A043': codeSeq(conceptMeaning),
    '0040A160': { vr: 'UT', Value: [text] },
  };
}

function containerItem(conceptMeaning, items, continuous = false) {
  return {
    '0040A040': { vr: 'CS', Value: ['CONTAINER'] },
    '0040A043': codeSeq(conceptMeaning),
    '0040A050': { vr: 'CS', Value: [continuous ? 'CONTINUOUS' : 'SEPARATE'] },
    '0040A730': { vr: 'SQ', Value: items },
  };
}

function srWithItem(item) {
  return {
    '0040A730': { vr: 'SQ', Value: [item] },
  };
}

describe('srToText', () => {
  it('should render patient line with name, sex, dob and id', () => {
    const sr = {
      '00100010': { vr: 'PN', Value: [{ Alphabetic: 'DOE^JOHN' }] },
      '00100020': { vr: 'LO', Value: ['P001'] },
      '00100030': { vr: 'DA', Value: ['19800101'] },
      '00100040': { vr: 'CS', Value: ['M'] },
    };
    const result = srToText(sr);
    expect(result).to.contain('Patient: DOE^JOHN (M, 19800101, P001)');
  });

  it('should omit the patient line when name and id are both absent', () => {
    const result = srToText({});
    expect(result).to.not.contain('Patient:');
  });

  it('should render referring physician when present', () => {
    const sr = {
      '00080090': { vr: 'PN', Value: [{ Alphabetic: 'SMITH^JANE' }] },
    };
    expect(srToText(sr)).to.contain('Referring Physician: SMITH^JANE');
  });

  it('should omit referring physician when absent', () => {
    expect(srToText({})).to.not.contain('Referring Physician:');
  });

  it('should render study description when present', () => {
    const sr = { '00081030': { vr: 'LO', Value: ['Chest CT'] } };
    expect(srToText(sr)).to.contain('Study: Chest CT');
  });

  it('should render series description when present', () => {
    const sr = { '0008103E': { vr: 'LO', Value: ['SR Report'] } };
    expect(srToText(sr)).to.contain('Series: SR Report');
  });

  it('should render completion flag when present', () => {
    const sr = { '0040A491': { vr: 'CS', Value: ['COMPLETE'] } };
    expect(srToText(sr)).to.contain('Completion Flag: COMPLETE');
  });

  it('should render verification flag when present', () => {
    const sr = { '0040A493': { vr: 'CS', Value: ['VERIFIED'] } };
    expect(srToText(sr)).to.contain('Verification Flag: VERIFIED');
  });

  it('should render content date and time when both present', () => {
    const sr = {
      '00080023': { vr: 'DA', Value: ['20241205'] },
      '00080033': { vr: 'TM', Value: ['142000'] },
    };
    expect(srToText(sr)).to.contain('Content Date/Time: 20241205 142000');
  });

  it('should render only content date when time is absent', () => {
    const sr = { '00080023': { vr: 'DA', Value: ['20241205'] } };
    expect(srToText(sr)).to.contain('Content Date/Time: 20241205');
  });

  it('should render the report title from root ConceptNameCodeSequence', () => {
    const sr = { '0040A043': codeSeq('Diagnostic Imaging Report') };
    expect(srToText(sr)).to.contain('Diagnostic Imaging Report');
  });

  it('should render a TEXT item', () => {
    const sr = srWithItem(textItem('Findings', 'Normal chest X-ray.'));
    const result = srToText(sr);
    expect(result).to.contain('Findings:');
    expect(result).to.contain('Normal chest X-ray.');
  });

  it('should render a PNAME item', () => {
    const item = {
      '0040A040': { vr: 'CS', Value: ['PNAME'] },
      '0040A043': codeSeq('Observer Name'),
      '0040A123': { vr: 'PN', Value: [{ Alphabetic: 'JONES^BOB' }] },
    };
    const result = srToText(srWithItem(item));
    expect(result).to.contain('JONES^BOB');
  });

  it('should render a DATETIME item', () => {
    const item = {
      '0040A040': { vr: 'CS', Value: ['DATETIME'] },
      '0040A043': codeSeq('Acquisition DateTime'),
      '0040A120': { vr: 'DT', Value: ['20241205142000'] },
    };
    expect(srToText(srWithItem(item))).to.contain('20241205142000');
  });

  it('should render a DATE item', () => {
    const item = {
      '0040A040': { vr: 'CS', Value: ['DATE'] },
      '0040A043': codeSeq('Study Date'),
      '0040A121': { vr: 'DA', Value: ['20241205'] },
    };
    expect(srToText(srWithItem(item))).to.contain('20241205');
  });

  it('should render a TIME item', () => {
    const item = {
      '0040A040': { vr: 'CS', Value: ['TIME'] },
      '0040A043': codeSeq('Study Time'),
      '0040A122': { vr: 'TM', Value: ['142000'] },
    };
    expect(srToText(srWithItem(item))).to.contain('142000');
  });

  it('should render a UIDREF item', () => {
    const item = {
      '0040A040': { vr: 'CS', Value: ['UIDREF'] },
      '0040A043': codeSeq('Referenced SOP Instance UID'),
      '0040A124': { vr: 'UI', Value: ['1.2.3.4.5'] },
    };
    expect(srToText(srWithItem(item))).to.contain('1.2.3.4.5');
  });

  it('should render a CODE item using Code Meaning', () => {
    const item = {
      '0040A040': { vr: 'CS', Value: ['CODE'] },
      '0040A043': codeSeq('Finding'),
      '0040A168': { vr: 'SQ', Value: [{ '00080104': { vr: 'LO', Value: ['Normal'] } }] },
    };
    expect(srToText(srWithItem(item))).to.contain('Normal');
  });

  it('should render a NUM item with value and unit', () => {
    const item = {
      '0040A040': { vr: 'CS', Value: ['NUM'] },
      '0040A043': codeSeq('Heart Rate'),
      '0040A300': {
        vr: 'SQ',
        Value: [
          {
            '0040A30A': { vr: 'DS', Value: ['72'] },
            '004008EA': {
              vr: 'SQ',
              Value: [{ '00080100': { vr: 'SH', Value: ['/min'] } }],
            },
          },
        ],
      },
    };
    expect(srToText(srWithItem(item))).to.contain('72 /min');
  });

  it('should render a NUM item without unit when unit is absent', () => {
    const item = {
      '0040A040': { vr: 'CS', Value: ['NUM'] },
      '0040A043': codeSeq('Count'),
      '0040A300': {
        vr: 'SQ',
        Value: [{ '0040A30A': { vr: 'DS', Value: ['5'] } }],
      },
    };
    expect(srToText(srWithItem(item))).to.contain('5');
  });

  it('should return empty string for a CONTAINER item body', () => {
    const sr = srWithItem(containerItem('Section', []));
    // Container with no children should produce no content lines
    const result = srToText(sr);
    expect(result).to.equal('');
  });

  it('should return a [VT not supported] placeholder for unknown value types', () => {
    const item = {
      '0040A040': { vr: 'CS', Value: ['WAVEFORM'] },
      '0040A043': codeSeq('ECG'),
    };
    expect(srToText(srWithItem(item))).to.contain('[WAVEFORM not supported]');
  });

  it('should prefix HAS OBS CONTEXT items with "Observation Context"', () => {
    const item = {
      '0040A040': { vr: 'CS', Value: ['TEXT'] },
      '0040A043': codeSeq('Observer Type'),
      '0040A010': { vr: 'CS', Value: ['HAS OBS CONTEXT'] },
      '0040A160': { vr: 'UT', Value: ['Person'] },
    };
    const result = srToText({ '0040A730': { vr: 'SQ', Value: [item] } });
    expect(result).to.contain('Observation Context: Observer Type = Person');
  });

  it('should prefix HAS ACQ CONTEXT items with "Acquisition Context"', () => {
    const item = {
      '0040A040': { vr: 'CS', Value: ['TEXT'] },
      '0040A043': codeSeq('Acquisition Protocol'),
      '0040A010': { vr: 'CS', Value: ['HAS ACQ CONTEXT'] },
      '0040A160': { vr: 'UT', Value: ['Standard'] },
    };
    const result = srToText({ '0040A730': { vr: 'SQ', Value: [item] } });
    expect(result).to.contain('Acquisition Context: Acquisition Protocol = Standard');
  });

  it('should recurse into nested CONTAINER items', () => {
    const inner = textItem('Impression', 'No acute findings.');
    const outer = containerItem('Report Body', [inner]);
    const result = srToText({ '0040A730': { vr: 'SQ', Value: [outer] } });
    expect(result).to.contain('Impression:');
    expect(result).to.contain('No acute findings.');
  });

  it('should concatenate CONTINUOUS container text into a single paragraph', () => {
    const items = [textItem('', 'The lungs are clear.'), textItem('', 'No pleural effusion.')];
    const sr = {
      '0040A050': { vr: 'CS', Value: ['CONTINUOUS'] },
      '0040A730': { vr: 'SQ', Value: items },
    };
    const result = srToText(sr);
    // Both sentences should appear in the output joined, not on separate lines
    expect(result).to.contain('The lungs are clear.');
    expect(result).to.contain('No pleural effusion.');
    const lines = result.split('\n').filter((l) => l.trim());
    const textLines = lines.filter((l) => l.includes('The lungs') || l.includes('No pleural'));
    expect(textLines).to.have.lengthOf(1);
  });

  it('should return an empty string for an empty instance object', () => {
    expect(srToText({})).to.equal('');
  });

  it('should not throw for a minimal instance with only patient info', () => {
    const sr = {
      '00100010': { vr: 'PN', Value: [{ Alphabetic: 'TEST^PATIENT' }] },
      '00100020': { vr: 'LO', Value: ['T001'] },
    };
    expect(() => srToText(sr)).to.not.throw();
  });

  it('should omit a content item whose body is empty after trim', () => {
    const item = {
      '0040A040': { vr: 'CS', Value: ['TEXT'] },
      '0040A043': codeSeq('Empty'),
      '0040A160': { vr: 'UT', Value: ['   '] },
    };
    const result = srToText({ '0040A730': { vr: 'SQ', Value: [item] } });
    expect(result).to.not.contain('Empty:');
  });
});
