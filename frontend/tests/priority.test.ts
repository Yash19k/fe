import assert from 'node:assert/strict';
import test from 'node:test';
import {
  backendPriorityToFrontend,
  frontendPriorityToBackend,
} from '../src/services/api';

test('urgent priority is preserved in both frontend/backend mappings', () => {
  assert.equal(backendPriorityToFrontend('URGENT'), 'Urgent');
  assert.equal(frontendPriorityToBackend('Urgent'), 'URGENT');
});
