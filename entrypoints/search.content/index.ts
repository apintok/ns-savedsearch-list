import './style.css';

const TABLE_ID = 'ns-ssl-record-type-table';
const MIN_RECORD_TYPES = 3;
const COLUMNS = 3;

const NETSUITE_SEARCH_MATCHES = [
  '*://*.app.netsuite.com/app/common/search/search.nl*',
  '*://*.sandbox.app.netsuite.com/app/common/search/search.nl*',
  '*://*.netsuite.com/app/common/search/search.nl*',
];

export default defineContentScript({
  matches: NETSUITE_SEARCH_MATCHES,
  allFrames: true,
  matchOriginAsFallback: true,
  runAt: 'document_idle',
  cssInjectionMode: 'manifest',
  main() {
    if (!isRecordTypeSelectionPage()) {
      return;
    }

    document.documentElement.dataset.nsSsl = 'active';

    transformWhenReady();

    const observer = new MutationObserver(() => {
      if (document.getElementById(TABLE_ID)) {
        return;
      }
      transformWhenReady();
    });

    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.body, { childList: true, subtree: true });
        transformWhenReady();
      });
    }

    window.setTimeout(transformWhenReady, 500);
    window.setTimeout(transformWhenReady, 1500);
    window.setTimeout(transformWhenReady, 3000);
  },
});

function isRecordTypeSelectionPage(): boolean {
  const url = new URL(location.href);

  if (!/\/app\/common\/search\/search\.nl\/?$/i.test(url.pathname)) {
    return false;
  }

  if (url.searchParams.has('searchtype')) {
    return false;
  }

  if (url.searchParams.has('id') || url.searchParams.has('searchid')) {
    return false;
  }

  return true;
}

function transformWhenReady(): void {
  if (document.getElementById(TABLE_ID)) {
    return;
  }

  const links = findRecordTypeLinks();
  if (links.length < MIN_RECORD_TYPES) {
    return;
  }

  const container = findListContainer(links);
  if (!container) {
    return;
  }

  const table = buildTable(links);
  container.replaceChildren(table);
  document.documentElement.dataset.nsSsl = 'transformed';
}

function findRecordTypeLinks(): HTMLAnchorElement[] {
  const seen = new Set<string>();
  const links: HTMLAnchorElement[] = [];

  for (const anchor of document.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    if (!isRecordTypeLink(anchor)) {
      continue;
    }

    const key = getLinkKey(anchor);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    links.push(anchor);
  }

  return links.sort((a, b) =>
    getLinkLabel(a).localeCompare(getLinkLabel(b), undefined, {
      sensitivity: 'base',
    }),
  );
}

function isRecordTypeLink(anchor: HTMLAnchorElement): boolean {
  const href = anchor.getAttribute('href') ?? '';
  const resolved = anchor.href;

  if (!hasSearchTypeParam(href) && !hasSearchTypeParam(resolved)) {
    return false;
  }

  if (!mentionsSearchNl(href) && !mentionsSearchNl(resolved)) {
    return false;
  }

  const label = getLinkLabel(anchor);
  return label.length > 0;
}

function hasSearchTypeParam(value: string): boolean {
  return /[?&]searchtype=/i.test(value);
}

function mentionsSearchNl(value: string): boolean {
  return /search\.nl/i.test(value);
}

function getLinkKey(anchor: HTMLAnchorElement): string {
  try {
    const url = new URL(anchor.href, location.origin);
    return url.searchParams.get('searchtype')?.toLowerCase() ?? anchor.href;
  } catch {
    return anchor.href;
  }
}

function getLinkLabel(anchor: HTMLAnchorElement): string {
  return anchor.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

function findListContainer(links: HTMLAnchorElement[]): HTMLElement | null {
  const firstLink = links[0];
  let node: HTMLElement | null = firstLink.parentElement;
  let best: HTMLElement | null = null;

  while (node && node !== document.body) {
    const containedLinks = [...node.querySelectorAll<HTMLAnchorElement>('a[href]')].filter(
      isRecordTypeLink,
    );

    if (containedLinks.length >= links.length) {
      best = node;
    }

    node = node.parentElement;
  }

  return best ?? firstLink.parentElement;
}

function buildTable(links: HTMLAnchorElement[]): HTMLTableElement {
  const table = document.createElement('table');
  table.id = TABLE_ID;
  table.className = 'ns-ssl-table uir-list-table';

  const tbody = document.createElement('tbody');

  for (let rowIndex = 0; rowIndex < Math.ceil(links.length / COLUMNS); rowIndex++) {
    const row = document.createElement('tr');

    for (let columnIndex = 0; columnIndex < COLUMNS; columnIndex++) {
      const cell = document.createElement('td');
      const link = links[rowIndex * COLUMNS + columnIndex];

      if (link) {
        cell.appendChild(link);
      }

      row.appendChild(cell);
    }

    tbody.appendChild(row);
  }

  table.appendChild(tbody);
  return table;
}
