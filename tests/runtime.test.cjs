const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

test('Node loads the emitted Vercel function without a TypeScript loader', t => {
  const root = path.resolve(__dirname, '..');
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'dysrupcion-runtime-'));
  t.after(() => fs.rmSync(output, { recursive: true, force: true }));
  execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'),
    '--project', path.join(root, 'tsconfig.json'), '--noEmit', 'false', '--outDir', output],
  { cwd: root, stdio: 'pipe' });

  // A fresh Node process must load the actual compiler output, as Vercel does.
  // The other tests deliberately transpile to CommonJS and cannot catch a mismatch.
  const script = `
    const api = require(process.argv[1]).default;
    (async () => {
      const status = await api.fetch(new Request('https://review.example.test/api/review'));
      const events = await api.fetch(new Request('https://review.example.test/api/review?reviewPath=events'));
      const registration = await api.fetch(new Request('https://review.example.test/api/review?reviewPath=register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: 'Runtime Test', email: 'runtime@example.test',
          whatsapp: '+52 999 000 0000', linkedin: 'https://linkedin.com/in/runtime-test',
          motivacion: 'Testing the compiled review function.', contrato: true })
      }));
      console.log(JSON.stringify({ status: status.status, events: await events.json(),
        registration: await registration.json() }));
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `;
  const result = JSON.parse(execFileSync(process.execPath,
    ['-e', script, path.join(output, 'api/review.js')], { cwd: output, encoding: 'utf8' }));
  assert.equal(result.status, 200);
  assert.equal(result.events.events.length, 3);
  assert.equal(result.registration.ok, true);
  assert.equal(result.registration.review, true);
  assert.equal(result.registration.stored, false);
});
