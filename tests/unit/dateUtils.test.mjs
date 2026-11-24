import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculateBusinessDays, isAtLeast7DaysInAdvance, hasOverlap, formatDateFR } from '../../src/lib/dateUtils.js';
import * as client from '../../src/lib/clientDateUtils.js';

const F26 = ['2026-01-01','2026-04-06','2026-05-01','2026-05-08','2026-05-14','2026-05-25','2026-07-14','2026-08-15','2026-11-01','2026-11-11','2026-12-25'];

for (const [name, fn] of [['serveur', calculateBusinessDays], ['client', client.calculateBusinessDays]]) {
  describe(`calculateBusinessDays (${name})`, () => {
    test('une semaine complète = 5 jours', () => assert.equal(fn('2026-03-09', '2026-03-13'), 5));
    test('lundi → lundi suivant = 6 jours', () => assert.equal(fn('2026-03-09', '2026-03-16'), 6));
    test('un seul jour ouvré', () => assert.equal(fn('2026-03-10', '2026-03-10'), 1));
    test('samedi seul = 0', () => assert.equal(fn('2026-03-14', '2026-03-14'), 0));
    test('week-end complet = 0', () => assert.equal(fn('2026-03-14', '2026-03-15'), 0));
    test('fin avant début = 0', () => assert.equal(fn('2026-03-13', '2026-03-09'), 0));
    test('jour férié exclu (1er mai 2026, vendredi)', () => assert.equal(fn('2026-04-27', '2026-05-01', F26), 4));
    test('férié tombant un week-end non décompté deux fois (15 août 2026 = samedi)', () =>
      assert.equal(fn('2026-08-10', '2026-08-16', F26), 5));
    test('mois de mai 2026 avec ses 4 fériés en semaine', () => assert.equal(fn('2026-05-01', '2026-05-31', F26), 17));
    test('chevauchement d\'année (29/12/2026 → 05/01/2027)', () =>
      assert.equal(fn('2026-12-29', '2027-01-05', [...F26, '2027-01-01']), 5));
    test('année 2026 complète = 261 jours ouvrés hors fériés', () => assert.equal(fn('2026-01-01', '2026-12-31'), 261));

    // Passages heure d'été / heure d'hiver (le serveur tourne en Europe/Paris)
    test('traverse le passage à l\'heure d\'été (29/03/2026) + lundi de Pâques', () =>
      assert.equal(fn('2026-03-27', '2026-04-10', F26), 10));
    test('traverse le passage à l\'heure d\'hiver (25/10/2026) : le dernier jour doit compter', () =>
      assert.equal(fn('2026-10-23', '2026-10-30', F26), 6));
    test('Toussaint→Armistice en traversant l\'heure d\'hiver', () =>
      assert.equal(fn('2026-10-19', '2026-11-13', F26), 19));
    test('été 2026 complet (juillet-août)', () => assert.equal(fn('2026-07-01', '2026-08-31', F26), 43));
  });
}

describe('isAtLeast7DaysInAdvance (aujourd\'hui = 02/03/2026)', () => {
  test('J+7 accepté', () => assert.equal(isAtLeast7DaysInAdvance('2026-03-09'), true));
  test('J+6 refusé', () => assert.equal(isAtLeast7DaysInAdvance('2026-03-08'), false));
  test('date passée refusée', () => assert.equal(isAtLeast7DaysInAdvance('2026-02-01'), false));
});

describe('hasOverlap', () => {
  test('périodes disjointes', () => assert.equal(hasOverlap('2026-03-01', '2026-03-05', '2026-03-06', '2026-03-10'), false));
  test('bord commun', () => assert.equal(hasOverlap('2026-03-01', '2026-03-05', '2026-03-05', '2026-03-10'), true));
  test('inclusion', () => assert.equal(hasOverlap('2026-03-01', '2026-03-31', '2026-03-10', '2026-03-12'), true));
});

test('formatDateFR', () => assert.equal(formatDateFR('2026-03-09'), '09/03/2026'));

import { calculateLeaveDays } from '../../src/lib/dateUtils.js';
describe('calculateLeaveDays (demi-journées)', () => {
  const cas = [
    ['journée complète', '2026-03-10', '2026-03-10', 'journee_complete', 'journee_complete', 1],
    ['matin', '2026-03-10', '2026-03-10', 'matin', 'matin', 0.5],
    ['après-midi', '2026-03-10', '2026-03-10', 'apres_midi', 'apres_midi', 0.5],
    ['matin → après-midi même jour', '2026-03-10', '2026-03-10', 'matin', 'apres_midi', 1],
    ['demi-journée un samedi', '2026-03-14', '2026-03-14', 'matin', 'matin', 0],
    ['demi-journée un jour férié', '2026-04-06', '2026-04-06', 'matin', 'matin', 0],
    ['semaine, début après-midi', '2026-03-09', '2026-03-13', 'apres_midi', 'journee_complete', 4.5],
    ['semaine, fin matin', '2026-03-09', '2026-03-13', 'journee_complete', 'matin', 4.5],
    ['début après-midi un samedi', '2026-03-14', '2026-03-20', 'apres_midi', 'journee_complete', 5],
    ['fin matin un dimanche', '2026-03-09', '2026-03-15', 'journee_complete', 'matin', 5],
    ['début après-midi un lundi férié', '2026-04-06', '2026-04-10', 'apres_midi', 'journee_complete', 4],
    ['vendredi après-midi → lundi matin', '2026-03-13', '2026-03-16', 'apres_midi', 'matin', 1],
    ['week-end entier en demi-journées', '2026-03-14', '2026-03-15', 'apres_midi', 'matin', 0],
  ];
  for (const [nom, d, f, td, tf, attendu] of cas) {
    test(`${nom} = ${attendu}`, () => assert.equal(calculateLeaveDays(d, f, F26, td, tf), attendu));
  }
});
