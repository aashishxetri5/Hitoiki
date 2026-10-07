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
  for (const target of ['nsis', 'appx', 'linux']) {
    assert.ok(pkg.build[target].artifactName.startsWith(`${APP_NAME}-`), `${target} artifact is not named after the app`);
  }
});

test('the Store package identity belongs to this app', () => {
  const { appx } = pkg.build;
  assert.equal(appx.applicationId, APP_NAME);
  assert.ok(appx.identityName.endsWith(`.${APP_NAME}`), 'identityName must be the one Partner Center reserved for the app');
  assert.match(appx.publisher, /^CN=[0-9A-F-]{36}$/);
});

test('the Store startup task launches this app into the tray', () => {
  const task = read(pkg.build.appx.customExtensionsPath);
  assert.ok(task.includes(`Executable="app\\${pkg.build.productName}.exe"`), 'Executable must match productName');
  assert.ok(task.includes(`DisplayName="${APP_NAME}"`), 'DisplayName must match the app name');
  assert.ok(task.includes('Parameters="--hidden"'), 'the task must start the app hidden in the tray');
});

test('page titles use the app name', () => {
  assert.match(read('src/renderer/dashboard/index.html'), new RegExp(`<title>${APP_NAME}</title>`));
  assert.match(read('src/renderer/overlay/overlay.html'), new RegExp(`<title>${APP_NAME} reminder</title>`));
});

test('the lock file belongs to the same package', () => {
  assert.equal(JSON.parse(read('package-lock.json')).name, pkg.name);
});
