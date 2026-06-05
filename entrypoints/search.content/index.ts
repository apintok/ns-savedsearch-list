import './style.css';

const TABLE_ID = 'ns-ssl-record-type-table';
const MIN_RECORD_TYPES = 5;
const COLUMNS = 3;

const NETSUITE_SEARCH_MATCHES = [
  '*://*.app.netsuite.com/app/common/search/search.nl*',
  '*://*.sandbox.app.netsuite.com/app/common/search/search.nl*',
  '*://*.netsuite.com/app/common/search/search.nl*',
];

export default defineContentScript({
  matches: NETSUITE_SEARCH_MATCHES,
  runAt: 'document_idle',
  cssInjectionMode: 'manifest',
  main() {
    if (!isRecordTypeSelectionPage()) {
      return;
    }

    transformWhenReady();

    const observer = new MutationObserver(() => {
      if (document.getElementById(TABLE_ID)) {
        return;
      }
      transformWhenReady();
    });

    observer.observe(document.body, { childList: true, subtree: true });
  },
});

function isRecordTypeSelectionPage(): boolean {
  const url = new URL(location.href);

  if (!url.pathname.endsWith('/app/common/search/search.nl')) {
    return false;
  }

  const hasSearchContext =
    url.searchParams.has('searchtype') ||
    url.searchParams.has('id') ||
    url.searchParams.has('e') ||
    url.searchParams.has('searchid');

  return !hasSearchContext;
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
}

function findRecordTypeLinks(): HTMLAnchorElement[] {
  const seen = new Set<string>();
  const links: HTMLAnchorElement[] = [];

  for (const anchor of document.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    if (!isRecordTypeLink(anchor)) {
      continue;
    }

    const key = anchor.href;
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
  if (!/search\.nl/i.test(href) || !/searchtype=/i.test(href)) {
    return false;
  }

  const label = getLinkLabel(anchor);
  return label.length > 0;
}

function getLinkLabel(anchor: HTMLAnchorElement): string {
  return anchor.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

function findListContainer(links: HTMLAnchorElement[]): HTMLElement | null {
  const firstLink = links[0];
  let node: HTMLElement | null = firstLink.parentElement;

  while (node && node !== document.body) {
    const containedLinks = node.querySelectorAll('a[href*="search.nl"][href*="searchtype="]');
    if (containedLinks.length === links.length) {
      return node;
    }
    node = node.parentElement;
  }

  return firstLink.parentElement;
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
        cell.appendChild(cloneRecordTypeLink(link));
      }

      row.appendChild(cell);
    }

    tbody.appendChild(row);
  }

  table.appendChild(tbody);
  return table;
}

function cloneRecordTypeLink(source: HTMLAnchorElement): HTMLAnchorElement {
  const link = document.createElement('a');
  link.href = source.href;
  link.textContent = getLinkLabel(source);
  link.title = source.title || getLinkLabel(source);

  for (const className of source.classList) {
    link.classList.add(className);
  }

  return link;
}
