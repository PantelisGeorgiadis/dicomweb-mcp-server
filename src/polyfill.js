// Minimal DOMMatrix polyfill for Node.js environments that lack it.
// pdfjs-dist (used by pdf-parse) contains a module-level `new DOMMatrix()` in its
// legacy build, which throws a ReferenceError on Node.js versions that do not expose
// the Web API globally.  This polyfill implements the 2-D affine subset of the
// DOMMatrix spec that pdfjs-dist relies on and must be evaluated before pdfjs-dist
// is first imported.
if (typeof globalThis.DOMMatrix === 'undefined') {
  class DOMMatrix {
    /**
     * @param {number[]} [init] - Optional 6-element array [a, b, c, d, e, f].
     */
    constructor(init) {
      // Default: 2-D identity matrix
      this.a = 1;
      this.b = 0;
      this.c = 0;
      this.d = 1;
      this.e = 0;
      this.f = 0;
      if (Array.isArray(init) && init.length === 6) {
        [this.a, this.b, this.c, this.d, this.e, this.f] = init;
      }
    }

    // Post-multiply self by scale(sx, sy) in-place and return self.
    scaleSelf(sx, sy = sx) {
      this.a *= sx;
      this.b *= sx;
      this.c *= sy;
      this.d *= sy;

      return this;
    }

    // Post-multiply self by translate(tx, ty) in-place and return self.
    translateSelf(tx = 0, ty = 0) {
      this.e += this.a * tx + this.c * ty;
      this.f += this.b * tx + this.d * ty;
      
      return this;
    }

    // Invert the 2-D affine matrix in-place and return self.
    invertSelf() {
      const det = this.a * this.d - this.b * this.c;
      if (det !== 0) {
        const { a, b, c, d, e, f } = this;
        this.a = d / det;
        this.b = -b / det;
        this.c = -c / det;
        this.d = a / det;
        this.e = (c * f - d * e) / det;
        this.f = (b * e - a * f) / det;
      }

      return this;
    }

    // Post-multiply self by other (self = self × other) in-place and return self.
    multiplySelf(o) {
      const a = this.a * o.a + this.c * o.b;
      const b = this.b * o.a + this.d * o.b;
      const c = this.a * o.c + this.c * o.d;
      const d = this.b * o.c + this.d * o.d;
      const e = this.a * o.e + this.c * o.f + this.e;
      const f = this.b * o.e + this.d * o.f + this.f;
      this.a = a;
      this.b = b;
      this.c = c;
      this.d = d;
      this.e = e;
      this.f = f;

      return this;
    }

    // Pre-multiply self by other (self = other × self) in-place and return self.
    preMultiplySelf(o) {
      const a = o.a * this.a + o.c * this.b;
      const b = o.b * this.a + o.d * this.b;
      const c = o.a * this.c + o.c * this.d;
      const d = o.b * this.c + o.d * this.d;
      const e = o.a * this.e + o.c * this.f + o.e;
      const f = o.b * this.e + o.d * this.f + o.f;
      this.a = a;
      this.b = b;
      this.c = c;
      this.d = d;
      this.e = e;
      this.f = f;

      return this;
    }

    // Return a new matrix that is self post-multiplied by translate(tx, ty).
    translate(tx = 0, ty = 0) {
      return new DOMMatrix([
        this.a,
        this.b,
        this.c,
        this.d,
        this.a * tx + this.c * ty + this.e,
        this.b * tx + this.d * ty + this.f,
      ]);
    }

    // Return a new matrix that is self post-multiplied by scale(sx, sy).
    scale(sx, sy = sx) {
      return new DOMMatrix([this.a * sx, this.b * sx, this.c * sy, this.d * sy, this.e, this.f]);
    }
  }

  globalThis.DOMMatrix = DOMMatrix;
}
