import test from 'node:test';
import assert from 'node:assert/strict';
import { generateHeuristicMapping, getHeadersFingerprint, mapRows } from './parser';
import type { CsvMapping } from '../types';

test('getHeadersFingerprint is stable across header order and casing', () => {
  const a = ['Date', 'Amount', 'Description'];
  const b = ['description', 'amount', 'date'];

  assert.equal(getHeadersFingerprint(a), getHeadersFingerprint(b));
});

test('generateHeuristicMapping identifies common columns', () => {
  const headers = ['Booking Date', 'Transaction Amount', 'Description Text', 'IBAN'];
  const mapping = generateHeuristicMapping(headers);

  assert.equal(mapping.bookingDate, 'Booking Date');
  assert.equal(mapping.amount, 'Transaction Amount');
  assert.equal(mapping.description, 'Description Text');
  assert.equal(mapping.accountId, 'IBAN');
});

test('mapRows maps canonical fields and keeps selected extra columns', () => {
  const raw = [
    {
      Date: '01/31/2026',
      Amount: '-42.10',
      Description: 'Grocery Store',
      Notes: 'weekly',
    },
  ];

  const mapping: CsvMapping = {
    bookingDate: 'Date',
    amount: 'Amount',
    description: 'Description',
    extraColumns: ['Notes'],
  };

  const result = mapRows(raw, mapping);
  assert.equal(result.length, 1);
  assert.equal(result[0].bookingDate, '2026-01-31');
  assert.equal(result[0].amount, '-42.10');
  assert.equal(result[0].description, 'Grocery Store');
  assert.equal(result[0].extraColumns?.Notes, 'weekly');
});

