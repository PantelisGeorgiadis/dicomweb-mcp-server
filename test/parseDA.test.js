import { expect } from 'chai';

import { parseDA } from './../src/utils/parseDA.js';

describe('parseDA', () => {
  it('should parse a valid YYYYMMDD string into year, month, and day', () => {
    const result = parseDA('20240315', false);
    expect(result).to.deep.equal({ year: 2024, month: 3, day: 15 });
  });

  it('should parse the first day of the year correctly', () => {
    const result = parseDA('20000101', false);
    expect(result).to.deep.equal({ year: 2000, month: 1, day: 1 });
  });

  it('should parse the last day of the year correctly', () => {
    const result = parseDA('20231231', false);
    expect(result).to.deep.equal({ year: 2023, month: 12, day: 31 });
  });

  it('should parse Feb 29 in a leap year (divisible by 4) without throwing', () => {
    const result = parseDA('20240229', true);
    expect(result).to.deep.equal({ year: 2024, month: 2, day: 29 });
  });

  it('should parse Feb 29 in a century leap year (divisible by 400) without throwing', () => {
    const result = parseDA('20000229', true);
    expect(result).to.deep.equal({ year: 2000, month: 2, day: 29 });
  });

  it('should return undefined for a string shorter than 8 characters', () => {
    expect(parseDA('2024031', false)).to.be.undefined;
  });

  it('should return undefined for an empty string', () => {
    expect(parseDA('', false)).to.be.undefined;
  });

  it('should return undefined for null', () => {
    expect(parseDA(null, false)).to.be.undefined;
  });

  it('should return undefined for undefined', () => {
    expect(parseDA(undefined, false)).to.be.undefined;
  });

  it('should throw for a string shorter than 8 characters when validate is true', () => {
    expect(() => parseDA('2024031', true)).to.throw();
  });

  it('should throw for null when validate is true', () => {
    expect(() => parseDA(null, true)).to.throw();
  });

  it('should throw for an invalid calendar date (Feb 29 in a non-leap year) when validate is true', () => {
    expect(() => parseDA('20230229', true)).to.throw("invalid DA '20230229'");
  });

  it('should throw for an invalid month (13) when validate is true', () => {
    expect(() => parseDA('20241301', true)).to.throw("invalid DA '20241301'");
  });

  it('should throw for day 0 when validate is true', () => {
    expect(() => parseDA('20240300', true)).to.throw("invalid DA '20240300'");
  });

  it('should throw for Feb 29 in a non-leap century year (divisible by 100 but not 400) when validate is true', () => {
    expect(() => parseDA('19000229', true)).to.throw("invalid DA '19000229'");
  });

  it('should return undefined for a string longer than 8 characters when validate is false', () => {
    expect(parseDA('202403151', false)).to.be.undefined;
  });

  it('should throw for a string longer than 8 characters when validate is true', () => {
    expect(() => parseDA('202403151', true)).to.throw();
  });

  it('should return undefined for a number input when validate is false', () => {
    expect(parseDA(20240315, false)).to.be.undefined;
  });

  it('should throw for a number input when validate is true', () => {
    expect(() => parseDA(20240315, true)).to.throw();
  });

  it('should return undefined for an object input when validate is false', () => {
    expect(parseDA({}, false)).to.be.undefined;
  });

  it('should not throw for a semantically invalid date when validate is false', () => {
    expect(() => parseDA('20241301', false)).to.not.throw();
  });

  it('should return parsed components for an invalid date when validate is false', () => {
    const result = parseDA('20241301', false);
    expect(result).to.deep.equal({ year: 2024, month: 13, day: 1 });
  });

  it('should throw for day 31 in a 30-day month (April) when validate is true', () => {
    expect(() => parseDA('20240431', true)).to.throw("invalid DA '20240431'");
  });

  it('should parse Feb 28 in a non-leap year correctly', () => {
    const result = parseDA('20230228', false);
    expect(result).to.deep.equal({ year: 2023, month: 2, day: 28 });
  });

  it('should parse the last day of a 30-day month (April 30) correctly', () => {
    const result = parseDA('20240430', false);
    expect(result).to.deep.equal({ year: 2024, month: 4, day: 30 });
  });

  it('should throw for day 31 in a 30-day month (April) and verify it is valid for a 31-day month (March)', () => {
    expect(() => parseDA('20240431', true)).to.throw();
    expect(parseDA('20240331', true)).to.deep.equal({ year: 2024, month: 3, day: 31 });
  });

  it('should return undefined for an 8-character string starting with non-numeric characters when validate is false', () => {
    const result = parseDA('abcd0101', false);
    expect(result).to.exist;
    expect(result.year).to.be.NaN;
  });

  it('should throw for an 8-character string with non-numeric characters when validate is true', () => {
    expect(() => parseDA('abcd0101', true)).to.throw();
  });
});
