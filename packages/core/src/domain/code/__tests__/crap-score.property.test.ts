import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { calculateCrapScore } from '../code-evaluation-service';

/**
 * Property-based tests for the CRAP score.
 *
 * The catalog defines CRAP = complexity² × (1 − coverage ÷ 100)³ + complexity,
 * rounded to one decimal, with coverage clamped to 0–100. These properties
 * encode the mathematical consequences of that formula independently of the
 * implementation, so a drift in the formula (wrong exponent, missing clamp,
 * wrong sign) fails without re-stating the exact expression.
 */

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

describe('calculateCrapScore', () => {
  it('clamps coverage below zero to zero', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 1, max: 1000 }),
        (complexity, below) => {
          expect(calculateCrapScore(complexity, -below)).toBe(calculateCrapScore(complexity, 0));
        }
      )
    );
  });

  it('clamps coverage above 100 to 100', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 1, max: 1000 }),
        (complexity, above) => {
          expect(calculateCrapScore(complexity, 100 + above)).toBe(
            calculateCrapScore(complexity, 100)
          );
        }
      )
    );
  });

  it('returns complexity alone at full coverage', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 50 }), (complexity) => {
        expect(calculateCrapScore(complexity, 100)).toBe(round1(complexity));
      })
    );
  });

  it('returns complexity squared plus complexity at zero coverage', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 50 }), (complexity) => {
        expect(calculateCrapScore(complexity, 0)).toBe(
          round1(complexity * complexity + complexity)
        );
      })
    );
  });

  it('increases strictly with complexity while coverage is below 100', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 49 }),
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 0, max: 99 }),
        (base, delta, coverage) => {
          const lower = calculateCrapScore(base, coverage);
          const higher = calculateCrapScore(base + delta, coverage);
          expect(higher).toBeGreaterThan(lower);
        }
      )
    );
  });

  it('never increases as coverage rises for a fixed complexity', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 0, max: 99 }),
        fc.integer({ min: 1, max: 100 }),
        (complexity, lowerCoverage, delta) => {
          const higherCoverage = Math.min(lowerCoverage + delta, 100);
          expect(calculateCrapScore(complexity, lowerCoverage)).toBeGreaterThanOrEqual(
            calculateCrapScore(complexity, higherCoverage)
          );
        }
      )
    );
  });

  it('is never below its complexity', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 0, max: 100 }),
        (complexity, coverage) => {
          expect(calculateCrapScore(complexity, coverage)).toBeGreaterThanOrEqual(complexity);
        }
      )
    );
  });
});
