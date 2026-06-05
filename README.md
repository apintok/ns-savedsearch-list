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

## Build

```bash
npm run build
```

Production output is in `.output/chrome-mv3`.
