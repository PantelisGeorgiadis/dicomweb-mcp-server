import { expect } from 'chai';

import {
  dicomPersonName,
  dicomVal,
  formatDicomDate,
  formatDicomDateTime,
  formatDicomTime,
} from './../src/utils/utils.js';

describe('dicomVal', () => {
  it('should return the value of a single-value tag', () => {
    const item = { '00100020': { vr: 'LO', Value: ['12345'] } };
    expect(dicomVal(item, '00100020')).to.equal('12345');
  });

  it('should return all values joined by "/" when there are multiple values', () => {
    const item = { '00080060': { vr: 'CS', Value: ['CT', 'MR'] } };
    expect(dicomVal(item, '00080060')).to.equal('CT/MR');
  });

  it('should return empty string when the tag is absent', () => {
    expect(dicomVal({}, '00100020')).to.equal('');
  });

  it('should return empty string when Value array is empty', () => {
    const item = { '00100020': { vr: 'LO', Value: [] } };
    expect(dicomVal(item, '00100020')).to.equal('');
  });

  it('should return empty string when Value is missing from the tag', () => {
    const item = { '00100020': { vr: 'LO' } };
    expect(dicomVal(item, '00100020')).to.equal('');
  });
});

describe('dicomPersonName', () => {
  it('should return the Alphabetic component of a PN value', () => {
    const item = { '00100010': { vr: 'PN', Value: [{ Alphabetic: 'SMITH^JOHN' }] } };
    expect(dicomPersonName(item, '00100010')).to.equal('SMITH^JOHN');
  });

  it('should return empty string when the Alphabetic component is absent', () => {
    const item = { '00100010': { vr: 'PN', Value: [{}] } };
    expect(dicomPersonName(item, '00100010')).to.equal('');
  });

  it('should return empty string when the Value array is empty', () => {
    const item = { '00100010': { vr: 'PN', Value: [] } };
    expect(dicomPersonName(item, '00100010')).to.equal('');
  });

  it('should return empty string when the tag is absent', () => {
    expect(dicomPersonName({}, '00100010')).to.equal('');
  });
});

describe('formatDicomDate', () => {
  it('should format a valid YYYYMMDD string as YYYY-MM-DD', () => {
    expect(formatDicomDate('20240315')).to.equal('2024-03-15');
  });

  it('should zero-pad single-digit months and days', () => {
    expect(formatDicomDate('20000101')).to.equal('2000-01-01');
  });

  it('should return null for an empty string', () => {
    expect(formatDicomDate('')).to.be.null;
  });

  it('should return null for null input', () => {
    expect(formatDicomDate(null)).to.be.null;
  });

  it('should return null for undefined input', () => {
    expect(formatDicomDate(undefined)).to.be.null;
  });

  it('should return null for a string shorter than 8 characters', () => {
    expect(formatDicomDate('2024031')).to.be.null;
  });
});

describe('formatDicomDateTime', () => {
  it('should format a valid date and time as an ISO 8601 datetime string', () => {
    expect(formatDicomDateTime('20240315', '143022')).to.equal('2024-03-15T14:30:22');
  });

  it('should return just the date when time is an empty string', () => {
    expect(formatDicomDateTime('20240315', '')).to.equal('2024-03-15');
  });

  it('should return just the date when time is null', () => {
    expect(formatDicomDateTime('20240315', null)).to.equal('2024-03-15');
  });

  it('should return just the date when time is undefined', () => {
    expect(formatDicomDateTime('20240315', undefined)).to.equal('2024-03-15');
  });

  it('should return null when the date is empty', () => {
    expect(formatDicomDateTime('', '143022')).to.be.null;
  });

  it('should return null when the date is null', () => {
    expect(formatDicomDateTime(null, '143022')).to.be.null;
  });

  it('should zero-pad hours, minutes, and seconds', () => {
    expect(formatDicomDateTime('20240315', '010203')).to.equal('2024-03-15T01:02:03');
  });

  it('should handle a time string with fractional seconds', () => {
    expect(formatDicomDateTime('20240315', '143022.123456')).to.equal('2024-03-15T14:30:22');
  });

  it('should handle an hours-only time string (HH)', () => {
    expect(formatDicomDateTime('20240315', '14')).to.equal('2024-03-15T14:00:00');
  });

  it('should return just the date when the time string is too short to parse', () => {
    // parseTM requires at least 2 characters; a single char returns undefined
    expect(formatDicomDateTime('20240315', '1')).to.equal('2024-03-15');
  });
});

describe('formatDicomTime', () => {
  it('should format HHMMSS as HH:MM:SS', () => {
    expect(formatDicomTime('143022')).to.equal('14:30:22');
  });

  it('should zero-pad single-digit hours', () => {
    expect(formatDicomTime('090000')).to.equal('09:00:00');
  });

  it('should format an HH-only string as HH:00:00', () => {
    expect(formatDicomTime('14')).to.equal('14:00:00');
  });

  it('should ignore fractional seconds', () => {
    expect(formatDicomTime('143022.123456')).to.equal('14:30:22');
  });

  it('should return null for an empty string', () => {
    expect(formatDicomTime('')).to.be.null;
  });

  it('should return null for null input', () => {
    expect(formatDicomTime(null)).to.be.null;
  });

  it('should return null for undefined input', () => {
    expect(formatDicomTime(undefined)).to.be.null;
  });

  it('should return null for a string shorter than 2 characters', () => {
    expect(formatDicomTime('1')).to.be.null;
  });
});
