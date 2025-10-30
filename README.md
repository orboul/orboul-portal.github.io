# Orboul Command Vault

This repository contains a lightweight, password-gated command library optimised for a single operator. Everything runs client-side so it can be hosted anywhere that serves static files (GitHub Pages, Vercel, Netlify, S3, etc.).

## Running locally

Open `index.html` in a browser. No build tooling is required.

## Customising

- **Default commands:** Tweak the `DEFAULT_COMMANDS` array in `app.js` to seed the catalogue with the operations you rely on most.
- **Custom commands/snippets:** Use the in-app forms to add entries. They are encrypted and saved locally once you have unlocked the workspace.
- **Theme:** Toggle between dark and light mode via the button in the top-right of the workspace. The preference is saved to `localStorage`.
- **Resetting:** Clear browser storage (DevTools → Application → Storage) to remove the password and all encrypted content.

## Scratchpad storage

Notes, custom commands, and snippets live in encrypted `localStorage` entries. The AES-GCM key is derived from the password you set the first time you open the app. Lose the password and the stored data becomes unreadable.

## Adding real authentication later

1. Swap the password-creation flow in `app.js` for your auth provider (e.g. Auth0, Supabase, custom API). Persist only a short-lived token client-side.
2. Replace the `encryptData`/`decryptData` helpers with API calls to sync notes and user-defined commands to your datastore.
3. Keep the AES logic if you want to encrypt before sending to a backend—just ship the ciphertext instead of storing in `localStorage`.
