import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { APP_ID, APP_NAME } from '../src/shared/constants.js';

const read = (relative) => fs.readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const pkg = JSON.parse(read('package.json'));

test('package metadata matches the app name and id in the code', () => {
  assert.equal(pkg.productName, APP_NAME);
  assert.equal(pkg.name, APP_NAME.toLowerCase());
  assert.equal(pkg.build.productName, APP_NAME);
  assert.equal(pkg.build.appId, APP_ID);
});

test('installer file names use the app name', () => {
  for (const target of ['nsis', 'mac', 'linux']) {
    assert.ok(pkg.build[target].artifactName.startsWith(`${APP_NAME}-`), `${target} artifact is not named after the app`);
  }
});

test('page titles use the app name', () => {
  assert.match(read('src/renderer/dashboard/index.html'), new RegExp(`<title>${APP_NAME}</title>`));
  assert.match(read('src/renderer/overlay/overlay.html'), new RegExp(`<title>${APP_NAME} reminder</title>`));
});

test('the lock file belongs to the same package', () => {
  assert.equal(JSON.parse(read('package-lock.json')).name, pkg.name);
});
