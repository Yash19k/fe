import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveApiBaseUrl } from '../src/services/api';

test('API URL uses local backend by default in development', () => {
  assert.equal(resolveApiBaseUrl(undefined, false), 'http://localhost:3000');
});

test('API URL uses an explicitly configured production endpoint', () => {
  assert.equal(
    resolveApiBaseUrl('https://api.example.invalid/', true),
    'https://api.example.invalid'
  );
});

test('API URL supports an explicitly configured same-origin proxy', () => {
  assert.equal(resolveApiBaseUrl('/', true), '/');
});

test('production API URL is required and must be valid HTTPS', () => {
  assert.throws(() => resolveApiBaseUrl(undefined, true), /VITE_API_URL must be configured/);
  assert.throws(() => resolveApiBaseUrl('http://api.example.invalid', true), /must use HTTPS/);
  assert.throws(() => resolveApiBaseUrl('not-a-url', false), /absolute HTTP\(S\) URL/);
});
