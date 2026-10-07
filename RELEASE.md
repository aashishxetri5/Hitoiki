# Releasing Hitoiki

How to publish a new version to GitHub Releases (Windows installer and Linux AppImage) and the Microsoft Store.

## Versioning

Hitoiki follows [Semantic Versioning](https://semver.org): `MAJOR.MINOR.PATCH`.

- **Patch** (1.0.1): bug fixes and Electron security updates.
- **Minor** (1.1.0): new features that keep existing settings working.
- **Major** (2.0.0): changes that drop or reinterpret existing settings.

The Store package's version is built from `package.json` with a fourth part of `0` (1.0.1 becomes 1.0.1.0), as the Store requires. Every Store submission needs a higher version than the last one.

## Before you release

- [ ] CI is green on `master`.
- [ ] Electron is on its latest patch release (`npm outdated electron`). Chromium security fixes reach users only through a new Hitoiki release, so don't let it fall behind.
- [ ] `npm run lint` and `npm test` pass.
- [ ] `CHANGELOG.md` has an entry for the new version, describing changes from a user's point of view.
- [ ] If `PRIVACY.md` changed, its effective date is updated and the changelog says so.

### Manual checks

Run through these with builds from `npm run dist` (Windows) or from a test tag (Linux):

**Windows installer**
- [ ] A fresh install starts, shows the home screen and puts the icon in the tray.
- [ ] Installing over the previous version keeps reminders and settings.
- [ ] Reminders appear on top of other windows, without taking focus or blocking clicks.
- [ ] Reminders are skipped during a full-screen video or presentation.
- [ ] *Start with your computer* starts the app in the tray after signing out and back in.
- [ ] Uninstalling removes the app from Settings > Apps.

**Microsoft Store version** (install from the Store with a private audience, see below)
- [ ] The Start menu tile, taskbar and Store listing show the ring icon, not a placeholder.
- [ ] Settings shows *Start with Windows* with an **Open** button that opens Windows' Startup settings.
- [ ] Turning Hitoiki on there starts it in the tray at the next sign-in.

**Linux AppImage** (Ubuntu 24.04 or similar; check both an X11 and a Wayland session)
- [ ] The AppImage starts after `chmod +x`. On Ubuntu 24.04, if it reports a missing `libfuse.so.2`, install `libfuse2t64`.
- [ ] The tray icon appears (GNOME needs the AppIndicator extension).
- [ ] Reminders appear on top of other windows, in the position chosen in Settings, with a transparent background.
- [ ] *Start with your computer* creates `~/.config/autostart/hitoiki.desktop` and starts the app at the next login.

## Publishing a release

1. Commit the changelog entry.
2. Bump the version and tag it. This updates `package.json` and `package-lock.json`, commits, and creates the tag `vX.Y.Z`:

   ```bash
   npm version patch    # or minor, or major
   git push --follow-tags
   ```

3. The tag starts the **Release** workflow (`.github/workflows/release.yml`). It:
   - tests and builds the Windows installer and the Linux AppImage, then attaches them to a **draft** GitHub Release with `SHA256SUMS.txt`;
   - builds the Microsoft Store package separately, as the run artifact `microsoft-store-package`.
4. On GitHub, open the draft release. Check that it has `Hitoiki-Setup-X.Y.Z.exe`, `Hitoiki-X.Y.Z.AppImage` and `SHA256SUMS.txt`. Replace the generated notes with the changelog entry, then **Publish**.

If a published release turns out to be broken, don't replace its files or move its tag. Fix the problem and release a new patch version.

If the workflow fails because a release for the tag was already published, delete that release on GitHub (keep the tag) and re-run the workflow.

## Submitting to the Microsoft Store

1. Download the `microsoft-store-package` artifact from the workflow run and unzip it to get `Hitoiki-X.Y.Z.appx`.
2. In [Partner Center](https://partner.microsoft.com/dashboard), open Hitoiki and start a new submission (for the first release, the submission already in progress).
3. Under **Packages**, upload the `.appx`. Remove any older package the submission still lists.
4. Under **Store listings**, fill in *What's new in this version* from the changelog. Update the screenshots if the interface changed.
5. Submit for certification. Microsoft usually completes it within a few days, and the update then reaches users through the Store.

For the first release, or any release with packaging changes, set **Visibility** to a private audience first. Install it from the Store, run the Store checks above, then make it public.

### How the Store package is put together

- `npm run dist:store` builds it locally into `dist/`.
- Its identity (`build.appx` in `package.json`) must match Partner Center's *Product identity* page exactly: the package name `AashishKatwal.Hitoiki`, the publisher ID and the publisher display name.
- The package is not signed locally; Microsoft signs it when the submission is published.
- Store apps can't register themselves to start at sign-in. The package declares a startup task instead (`build/appx-startup-task.xml`), off by default, which the user turns on in Windows Settings.
- The Start menu, taskbar and Store images in `build/appx/` are drawn from the app icon by `npm run assets`.

## Code signing

The Windows installer is not code-signed yet, so Windows SmartScreen warns on first launch ("Windows protected your PC"); the README explains how to continue. The Microsoft Store version is signed by Microsoft and shows no warning. Linux AppImages are not signed.
