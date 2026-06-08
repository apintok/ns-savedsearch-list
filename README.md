# NetSuite Saved Search List

Chrome extension that reorganizes the NetSuite saved search record type picker on `/app/common/search/search.nl` from a long vertical list into a compact **3-column table**.

## Setup

```bash
npm install
node scripts/generate-icons.mjs
npm run dev
```

Load the unpacked extension from `.output/chrome-mv3-dev` in `chrome://extensions`.

## Usage

1. Install the extension.
2. In NetSuite, go to **Reports → Saved Searches → All Saved Searches → New**.
3. The record type list is displayed as a 3-column table, sorted alphabetically.

## Troubleshooting

After code changes, click **Reload** on the extension in `chrome://extensions`, then refresh the NetSuite tab.

On the record type page, open DevTools (F12) and run:

```js
document.documentElement.dataset.nsSsl
```

| Value | Meaning |
|-------|---------|
| `transformed` | Extension ran and rebuilt the list |
| `active` | Extension loaded, but could not find record-type links yet |
| `undefined` | Content script did not run (wrong URL or extension not loaded) |

In DevTools, use the console context dropdown and select the extension content script to see any errors.

## Build

```bash
npm run build
```

Production output is in `.output/chrome-mv3`.
