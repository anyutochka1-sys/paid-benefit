import test from 'node:test';
import assert from 'node:assert/strict';
import {soleParentStatus} from './parental-status.mjs';

test('death and absent birth record establish sole-parent status', () => {
  assert.equal(soleParentStatus([{secondParentStatus:'dead'}]), 'sole');
  assert.equal(soleParentStatus([{secondParentStatus:'blank'}, {secondParentStatus:'missing'}]), 'sole');
});

test('imprisonment and deprivation of rights do not establish sole-parent status', () => {
  assert.equal(soleParentStatus([{secondParentStatus:'imprisoned'}]), 'other');
  assert.equal(soleParentStatus([{secondParentStatus:'deprived-rights'}]), 'other');
});

test('mixed or incomplete child circumstances must not produce a definite alimony calculation', () => {
  assert.equal(soleParentStatus([{secondParentStatus:'dead'}, {secondParentStatus:'imprisoned'}]), 'mixed');
  assert.equal(soleParentStatus([{secondParentStatus:''}]), 'unknown');
});
