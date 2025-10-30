# Orboul Personal Dev Portal

This repository is a lightweight static portal for quick access to Orboul tooling, links, and notes. The project is intentionally backend-free so it can be hosted anywhere that serves static files (GitHub Pages, Vercel, Netlify, S3, etc.).

## Running locally

Open `index.html` in a browser. No build tooling is required.

## Customising

- **Access key:** Update the `ACCESS_CODE` value near the top of `app.js`.
- **Launchpad tiles:** Edit the `state.launchpad` array in `app.js` with your own links and descriptions.
- **CLI snippets:** Update the `state.snippets` array to keep frequently used commands one click away.
- **Signals section:** Replace entries in `state.signals` with your own focus items or status checks.
- **Theme:** The site supports light and dark modes. The toggle persists the preference in `localStorage`.

## Scratchpad storage

The scratchpad writes to `localStorage` in the current browser, so notes never leave your machine. Clearing browser storage removes them. Replace this logic with an API call when you wire up a real backend.

## Adding real authentication later

1. Replace the client-side `validateAccessKey` function with an API call to your auth service.
2. On success, store a token (e.g., JWT) instead of the `localStorage` flag.
3. Use the token when fetching data for launchpad/snippets/signals instead of hard-coded arrays.

Until then, remember that the current access key is purely cosmetic and should not guard sensitive data.
