# Privacy Policy

**Effective date:** October 8, 2026

Hitoiki is a desktop app that reminds you to blink, drink water, rest your eyes, sit tall, stretch and breathe. This policy explains what the app does with information about you. In short: **Hitoiki does not collect, send or share any personal information.** Everything it knows stays on your computer.

This policy applies to every version of Hitoiki: the Windows installer, the Microsoft Store version and the Linux AppImage.

## What Hitoiki does not do

- It has no accounts and asks for no name, email address or other personal details.
- It makes no network connections. It does not check for updates, load web content, fetch fonts, send analytics or telemetry, or upload crash reports.
- It contains no advertising and no third-party tracking or analytics code.
- It requests no device permissions. It refuses every request for the camera, microphone, location and notifications.

## What stays on your computer

Hitoiki saves your reminders and preferences in one file, `settings.json`, so they are still there next time. It contains:

- Your reminders: their names, messages, intervals, animations and sounds.
- Your schedule: active hours, the days they apply to, and whether reminders are paused.
- Your preferences: where reminders appear and how large, sound volume, the away and full-screen options, and whether the app starts with your computer.

The file stays on your computer and is never sent anywhere. The framework Hitoiki is built on (Electron) also keeps its own working files, such as caches, in the same folder. These contain no personal information.

Where the file is kept:

| Version | Location |
| --- | --- |
| Windows installer | `%APPDATA%\Hitoiki` |
| Microsoft Store | Inside the app's own storage under `%LOCALAPPDATA%\Packages`, managed by Windows |
| Linux AppImage | `~/.config/Hitoiki` |

## What the app reads but does not store

To avoid showing reminders when nobody would see them, Hitoiki checks, at the moment a reminder is due:

- how long it has been since you last used the keyboard or mouse,
- whether the screen is locked, and
- on Windows, whether a full-screen app or presentation is running.

These checks happen on your computer and the results are used immediately. They are never saved or sent anywhere.

## Microsoft Store and GitHub

Hitoiki is distributed through the Microsoft Store and GitHub. Downloading it from either is covered by that service's own privacy statement, not by this policy.

- **Microsoft Store:** Microsoft may share aggregate statistics with the developer through Partner Center, such as the number of installs and, depending on your Windows diagnostic settings, crash reports collected by Windows. See the [Microsoft Privacy Statement](https://privacy.microsoft.com/privacystatement).
- **GitHub:** GitHub counts how often each release file is downloaded. See the [GitHub Privacy Statement](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement).

Neither service receives any information from the app itself.

## Deleting your data

You can delete everything Hitoiki has saved at any time.

- **Windows installer:** uninstall Hitoiki from Settings > Apps, then delete the `%APPDATA%\Hitoiki` folder. If you turned on *Start with your computer*, turn it off in the app first, or remove Hitoiki from Settings > Apps > Startup.
- **Microsoft Store:** uninstalling the app removes its data.
- **Linux AppImage:** delete the AppImage, the `~/.config/Hitoiki` folder and, if you turned on *Start with your computer*, the file `~/.config/autostart/hitoiki.desktop`.

## Children

Hitoiki collects no information from anyone, including children under 13.

## Changes to this policy

If this policy changes, the new version will be published here with a new effective date, and the change will be noted in the [changelog](CHANGELOG.md). The full history of this file is public in the project's repository.

## Contact

For questions about this policy or about Hitoiki's privacy, open an issue at [github.com/aashishxetri5/Hitoiki/issues](https://github.com/aashishxetri5/Hitoiki/issues).
