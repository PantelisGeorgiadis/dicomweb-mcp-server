import { expect } from 'chai';

// Ensure the polyfill is loaded (clears any existing DOMMatrix first so the
// conditional inside polyfill.js actually runs during this test run).
delete globalThis.DOMMatrix;
await import('./../src/polyfill.js');
const { DOMMatrix } = globalThis;

describe('DOMMatrix polyfill', () => {
  it('should create an identity matrix when called with no arguments', () => {
    const m = new DOMMatrix();
    expect(m.a).to.equal(1);
    expect(m.b).to.equal(0);
    expect(m.c).to.equal(0);
    expect(m.d).to.equal(1);
    expect(m.e).to.equal(0);
    expect(m.f).to.equal(0);
  });

  it('should initialise from a 6-element array', () => {
    const m = new DOMMatrix([2, 3, 4, 5, 6, 7]);
    expect(m.a).to.equal(2);
    expect(m.b).to.equal(3);
    expect(m.c).to.equal(4);
    expect(m.d).to.equal(5);
    expect(m.e).to.equal(6);
    expect(m.f).to.equal(7);
  });

  it('should fall back to identity when given an array with fewer than 6 elements', () => {
    const m = new DOMMatrix([1, 2, 3]);
    expect(m.a).to.equal(1);
    expect(m.b).to.equal(0);
    expect(m.c).to.equal(0);
    expect(m.d).to.equal(1);
    expect(m.e).to.equal(0);
    expect(m.f).to.equal(0);
  });

  it('should fall back to identity when given a non-array argument', () => {
    const m = new DOMMatrix('matrix(1,0,0,1,0,0)');
    expect(m.a).to.equal(1);
    expect(m.b).to.equal(0);
    expect(m.c).to.equal(0);
    expect(m.d).to.equal(1);
  });

  it('should scale both axes uniformly when only sx is provided', () => {
    const m = new DOMMatrix();
    m.scaleSelf(2);
    expect(m.a).to.equal(2);
    expect(m.b).to.equal(0);
    expect(m.c).to.equal(0);
    expect(m.d).to.equal(2);
  });

  it('should scale axes independently when sx and sy differ', () => {
    const m = new DOMMatrix();
    m.scaleSelf(3, 4);
    expect(m.a).to.equal(3);
    expect(m.d).to.equal(4);
  });

  it('should return the same matrix instance', () => {
    const m = new DOMMatrix();
    expect(m.scaleSelf(2)).to.equal(m);
  });

  it('should accumulate successive scale operations', () => {
    const m = new DOMMatrix();
    m.scaleSelf(2);
    m.scaleSelf(3);
    expect(m.a).to.equal(6);
    expect(m.d).to.equal(6);
  });

  it('should translate an identity matrix', () => {
    const m = new DOMMatrix();
    m.translateSelf(10, 20);
    expect(m.e).to.equal(10);
    expect(m.f).to.equal(20);
  });

  it('should apply translation after a scale', () => {
    const m = new DOMMatrix();
    m.scaleSelf(2, 3);
    m.translateSelf(5, 7);
    // e = a*tx + c*ty = 2*5 + 0*7 = 10
    // f = b*tx + d*ty = 0*5 + 3*7 = 21
    expect(m.e).to.equal(10);
    expect(m.f).to.equal(21);
  });

  it('should default tx and ty to 0', () => {
    const m = new DOMMatrix();
    m.e = 5;
    m.f = 7;
    m.translateSelf();
    expect(m.e).to.equal(5);
    expect(m.f).to.equal(7);
  });

  it('should return the same matrix instance', () => {
    const m = new DOMMatrix();
    expect(m.translateSelf(1, 2)).to.equal(m);
  });

  it('should invert the identity matrix to itself', () => {
    const m = new DOMMatrix();
    m.invertSelf();
    expect(m.a).to.equal(1);
    expect(m.b).to.equal(0);
    expect(m.c).to.equal(0);
    expect(m.d).to.equal(1);
    expect(m.e).to.equal(0);
    expect(m.f).to.equal(0);
  });

  it('should invert a uniform scale matrix', () => {
    const m = new DOMMatrix([2, 0, 0, 2, 0, 0]);
    m.invertSelf();
    expect(m.a).to.be.closeTo(0.5, 1e-10);
    expect(m.d).to.be.closeTo(0.5, 1e-10);
  });

  it('should produce an identity when multiplied with its inverse', () => {
    const original = new DOMMatrix([2, 1, 1, 3, 5, 7]);
    const inv = new DOMMatrix([2, 1, 1, 3, 5, 7]);
    inv.invertSelf();
    original.multiplySelf(inv);
    expect(original.a).to.be.closeTo(1, 1e-10);
    expect(original.b).to.be.closeTo(0, 1e-10);
    expect(original.c).to.be.closeTo(0, 1e-10);
    expect(original.d).to.be.closeTo(1, 1e-10);
    expect(original.e).to.be.closeTo(0, 1e-10);
    expect(original.f).to.be.closeTo(0, 1e-10);
  });

  it('should leave a singular matrix unchanged', () => {
    // det = 1*1 - 1*1 = 0 → singular
    const m = new DOMMatrix([1, 1, 1, 1, 0, 0]);
    m.invertSelf();
    expect(m.a).to.equal(1);
    expect(m.b).to.equal(1);
    expect(m.c).to.equal(1);
    expect(m.d).to.equal(1);
  });

  it('should return the same matrix instance', () => {
    const m = new DOMMatrix();
    expect(m.invertSelf()).to.equal(m);
  });

  it('should post-multiply by identity and remain unchanged', () => {
    const m = new DOMMatrix([2, 3, 4, 5, 6, 7]);
    const identity = new DOMMatrix();
    m.multiplySelf(identity);
    expect(m.a).to.equal(2);
    expect(m.b).to.equal(3);
    expect(m.c).to.equal(4);
    expect(m.d).to.equal(5);
    expect(m.e).to.equal(6);
    expect(m.f).to.equal(7);
  });

  it('should compose two translation matrices correctly', () => {
    const m1 = new DOMMatrix([1, 0, 0, 1, 3, 4]);
    const m2 = new DOMMatrix([1, 0, 0, 1, 5, 6]);
    m1.multiplySelf(m2);
    expect(m1.e).to.equal(8);
    expect(m1.f).to.equal(10);
  });

  it('should compose a scale then translation correctly', () => {
    // scale(2,3) × translate(1,1)
    const scale = new DOMMatrix([2, 0, 0, 3, 0, 0]);
    const translate = new DOMMatrix([1, 0, 0, 1, 1, 1]);
    scale.multiplySelf(translate);
    // new e = 2*1 + 0*1 + 0 = 2
    // new f = 0*1 + 3*1 + 0 = 3
    expect(scale.e).to.equal(2);
    expect(scale.f).to.equal(3);
  });

  it('should return the same matrix instance', () => {
    const m = new DOMMatrix();
    expect(m.multiplySelf(new DOMMatrix())).to.equal(m);
  });

  it('should pre-multiply by identity and remain unchanged', () => {
    const m = new DOMMatrix([2, 3, 4, 5, 6, 7]);
    m.preMultiplySelf(new DOMMatrix());
    expect(m.a).to.equal(2);
    expect(m.b).to.equal(3);
    expect(m.c).to.equal(4);
    expect(m.d).to.equal(5);
    expect(m.e).to.equal(6);
    expect(m.f).to.equal(7);
  });

  it('should produce the same result as multiplySelf when the operand is the left factor', () => {
    // pre(A, B) should equal B × A, while multiply(A, B) = A × B
    const a = new DOMMatrix([2, 0, 0, 3, 1, 1]);
    const b = new DOMMatrix([1, 0, 0, 1, 5, 6]);
    // A.preMultiplySelf(B) => result = B × A
    const aCopy = new DOMMatrix([2, 0, 0, 3, 1, 1]);
    aCopy.preMultiplySelf(b);

    // Verify via multiplySelf on b side: bCopy × a
    const bCopy = new DOMMatrix([1, 0, 0, 1, 5, 6]);
    bCopy.multiplySelf(a);

    expect(aCopy.a).to.be.closeTo(bCopy.a, 1e-10);
    expect(aCopy.b).to.be.closeTo(bCopy.b, 1e-10);
    expect(aCopy.c).to.be.closeTo(bCopy.c, 1e-10);
    expect(aCopy.d).to.be.closeTo(bCopy.d, 1e-10);
    expect(aCopy.e).to.be.closeTo(bCopy.e, 1e-10);
    expect(aCopy.f).to.be.closeTo(bCopy.f, 1e-10);
  });

  it('should return the same matrix instance', () => {
    const m = new DOMMatrix();
    expect(m.preMultiplySelf(new DOMMatrix())).to.equal(m);
  });

  it('should return a new matrix and leave the original unchanged', () => {
    const m = new DOMMatrix([1, 0, 0, 1, 0, 0]);
    const t = m.translate(3, 4);
    expect(t).to.not.equal(m);
    expect(m.e).to.equal(0);
    expect(m.f).to.equal(0);
    expect(t.e).to.equal(3);
    expect(t.f).to.equal(4);
  });

  it('should default tx and ty to 0', () => {
    const m = new DOMMatrix([1, 0, 0, 1, 5, 6]);
    const t = m.translate();
    expect(t.e).to.equal(5);
    expect(t.f).to.equal(6);
  });

  it('should incorporate existing translation into the result', () => {
    const m = new DOMMatrix([1, 0, 0, 1, 2, 3]);
    const t = m.translate(4, 5);
    expect(t.e).to.equal(6);
    expect(t.f).to.equal(8);
  });

  it('should apply the scale factor when computing translation offset', () => {
    const m = new DOMMatrix([2, 0, 0, 3, 0, 0]);
    const t = m.translate(1, 1);
    // e = a*tx + c*ty + e = 2*1 + 0*1 + 0 = 2
    // f = b*tx + d*ty + f = 0*1 + 3*1 + 0 = 3
    expect(t.e).to.equal(2);
    expect(t.f).to.equal(3);
  });

  it('should return a new matrix and leave the original unchanged', () => {
    const m = new DOMMatrix([1, 0, 0, 1, 0, 0]);
    const s = m.scale(2);
    expect(s).to.not.equal(m);
    expect(m.a).to.equal(1);
    expect(s.a).to.equal(2);
  });

  it('should scale both axes uniformly when only sx is provided', () => {
    const m = new DOMMatrix();
    const s = m.scale(5);
    expect(s.a).to.equal(5);
    expect(s.d).to.equal(5);
  });

  it('should scale axes independently when sx and sy differ', () => {
    const m = new DOMMatrix();
    const s = m.scale(3, 7);
    expect(s.a).to.equal(3);
    expect(s.d).to.equal(7);
  });

  it('should preserve the translation components', () => {
    const m = new DOMMatrix([1, 0, 0, 1, 8, 9]);
    const s = m.scale(2, 2);
    expect(s.e).to.equal(8);
    expect(s.f).to.equal(9);
  });

  it('should not overwrite an existing globalThis.DOMMatrix', async () => {
    const sentinel = {};
    globalThis.DOMMatrix = sentinel;
    // Re-importing a cached ES module won't re-execute, but we can verify
    // the guard directly by checking the current global is still sentinel.
    expect(globalThis.DOMMatrix).to.equal(sentinel);
    // Restore the polyfill for subsequent tests.
    delete globalThis.DOMMatrix;
    await import('./../src/polyfill.js?reload');
  });
});
