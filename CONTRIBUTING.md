# Contributing to Hitoiki

Thanks for helping. Bug reports, ideas and pull requests are all welcome.

- **Found a bug or have an idea?** [Open an issue](https://github.com/aashishxetri5/Hitoiki/issues/new/choose). For anything bigger than a small fix, please open an issue before starting work, so we can agree on the approach.
- **Found a security problem?** Please report it privately, as described in [SECURITY.md](SECURITY.md).

## Development setup

Requires Node.js 22.12 or newer.

```bash
npm ci
npm start          # launches the app
npm test           # unit tests (node:test)
npm run lint
npm run dist       # Windows installer or Linux AppImage, for the current platform, into dist/
npm run dist:store # Microsoft Store package (Windows only), into dist/
```

If `npm start` opens nothing or reports that `BrowserWindow` is missing, your shell has `ELECTRON_RUN_AS_NODE` set (VS Code terminals can do this). Clear it first: `Remove-Item Env:ELECTRON_RUN_AS_NODE` in PowerShell, or `unset ELECTRON_RUN_AS_NODE` in a POSIX shell.

The icons in `build/` (`icon.png`, `icon.ico` and the Store images in `build/appx/`) are drawn by `npm run assets`, which runs automatically before `npm run dist` and `npm run dist:store`. They are not committed. The display font (Fraunces, SIL Open Font License) is copied into the repo by `npm run fonts:vendor`, so the app never fetches fonts.

## Standards

- **Production quality.** Every function has a JSDoc block describing it, its parameters and what it returns. Match the style and comment density of the surrounding code.
- **DRY and YAGNI.** Reuse what exists, and don't add options or abstractions that nothing needs yet.
- **Local only.** Hitoiki makes no network requests: no analytics, update checks, remote fonts or telemetry. Pull requests that add any will not be accepted. `test/privacy.test.js` guards the obvious ways one could slip in.
- **Light on resources.** Keep a single scheduler timer and no polling. Create windows only when they're needed, keep animations brief, and use no blur filters on anything that moves (see [How it stays light](README.md#resource-use)).
- **Icons, not emoji.** Icons are SVG from [Lucide](https://lucide.dev). To use a new one, add its name to `scripts/vendor-icons.js` and run `npm run icons:vendor`.
- **Tests.** Pure logic lives in `src/main/core` and `src/shared` and has unit tests. Add or update tests with every behaviour change, and keep `npm test` and `npm run lint` passing.
- **Commits.** Use short, imperative messages with a type prefix, as in the existing history: `feat: …`, `fix: …`, `docs: …`, `chore: …`.

## Design

The interface is deliberately quiet so the reminders can carry the colour:

- Warm paper by day and twilight by night, following the system theme (see `src/renderer/shared/tokens.css`).
- Controls are ink-coloured and surfaces are soft and borderless. The only colour on screen belongs to a reminder, so colour always means "this reminder".
- Headings and countdowns use a serif display face; everything else uses the system font.
- There are no pages. The home screen is the product; the editor and settings slide over it as sheets.
- The window's title bar is part of the page, with the system's window buttons tinted to match.

## Project structure

```
build/                   Store startup task (the icons here are generated)
scripts/                 icon rendering, and icon and font vendoring
src/
  shared/                code used by every process: constants, catalog, formatting, icons, types
  preload.cjs            the IPC bridge exposed to windows as window.api
  main/                  Electron main process
    index.js             startup wiring and app lifecycle
    core/                pure logic, unit-tested: scheduler, active hours, reminder validation, placement
    settings/            settings schema, validation, recovery and persistence
    services/            OS integration: away and full-screen detection, start at login, permissions
    windows/             settings window, on-screen reminder window, tray, icons
    app/                 orchestration: the reminder controller and IPC handlers
  renderer/
    overlay/             the on-screen reminder (scenes.css and scenes.js are also used by the editor's preview)
    dashboard/           home screen, sheets and components (rings, hero, rows, editor, settings)
    shared/              helpers, design tokens and the bundled font used by both windows
test/                    unit tests
```

## How it works

The main process owns a `Scheduler` that sleeps on a single timer. When a reminder falls due, the `ReminderController` asks `Presence` whether anyone is there to see it (idle time, locked screen, full-screen app). If so, it hands the reminder to the `OverlayWindow`, which creates a small transparent, click-through, always-on-top window on the display under your mouse, plays the scene, and hides it again. The settings window is a separate sandboxed page that talks to the main process over a role-scoped IPC bridge.

When the schedule is closed (master switch off, a pause, or outside active hours), the scheduler sets its timer for the moment it reopens, or for no time at all, and every countdown restarts when it does. The same happens after your computer wakes from sleep or is unlocked, so a long absence never produces a burst of reminders.

## Adding a scene

1. Add an id to `SceneId` in `src/shared/constants.js` and an entry to `SCENES` in `src/shared/catalog.js`.
2. Draw it in `src/renderer/overlay/scenes.js` and style it in `src/renderer/overlay/scenes.css`. Let it rest in its finished pose, keep motion brief, and avoid filters on anything that moves. Endless loops run at 24 frames per second. The editor's live preview picks the scene up automatically.
3. Run `npm test`. The catalog test fails until every layer knows about the new scene.

## Pull requests

1. Fork the repository and create a branch from `master`.
2. Make your change, with tests and JSDoc as above.
3. Run `npm run lint` and `npm test`.
4. Open a pull request that explains what changed and why. For visible changes, include screenshots in light and dark mode. The template will remind you of the rest.

Releases are covered in [RELEASE.md](RELEASE.md).

By contributing, you agree that your contributions are licensed under the project's [MIT License](LICENSE).
