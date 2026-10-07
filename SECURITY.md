# Security Policy

## Supported versions

Security fixes are made in the latest release only. Please update to it before reporting an issue.

| Version | Supported |
| --- | --- |
| Latest release | Yes |
| Older releases | No |

## Reporting a vulnerability

Please report security problems privately, not in a public issue:

1. Go to [Report a vulnerability](https://github.com/aashishxetri5/Hitoiki/security/advisories/new) (the repository's **Security** tab, then **Report a vulnerability**).
2. Describe the problem, the version and platform you used (Windows installer, Microsoft Store or Linux AppImage), and the steps to reproduce it.

You can expect an acknowledgement within 7 days. Once the problem is confirmed, a fix will be released as soon as practical, and the advisory will credit you unless you prefer otherwise.

## What's in scope

- Anything that lets a web page, file or other program run code through Hitoiki, or read or change its settings.
- Anything that makes Hitoiki send data over the network. The app is designed to make no network connections at all (see [PRIVACY.md](PRIVACY.md)).
- Weaknesses in how Hitoiki's windows are isolated from the operating system, such as its sandbox, Content Security Policy or IPC bridge.

Vulnerabilities in Electron or Chromium themselves should go to the [Electron project](https://github.com/electron/electron/security/policy). Hitoiki picks up their fixes by updating Electron in a new release.

## How Hitoiki limits risk

- It loads only its own local files and makes no network requests.
- Its windows run sandboxed with context isolation and no Node.js access. A strict Content Security Policy blocks remote content.
- Each window can use only the IPC channels its role needs.
- Navigation and new windows are blocked, and every permission request is refused.
