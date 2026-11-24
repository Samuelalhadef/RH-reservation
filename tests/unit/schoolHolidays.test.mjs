import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getAllSchoolHolidays, getSchoolHoliday, getSchoolHolidaysInMonth } from '../../src/lib/schoolHolidays.js';

const all = getAllSchoolHolidays();
const dow = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay();

describe('vacances scolaires Zone C (Chartrettes / académie de Créteil)', () => {
  test('périodes valides, triées et sans chevauchement', () => {
    for (let i = 0; i < all.length; i++) {
      const p = all[i];
      assert.match(p.debut, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(p.debut <= p.fin, `${p.nom} ${p.debut} > ${p.fin}`);
      if (i > 0) assert.ok(all[i - 1].fin < p.debut, `${all[i - 1].nom} chevauche ${p.nom}`);
    }
  });

  test('chaque année scolaire a ses 6 périodes (Toussaint → Été)', () => {
    const noms = all.map(p => p.nom);
    for (const n of ['Toussaint', 'Noël', 'Hiver', 'Printemps', "Pont de l'Ascension", 'Été']) {
      assert.ok(noms.filter(x => x === n).length >= 3, `${n} manquant`);
    }
  });

  test("les vacances (hors Ascension) commencent un samedi et finissent un dimanche, sauf l'été", () => {
    for (const p of all.filter(p => !['Été', "Pont de l'Ascension"].includes(p.nom))) {
      assert.equal(dow(p.debut), 6, `${p.nom} ${p.debut} n'est pas un samedi`);
      // exception : lundi 1er mai férié → reprise le mardi
      const ok = dow(p.fin) === 0 || (dow(p.fin) === 1 && p.fin.endsWith('-05-01'));
      assert.ok(ok, `${p.nom} ${p.fin} n'est pas un dimanche`);
    }
  });

  // Dates officielles (data.education.gouv.fr, Créteil)
  const officielles = [
    ['2025-10-18', 'Toussaint'], ['2025-11-02', 'Toussaint'], ['2025-11-03', null],
    ['2026-02-21', 'Hiver'], ['2026-03-08', 'Hiver'], ['2026-03-09', null],
    ['2026-05-15', "Pont de l'Ascension"],
    ['2026-07-03', null], ['2026-07-04', 'Été'], ['2026-08-31', 'Été'], ['2026-09-01', null],
    ['2026-10-16', null], ['2026-10-17', 'Toussaint'], ['2026-11-01', 'Toussaint'], ['2026-11-02', null],
    ['2026-12-19', 'Noël'], ['2027-01-03', 'Noël'], ['2027-01-04', null],
    ['2027-02-06', 'Hiver'], ['2027-02-22', null],
    ['2027-04-03', 'Printemps'], ['2027-04-19', null],
    ['2027-05-07', "Pont de l'Ascension"],
    ['2027-07-03', 'Été'], ['2027-09-01', 'Été'], ['2027-09-02', null],
  ];
  for (const [date, nom] of officielles) {
    test(`${date} → ${nom ?? 'école'}`, () => assert.equal(getSchoolHoliday(date)?.nom ?? null, nom));
  }

  test('getSchoolHolidaysInMonth : périodes à cheval sur deux mois', () => {
    assert.deepEqual(getSchoolHolidaysInMonth(all, 2026, 10).map(p => p.nom), ['Toussaint']); // novembre
    assert.deepEqual(getSchoolHolidaysInMonth(all, 2027, 0).map(p => p.nom), ['Noël']);       // janvier
    assert.deepEqual(getSchoolHolidaysInMonth(all, 2026, 4).map(p => p.nom), ['Printemps', "Pont de l'Ascension"]); // mai
    assert.deepEqual(getSchoolHolidaysInMonth(all, 2026, 8).map(p => p.nom), []);              // septembre
    assert.deepEqual(getSchoolHolidaysInMonth(all, 2027, 1).map(p => p.nom), ['Hiver']);      // février (28 j)
  });
});
