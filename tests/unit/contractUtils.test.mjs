import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculateLeaveBalance, calculateCDDLeaveBalance } from '../../src/lib/contractUtils.js';

describe('calculateLeaveBalance', () => {
  test('CDI temps plein = 25', () => assert.equal(calculateLeaveBalance('CDI', null, null, 2026, 100), 25));
  test('CDI 80 % = 20', () => assert.equal(calculateLeaveBalance('CDI', null, null, 2026, 80), 20));
  test('CDI 50 % = 12,5', () => assert.equal(calculateLeaveBalance('CDI', null, null, 2026, 50), 12.5));
  test('Mi-temps forcé à 50 %', () => assert.equal(calculateLeaveBalance('Mi-temps', null, null, 2026, 100), 12.5));
  test('quotité absente → 100 %', () => assert.equal(calculateLeaveBalance('CDI', null, null, 2026, undefined), 25));
  test('quotité > 100 plafonnée', () => assert.equal(calculateLeaveBalance('CDI', null, null, 2026, 150), 25));
  test('quotité reçue en texte ("80")', () => assert.equal(calculateLeaveBalance('CDI', null, null, 2026, '80'), 20));
  test('CDD année complète = 25', () => assert.equal(calculateLeaveBalance('CDD', '2026-01-01', '2026-12-31', 2026, 100), 25));
  test('CDD sans dates = 0', () => assert.equal(calculateLeaveBalance('CDD', null, null, 2026, 100), 0));
});

describe('calculateCDDLeaveBalance', () => {
  test('6 mois ≈ 12,5 jours', () => {
    const v = calculateCDDLeaveBalance('2026-01-01', '2026-06-30', 2026);
    assert.ok(v > 12 && v < 13, `obtenu ${v}`);
  });
  test('contrat hors année = 0', () => assert.equal(calculateCDDLeaveBalance('2025-01-01', '2025-06-30', 2026), 0));
  test('contrat à cheval : seule la part 2026 compte', () => {
    const v = calculateCDDLeaveBalance('2025-07-01', '2026-06-30', 2026);
    assert.ok(v > 12 && v < 13, `obtenu ${v}`);
  });
  test('un mois ≈ 2,08 jours', () => {
    const v = calculateCDDLeaveBalance('2026-03-01', '2026-03-31', 2026);
    assert.ok(Math.abs(v - 2.12) < 0.1, `obtenu ${v}`);
  });
  test('jamais plus de 25', () => assert.ok(calculateCDDLeaveBalance('2020-01-01', '2030-12-31', 2026) <= 25));
});
