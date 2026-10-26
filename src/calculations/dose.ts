/**
 * Weight-based dose calculation (pure, exact decimal arithmetic).
 *
 * SAFETY: this is a synthetic test harness. It is enabled only for DEMONSTRATION
 * medications in preview builds (see calculatorAvailable). Mathematical correctness is
 * not evidence of clinical appropriateness.
 *
 * Rules:
 *  - uses only numbers present in the regimen; any required value missing → no calculation
 *  - units must be listed units; mass units convert exactly, others must match exactly
 *  - rounds only if the source gives a rounding rule
 *  - a dose above the maximum (or below the minimum, or over the cumulative limit) is a hard stop
 *  - administration volume is calculated only from an explicitly selected formulation with a
 *    fully entered concentration; a concentration is never assumed
 */
import Decimal from 'decimal.js';
import type { Formulation, Quantity, Regimen, Unit } from '../content/types.ts';
import type { ReleaseProfile } from '../content/status.ts';
import type { Medication } from '../content/types.ts';

const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

/** Mass units in micrograms. */
const MASS_IN_MICROGRAMS: Partial<Record<Unit, string>> = {
  g: '1000000',
  mg: '1000',
  microgram: '1',
  nanogram: '0.001',
};
const VOLUME_IN_ML: Partial<Record<string, string>> = { mL: '1', L: '1000' };

/** Convert amount between units, or null if they are not convertible. */
export function convert(amount: Decimal, from: Unit, to: Unit): Decimal | null {
  if (from === to) return amount;
  const f = MASS_IN_MICROGRAMS[from];
  const t = MASS_IN_MICROGRAMS[to];
  if (f && t) return amount.times(f).dividedBy(t);
  const fv = VOLUME_IN_ML[from];
  const tv = VOLUME_IN_ML[to];
  if (fv && tv) return amount.times(fv).dividedBy(tv);
  return null;
}

export function calculatorAvailable(medication: Medication, profile: ReleaseProfile): boolean {
  return medication.meta.demonstration === true && profile === 'preview';
}

export interface DoseInput {
  /** As typed by the user, in kg. */
  weightKg: string;
  population: string | null;
  formulationId: string | null;
  /** Optional: amount already given in the cumulative period, as typed, in the dose unit. */
  alreadyGiven: string;
}

export type StopReason = 'exceeds-max' | 'below-min' | 'exceeds-cumulative' | 'weight-out-of-range';

export interface DoseResult {
  ok: true;
  /** Lines of working, in order. */
  working: string[];
  dose: { amount: string; unit: Unit };
  /** A hard stop: the dose must not be used. */
  stop: { reason: StopReason; message: string } | null;
  volume: { amount: string; unit: 'mL'; working: string } | null;
  volumeNote: string | null;
  notes: string[];
}

export interface DoseRefusal {
  ok: false;
  reasons: string[];
}

const NUMBER = /^\d+(\.\d+)?$/;

export function fmt(d: Decimal): string {
  // Up to 6 decimal places, no trailing zeros, no exponent.
  return d
    .toDecimalPlaces(6)
    .toFixed()
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '');
}

const q = (x: Quantity) => `${x.amount === null ? '?' : fmt(new D(x.amount))} ${x.unit}`;

export function calculateDose(
  regimen: Regimen,
  formulations: Formulation[],
  input: DoseInput,
): DoseResult | DoseRefusal {
  const reasons: string[] = [];
  const dosing = regimen.dosing;
  if (dosing.type !== 'weight-based') {
    return { ok: false, reasons: ['This regimen is not weight-based. Use the dose as written in the source.'] };
  }
  if (input.population === null) reasons.push('Select the patient group first.');
  else if (!regimen.populations.includes(input.population))
    reasons.push('This regimen is not for the selected patient group.');

  const weightText = input.weightKg.trim();
  if (!NUMBER.test(weightText)) reasons.push('Enter the weight in kg using digits only (e.g. 18 or 18.5).');
  const weight = NUMBER.test(weightText) ? new D(weightText) : null;
  if (weight && weight.lte(0)) reasons.push('Weight must be greater than 0 kg.');

  if (dosing.dosePerKg.amount === null) reasons.push('The dose per kg has not been entered from the source.');
  if (dosing.maxSingleDose && dosing.maxSingleDose.amount === null)
    reasons.push('The maximum single dose has not been entered from the source.');
  if (dosing.minSingleDose && dosing.minSingleDose.amount === null)
    reasons.push('The minimum single dose has not been entered from the source.');
  if (dosing.applicableWeightKg && (dosing.applicableWeightKg.min === null || dosing.applicableWeightKg.max === null))
    reasons.push('The weight range this dose applies to has not been fully entered from the source.');
  if (dosing.rounding && dosing.rounding.increment === null)
    reasons.push('The rounding rule has not been fully entered from the source.');
  if (dosing.maxCumulative && (dosing.maxCumulative.amount === null || dosing.maxCumulative.periodHours === null))
    reasons.push('The maximum cumulative dose has not been fully entered from the source.');

  const doseUnit = dosing.dosePerKg.unit;
  const conv = (x: Quantity | { amount: number | null; unit: Unit }, label: string): Decimal | null => {
    if (x.amount === null) return null;
    const c = convert(new D(x.amount), x.unit, doseUnit);
    if (!c) reasons.push(`${label} is in ${x.unit}, which cannot be converted to ${doseUnit}.`);
    return c;
  };
  const max = dosing.maxSingleDose ? conv(dosing.maxSingleDose, 'Maximum single dose') : null;
  const min = dosing.minSingleDose ? conv(dosing.minSingleDose, 'Minimum single dose') : null;
  const cumMax = dosing.maxCumulative ? conv(dosing.maxCumulative, 'Maximum cumulative dose') : null;
  const roundInc =
    dosing.rounding && dosing.rounding.increment !== null
      ? conv({ amount: dosing.rounding.increment, unit: dosing.rounding.unit }, 'Rounding increment')
      : null;

  const givenText = input.alreadyGiven.trim();
  if (givenText !== '' && !NUMBER.test(givenText))
    reasons.push(`Enter the amount already given in ${doseUnit} using digits only, or leave it blank.`);
  if (givenText !== '' && !dosing.maxCumulative)
    reasons.push('The source gives no cumulative limit for this regimen; leave "already given" blank.');

  if (reasons.length || !weight || dosing.dosePerKg.amount === null) return { ok: false, reasons };

  const working: string[] = [];
  const notes: string[] = [];
  let stop: DoseResult['stop'] = null;

  if (dosing.applicableWeightKg) {
    const lo = new D(dosing.applicableWeightKg.min!);
    const hi = new D(dosing.applicableWeightKg.max!);
    if (weight.lt(lo) || weight.gt(hi)) {
      return {
        ok: true,
        working: [`Weight ${fmt(weight)} kg is outside the range in the source (${fmt(lo)}–${fmt(hi)} kg).`],
        dose: { amount: '—', unit: doseUnit },
        stop: {
          reason: 'weight-out-of-range',
          message: `STOP: this dose applies only to ${fmt(lo)}–${fmt(hi)} kg. Check the source and consult.`,
        },
        volume: null,
        volumeNote: null,
        notes,
      };
    }
  }

  const perKg = new D(dosing.dosePerKg.amount);
  let dose = perKg.times(weight);
  working.push(`${fmt(perKg)} ${doseUnit}/kg × ${fmt(weight)} kg = ${fmt(dose)} ${doseUnit}`);

  if (dosing.rounding && roundInc) {
    const mode = dosing.rounding.mode === 'down' ? Decimal.ROUND_DOWN : Decimal.ROUND_HALF_UP;
    const rounded = dose.dividedBy(roundInc).toDecimalPlaces(0, mode).times(roundInc);
    if (!rounded.eq(dose)) {
      working.push(
        `Rounded ${dosing.rounding.mode === 'down' ? 'down' : 'to the nearest'} ${fmt(roundInc)} ${doseUnit} (source rule) = ${fmt(rounded)} ${doseUnit}`,
      );
    }
    dose = rounded;
  } else {
    notes.push('No rounding rule in the source: the dose is shown unrounded.');
  }

  if (max) {
    working.push(`Maximum single dose (source): ${q(dosing.maxSingleDose!)}`);
    if (dose.gt(max))
      stop = {
        reason: 'exceeds-max',
        message: `STOP: the calculated dose (${fmt(dose)} ${doseUnit}) is above the maximum single dose (${q(dosing.maxSingleDose!)}). Check the source and consult.`,
      };
  } else {
    notes.push('The source gives no maximum single dose for this regimen.');
  }
  if (!stop && min) {
    working.push(`Minimum single dose (source): ${q(dosing.minSingleDose!)}`);
    if (dose.lt(min))
      stop = {
        reason: 'below-min',
        message: `STOP: the calculated dose (${fmt(dose)} ${doseUnit}) is below the minimum single dose (${q(dosing.minSingleDose!)}). Check the source and consult.`,
      };
  }
  if (!stop && cumMax && givenText !== '') {
    const given = new D(givenText);
    const total = given.plus(dose);
    working.push(
      `Already given ${fmt(given)} ${doseUnit} + this dose ${fmt(dose)} ${doseUnit} = ${fmt(total)} ${doseUnit} (limit ${fmt(cumMax)} ${doseUnit} in ${dosing.maxCumulative!.periodHours} h)`,
    );
    if (total.gt(cumMax))
      stop = {
        reason: 'exceeds-cumulative',
        message: `STOP: this dose would exceed the maximum of ${fmt(cumMax)} ${doseUnit} in ${dosing.maxCumulative!.periodHours} hours. Check the source and consult.`,
      };
  } else if (dosing.maxCumulative && givenText === '') {
    notes.push(
      `Cumulative limit in the source: ${fmt(new D(dosing.maxCumulative.amount!))} ${dosing.maxCumulative.unit} in ${dosing.maxCumulative.periodHours} h. Enter the amount already given to check it.`,
    );
  }

  // Administration volume — only from an explicitly chosen, fully entered formulation.
  let volume: DoseResult['volume'] = null;
  let volumeNote: string | null = null;
  if (!stop) {
    if (input.formulationId === null) {
      volumeNote = 'Select a formulation to calculate the volume. A concentration is never assumed.';
    } else {
      const f = formulations.find((x) => x.id === input.formulationId);
      if (!f || !regimen.formulationIds.includes(f.id)) volumeNote = 'That formulation is not listed for this regimen.';
      else if (!f.strength.perVolume) volumeNote = 'This formulation is not a liquid: no volume to calculate.';
      else if (f.strength.amount === null || f.strength.perVolume.amount === null)
        volumeNote = 'Volume not calculated: the concentration has not been entered from the source.';
      else {
        const strength = convert(new D(f.strength.amount), f.strength.unit, doseUnit);
        const perVol = convert(new D(f.strength.perVolume.amount), f.strength.perVolume.unit, 'mL');
        if (!strength || !perVol)
          volumeNote = `Volume not calculated: the concentration unit cannot be converted to ${doseUnit}.`;
        else {
          const ml = dose.times(perVol).dividedBy(strength);
          volume = {
            amount: fmt(ml),
            unit: 'mL',
            working: `${fmt(dose)} ${doseUnit} ÷ (${fmt(new D(f.strength.amount))} ${f.strength.unit} per ${fmt(new D(f.strength.perVolume.amount))} ${f.strength.perVolume.unit}) = ${fmt(ml)} mL`,
          };
        }
      }
    }
  }

  return { ok: true, working, dose: { amount: fmt(dose), unit: doseUnit }, stop, volume, volumeNote, notes };
}
