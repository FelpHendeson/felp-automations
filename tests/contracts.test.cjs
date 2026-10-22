const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateInput } = require('../dist-electron/shared/contracts.js');
test('aceita e normaliza um endereço HTTP válido', () => {
  assert.deepEqual(validateInput({ url: ' https://example.com ', keepOpen: true }), { url: 'https://example.com/', keepOpen: true });
});
test('bloqueia protocolos locais, credenciais e configurações inválidas', () => {
  for (const url of ['file:///C:/Windows', 'javascript:alert(1)', 'https://user:secret@example.com', 'example.com', '']) assert.throws(() => validateInput({ url, keepOpen: false }));
  assert.throws(() => validateInput({ url: 'https://example.com', keepOpen: 'true' }));
  assert.throws(() => validateInput(null));
});
