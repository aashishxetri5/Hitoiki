# Hitoiki

Small habits, gently. Hitoiki is a desktop app that quietly reminds you to look after yourself: blink, drink water, rest your eyes, sit tall, stretch, breathe. Each reminder pops up as a short animation on top of your screen, then disappears. It lives in the system tray and uses very little memory and CPU.

The name, said *hee-toh-EE-kee*, is Japanese 一息: "a breath, a breather". *Hitoiki tsuku* means to pause and take a breath, which is what every reminder asks of you.

## Features

- **A home screen you can read at a glance.** One ring per reminder fills toward its next nudge, each in its own colour, and the centre counts down to what is next. Hover a reminder to bring its ring forward. The glow behind it follows the time of day.
- **Reminders on your own schedule.** Every reminder has its own interval, from every 2 seconds to every 24 hours. Blink every 4 seconds, drink water every 30 minutes, stretch every hour.
- **Animated on-screen cues.** A pair of friendly eyes that blink, a glass that fills with water, a back that straightens, arms that stretch, a breathing circle, a view into the distance, or any icon you choose. They are click-through and never take focus.
- **Starter reminders.** Blink, Drink water, Rest your eyes (20-20-20), Check your posture, Stretch and Breathe, ready to switch on, plus your own.
- **Sound.** Each reminder can play a soft tick, chime, droplet or bell, synthesized on the fly. No audio files.
- **Pause and snooze.** "Take a break" for 15 minutes, 30 minutes, an hour or the rest of the day, from the home screen or the tray. The home screen changes mood while you rest, are off duty, or have switched reminders off.
- **Editing with a live preview.** The editor shows the real animation as you choose it, with a stepper for the interval, and plays each sound when you tap it.
- **Active hours.** Limit reminders to chosen hours and days, including windows that run past midnight.
- **Smart pause.** Skips reminders while you are away from the keyboard, while the screen is locked, and during full-screen apps and presentations (Windows).
- **Tray menu.** Pause, switch reminders on and off, and quit without opening a window.
- **Start with your computer**, quietly in the tray.

## Download

Get the installer for your system from the [releases page](https://github.com/aashishxetri5/Hitoiki/releases/latest).

| Platform | File |
| --- | --- |
| Windows 10/11 | `Hitoiki-Setup-<version>.exe` |
| Linux | `Hitoiki-<version>.AppImage` |

Each release lists the SHA-256 of every file in `SHA256SUMS.txt`.

- **Windows**: the installer is not code-signed yet, so Windows may show "Windows protected your PC". Choose **More info, then Run anyway**.
- **Linux** needs a desktop with a compositor so the transparent reminder can be drawn. Make the AppImage executable (`chmod +x Hitoiki-*.AppImage`) and run it. On Ubuntu 24.04 and later, if it reports a missing `libfuse.so.2`, run `sudo apt install libfuse2t64`. On GNOME, the tray icon needs the AppIndicator extension.

## Privacy

Hitoiki works entirely on your computer. It has no account, no analytics, no update check and no network access, and it refuses every device and notification permission. Your reminders and settings are saved in one small file on your device and are never sent anywhere. The [privacy policy](PRIVACY.md) has the details, including how to delete everything the app has saved.

## Resource use

Measured on Windows 11 (12-thread desktop CPU) with the development build:

| State | Memory | CPU |
| --- | --- | --- |
| Idle in the tray | about 37 MB | about 0% |
| Window open, rings counting down | about 60 MB | about 0% |
| A reminder animating | about 60 MB | about 1% of the whole CPU while it is on screen |

How it stays light:

- One timer, always pointed at the next thing that needs to happen. Nothing polls.
- The reminder window exists only while it is needed and is destroyed 30 seconds after the last reminder.
- Closing the settings window destroys it, so it holds no memory in the background.
- Whether you are away or in a full-screen app is checked only at the moment a reminder falls due.
- Software rendering, with the GPU and network services running inside the main process.
- Animations are brief one-shot motions that hold still afterwards. The few endless loops (breathing, pulses) run at 24 frames per second, and nothing that moves uses a blur filter.

## Support

- **Questions, bugs and ideas:** [open an issue](https://github.com/aashishxetri5/Hitoiki/issues/new/choose).
- **Security problems:** please report them privately, as described in [SECURITY.md](SECURITY.md).

## Contributing

Contributions are welcome. [CONTRIBUTING.md](CONTRIBUTING.md) covers the development setup, the project's standards and how the app works inside. [RELEASE.md](RELEASE.md) describes how releases are made, and [CHANGELOG.md](CHANGELOG.md) lists what changed in each one.

## License

Hitoiki is released under the [MIT License](LICENSE). It includes:

- Icons from [Lucide](https://lucide.dev) (ISC License).
- The Fraunces typeface (SIL Open Font License 1.1, included as `src/renderer/shared/fonts/OFL.txt`).
- [Electron](https://www.electronjs.org) (MIT License) and Chromium, whose licenses are installed alongside the app.
