# Privacy design

## What is stored

| Data                                                                               | Where                                     | Why                                                                                           |
| ---------------------------------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| Patient group, ticked items (patient working state)                                | **Memory only** (React state)             | Never written to storage, URLs, logs or caches. Lost on close/reload; cleared by End session. |
| Theme, text size, favourite and recent **presentation ids**, disclaimer acceptance | `localStorage` key `carpa.preferences.v1` | Convenience; contains no patient information. Validated on read.                              |

Nothing is sent anywhere: no analytics, no error reporting, no accounts, no third-party requests. The only network
requests are for the app's own files.

## How this is enforced

- ESLint forbids `localStorage`, `sessionStorage` and `indexedDB` everywhere except `src/state/preferences.ts`.
- Routes contain only content ids (validated against the id pattern).
- Tests check that after ticking items, storage holds only the preferences key with no item ids or patient group, that
  sessionStorage, IndexedDB and Cache Storage are empty, and that the URL holds no patient data.
- `console` output is a lint error.

## Limits the app cannot control

- **Clipboard** (ISBAR copy): the OS and other apps may keep clipboard history (e.g. iOS Universal Clipboard, Android
  clipboard managers). The app asks for confirmation with this warning before every copy.
- **App switcher snapshots**, screen recording and screenshots.
- **Keyboard learning** of typed words.
- **Backgrounding:** while the app is in the background its memory may persist until the OS closes it.
- **Shared devices:** use End session; the 60-minute inactivity clear is a backstop. Use a device passcode.
