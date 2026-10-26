/**
 * Calculator tests use SYNTHETIC values only (the fictional "Demonstrol" and made-up regimens).
 * Expected results are arithmetic, not clinical judgements.
 */
import Decimal from 'decimal.js';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { calculateDose, calculatorAvailable, convert, type DoseInput } from '../../src/calculations/dose.ts';
import type { Dosing, Formulation, Medication, Regimen } from '../../src/content/types.ts';
import { clone, readContent } from '../helpers.ts';

const demo = readContent('examples/medications/demonstrol.json') as Medication;
const child = () => clone(demo.regimens[0]!) as Regimen; // 1.5 mg/kg, max 60 mg, 3–40 kg, round to 1 mg, 240 mg/24 h
const input = (over: Partial<DoseInput> = {}): DoseInput => ({
  weightKg: '20',
  population: 'child',
  formulationId: null,
  alreadyGiven: '',
  ...over,
});
type WB = Extract<Dosing, { type: 'weight-based' }>;
const wb = (r: Regimen) => r.dosing as WB;

describe('dose calculator (synthetic)', () => {
  it('shows the working', () => {
    const r = calculateDose(child(), demo.formulations, input());
    expect(r.ok && r.dose).toEqual({ amount: '30', unit: 'mg' });
    expect(r.ok && r.working[0]).toBe('1.5 mg/kg × 20 kg = 30 mg');
    expect(r.ok && r.stop).toBeNull();
  });

  it('applies the source rounding rule and says so', () => {
    const r = calculateDose(child(), demo.formulations, input({ weightKg: '13.3' })); // 19.95 → 20
    expect(r.ok && r.dose.amount).toBe('20');
    expect(r.ok && r.working[1]).toMatch(/Rounded to the nearest 1 mg/);
  });

  it('does not round when the source gives no rule', () => {
    const reg = child();
    wb(reg).rounding = null;
    const r = calculateDose(reg, demo.formulations, input({ weightKg: '13.3' }));
    expect(r.ok && r.dose.amount).toBe('19.95');
    expect(r.ok && r.notes).toContain('No rounding rule in the source: the dose is shown unrounded.');
  });

  it('hard stop above the maximum single dose, and exactly at the maximum is allowed', () => {
    const atMax = calculateDose(child(), demo.formulations, input({ weightKg: '40' })); // 60 mg
    expect(atMax.ok && atMax.stop).toBeNull();
    const reg = child();
    wb(reg).applicableWeightKg = null;
    const over = calculateDose(reg, demo.formulations, input({ weightKg: '41' })); // 61.5 → 62 mg
    expect(over.ok && over.stop?.reason).toBe('exceeds-max');
    expect(over.ok && over.volume).toBeNull();
  });

  it('rounding that pushes the dose over the maximum is still a hard stop', () => {
    const reg = child();
    wb(reg).applicableWeightKg = null;
    wb(reg).rounding = { mode: 'nearest', increment: 5, unit: 'mg' };
    const r = calculateDose(reg, demo.formulations, input({ weightKg: '39' })); // 58.5 → 60 ok
    expect(r.ok && r.stop).toBeNull();
    wb(reg).maxSingleDose = { amount: 59, unit: 'mg' };
    const r2 = calculateDose(reg, demo.formulations, input({ weightKg: '39' })); // 60 > 59
    expect(r2.ok && r2.stop?.reason).toBe('exceeds-max');
  });

  it('hard stop below the minimum dose', () => {
    const reg = child();
    wb(reg).minSingleDose = { amount: 10, unit: 'mg' };
    const r = calculateDose(reg, demo.formulations, input({ weightKg: '5' })); // 7.5 → 8 mg
    expect(r.ok && r.stop?.reason).toBe('below-min');
  });

  it('hard stop outside the weight range', () => {
    const r = calculateDose(child(), demo.formulations, input({ weightKg: '2.9' }));
    expect(r.ok && r.stop?.reason).toBe('weight-out-of-range');
    const r2 = calculateDose(child(), demo.formulations, input({ weightKg: '40.1' }));
    expect(r2.ok && r2.stop?.reason).toBe('weight-out-of-range');
  });

  it('cumulative limit check uses the amount already given', () => {
    const ok = calculateDose(child(), demo.formulations, input({ alreadyGiven: '210' })); // 210 + 30 = 240
    expect(ok.ok && ok.stop).toBeNull();
    const over = calculateDose(child(), demo.formulations, input({ alreadyGiven: '211' }));
    expect(over.ok && over.stop?.reason).toBe('exceeds-cumulative');
  });

  it('volume only from an explicitly chosen, fully entered formulation', () => {
    const none = calculateDose(child(), demo.formulations, input());
    expect(none.ok && none.volume).toBeNull();
    expect(none.ok && none.volumeNote).toMatch(/never assumed/);
    const liquid = calculateDose(child(), demo.formulations, input({ formulationId: 'demonstrol-liquid' }));
    expect(liquid.ok && liquid.volume).toMatchObject({ amount: '15', unit: 'mL' }); // 30 mg ÷ (10 mg/5 mL)
    expect(liquid.ok && liquid.volume?.working).toBe('30 mg ÷ (10 mg per 5 mL) = 15 mL');
    const missing = clone(demo.formulations) as Formulation[];
    missing[0]!.strength.amount = null;
    const noConc = calculateDose(child(), missing, input({ formulationId: 'demonstrol-liquid' }));
    expect(noConc.ok && noConc.volume).toBeNull();
    expect(noConc.ok && noConc.volumeNote).toMatch(/concentration has not been entered/);
    const wrong = calculateDose(child(), demo.formulations, input({ formulationId: 'demonstrol-tablet' }));
    expect(wrong.ok && wrong.volumeNote).toMatch(/not listed/);
  });

  it('refuses when required values are missing — never substitutes defaults', () => {
    const reg = child();
    wb(reg).dosePerKg = { amount: null, unit: 'mg' };
    wb(reg).maxSingleDose = { amount: null, unit: 'mg' };
    const r = calculateDose(reg, demo.formulations, input());
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reasons).toEqual(
      expect.arrayContaining([
        'The dose per kg has not been entered from the source.',
        'The maximum single dose has not been entered from the source.',
      ]),
    );
  });

  it('refuses invalid weights, wrong population, unconvertible units and non-weight regimens', () => {
    for (const w of ['', 'abc', '-5', '0', '1e3', '20kg', '2,5']) {
      expect(calculateDose(child(), demo.formulations, input({ weightKg: w })).ok, w).toBe(false);
    }
    expect(calculateDose(child(), demo.formulations, input({ population: 'adult' })).ok).toBe(false);
    expect(calculateDose(child(), demo.formulations, input({ population: null })).ok).toBe(false);
    const reg = child();
    wb(reg).maxSingleDose = { amount: 5, unit: 'mL' };
    const r = calculateDose(reg, demo.formulations, input());
    expect(!r.ok && r.reasons.join(' ')).toMatch(/cannot be converted/);
    expect(
      calculateDose(clone(demo.regimens[1]!) as Regimen, demo.formulations, input({ population: 'adult' })).ok,
    ).toBe(false);
  });

  it('converts mass units exactly (no floating point error)', () => {
    expect(convert(new Decimal('0.1'), 'g', 'mg')!.toString()).toBe('100');
    expect(convert(new Decimal('250'), 'microgram', 'mg')!.toString()).toBe('0.25');
    expect(convert(new Decimal('1'), 'mg', 'mL')).toBeNull();
    const reg = child();
    wb(reg).dosePerKg = { amount: 0.1, unit: 'mg' };
    wb(reg).rounding = null;
    wb(reg).maxSingleDose = { amount: 0.003, unit: 'g' }; // 3 mg
    const r = calculateDose(reg, demo.formulations, input({ weightKg: '30' })); // 0.1 × 30 = 3 exactly (float gives 3.0000000000000004)
    expect(r.ok && r.dose.amount).toBe('3');
    expect(r.ok && r.stop).toBeNull();
  });

  it('property: never returns a dose above the maximum without a hard stop', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 2000 }).map((n) => (n / 10).toString()), // 0.1–200 kg
        fc.integer({ min: 1, max: 500 }).map((n) => n / 100), // 0.01–5 mg/kg
        fc.integer({ min: 1, max: 1000 }), // max mg
        fc.constantFrom(null, 1, 0.5, 5),
        (weight, perKg, maxMg, inc) => {
          const reg = child();
          wb(reg).applicableWeightKg = null;
          wb(reg).maxCumulative = null;
          wb(reg).dosePerKg = { amount: perKg, unit: 'mg' };
          wb(reg).maxSingleDose = { amount: maxMg, unit: 'mg' };
          wb(reg).rounding = inc === null ? null : { mode: 'nearest', increment: inc, unit: 'mg' };
          const r = calculateDose(reg, demo.formulations, input({ weightKg: weight }));
          expect(r.ok).toBe(true);
          if (r.ok && r.stop === null) expect(new Decimal(r.dose.amount).lte(maxMg)).toBe(true);
          if (r.ok && new Decimal(r.dose.amount).gt(maxMg)) expect(r.stop?.reason).toBe('exceeds-max');
        },
      ),
    );
  });

  it('is only available for demonstration medicines in preview builds', () => {
    expect(calculatorAvailable(demo, 'preview')).toBe(true);
    expect(calculatorAvailable(demo, 'personal')).toBe(false);
    expect(calculatorAvailable({ ...demo, meta: { ...demo.meta, demonstration: false } }, 'preview')).toBe(false);
  });
});
