import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

// PRIVACY.md promises that the app makes no network requests. These checks guard the
// places where one could slip in.

const read = (relative) => fs.readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');

test('every page only loads its own local files', () => {
  for (const page of ['src/renderer/dashboard/index.html', 'src/renderer/overlay/overlay.html']) {
    const csp = read(page).match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
    assert.ok(csp, `${page} has no Content-Security-Policy`);
    assert.match(csp, /default-src 'self'/, `${page} must default to its own files`);
    assert.doesNotMatch(csp, /https?:|\*/, `${page} must not allow remote sources`);
  }
});

test('windows have spellcheck off, so no dictionaries are downloaded', () => {
  assert.match(read('src/main/windows/window-factory.js'), /spellcheck: false/);
});

test('no crash reports are uploaded', () => {
  for (const file of fs.readdirSync(new URL('../src/main', import.meta.url), { recursive: true })) {
    if (!String(file).endsWith('.js')) continue;
    assert.doesNotMatch(read(`src/main/${String(file).split('\\').join('/')}`), /crashReporter/, `${file} uses crashReporter`);
  }
});
