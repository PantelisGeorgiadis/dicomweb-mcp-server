import { expect } from 'chai';

import { parseTM } from './../src/utils/parseTM.js';

describe('parseTM', () => {
  it('should parse a full HHMMSS string into hours, minutes, and seconds', () => {
    const result = parseTM('143022', false);
    expect(result).to.include({ hours: 14, minutes: 30, seconds: 22 });
    expect(result.fractionalSeconds).to.be.undefined;
  });

  it('should parse an HH-only string and leave minutes and seconds undefined', () => {
    const result = parseTM('09', false);
    expect(result).to.include({ hours: 9 });
    expect(result.minutes).to.be.undefined;
    expect(result.seconds).to.be.undefined;
  });

  it('should parse an HHMM string and leave seconds undefined', () => {
    const result = parseTM('1430', false);
    expect(result).to.include({ hours: 14, minutes: 30 });
    expect(result.seconds).to.be.undefined;
  });

  it('should parse fractional seconds from HHMMSS.ffffff', () => {
    const result = parseTM('143022.123456', false);
    expect(result).to.include({ hours: 14, minutes: 30, seconds: 22 });
    expect(result.fractionalSeconds).to.equal(123456);
  });

  it('should correctly scale a short fractional string to microseconds', () => {
    // '.1' → 100000 µs
    const result = parseTM('143022.1', false);
    expect(result.fractionalSeconds).to.equal(100000);
  });

  it('should parse midnight (000000) correctly', () => {
    const result = parseTM('000000', false);
    expect(result).to.include({ hours: 0, minutes: 0, seconds: 0 });
  });

  it('should parse end-of-day (235959) correctly', () => {
    const result = parseTM('235959', false);
    expect(result).to.include({ hours: 23, minutes: 59, seconds: 59 });
  });

  it('should return undefined for a string shorter than 2 characters', () => {
    expect(parseTM('1', false)).to.be.undefined;
  });

  it('should return undefined for an empty string', () => {
    expect(parseTM('', false)).to.be.undefined;
  });

  it('should return undefined for null', () => {
    expect(parseTM(null, false)).to.be.undefined;
  });

  it('should return undefined for undefined', () => {
    expect(parseTM(undefined, false)).to.be.undefined;
  });

  it('should throw for an empty string when validate is true', () => {
    expect(() => parseTM('', true)).to.throw("invalid TM ''");
  });

  it('should throw for null when validate is true', () => {
    expect(() => parseTM(null, true)).to.throw();
  });

  it('should throw for undefined when validate is true', () => {
    expect(() => parseTM(undefined, true)).to.throw();
  });

  it('should throw for a string shorter than 2 characters when validate is true', () => {
    expect(() => parseTM('1', true)).to.throw("invalid TM '1'");
  });

  it('should throw for hours > 23 when validate is true', () => {
    expect(() => parseTM('240000', true)).to.throw("invalid TM '240000'");
  });

  it('should throw for minutes > 59 when validate is true', () => {
    expect(() => parseTM('146000', true)).to.throw("invalid TM '146000'");
  });

  it('should throw for seconds > 59 when validate is true', () => {
    expect(() => parseTM('143060', true)).to.throw("invalid TM '143060'");
  });

  it('should not throw for a valid HHMMSS string when validate is true', () => {
    expect(() => parseTM('143022', true)).to.not.throw();
  });
});
