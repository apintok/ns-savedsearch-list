import './style.css';

const TRANSFORMED_ATTR = 'data-ns-ssl-transformed';
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
      if (findSearchTypeTable()?.hasAttribute(TRANSFORMED_ATTR)) {
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
  const table = findSearchTypeTable();
  if (!table || table.hasAttribute(TRANSFORMED_ATTR)) {
    return;
  }

  const links = collectLinksFromTable(table);
  if (links.length < MIN_RECORD_TYPES) {
    return;
  }

  const sortedLinks = sortLinks(links);
  rebuildTableBody(table, sortedLinks);
  updateTableHeader(table);

  table.setAttribute(TRANSFORMED_ATTR, 'true');
  table.classList.add('ns-ssl-transformed');
  document.documentElement.dataset.nsSsl = 'transformed';
}

function findSearchTypeTable(): HTMLTableElement | null {
  const byId = document.querySelector<HTMLTableElement>('table#__tab');
  if (byId && hasSearchTypeRows(byId)) {
    return byId;
  }

  for (const table of document.querySelectorAll<HTMLTableElement>(
    'table.listtable, table.uir-list-table',
  )) {
    if (hasSearchTypeRows(table)) {
      return table;
    }
  }

  return null;
}

function hasSearchTypeRows(table: HTMLTableElement): boolean {
  const header = table.querySelector(
    'thead [data-label="Search Type"], thead .listheader',
  );
  if (!header) {
    return false;
  }

  return collectLinksFromTable(table).length >= MIN_RECORD_TYPES;
}

function collectLinksFromTable(table: HTMLTableElement): HTMLAnchorElement[] {
  const seen = new Set<string>();
  const links: HTMLAnchorElement[] = [];

  for (const row of table.querySelectorAll<HTMLTableRowElement>('tbody tr')) {
    const anchor = row.querySelector<HTMLAnchorElement>('a[href]');
    if (!anchor || !isRecordTypeLink(anchor)) {
      continue;
    }

    const key = getLinkKey(anchor);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    links.push(anchor);
  }

  return links;
}

function sortLinks(links: HTMLAnchorElement[]): HTMLAnchorElement[] {
  return [...links].sort((a, b) =>
    getLinkLabel(a).localeCompare(getLinkLabel(b), undefined, {
      sensitivity: 'base',
    }),
  );
}

function updateTableHeader(table: HTMLTableElement): void {
  const headerCell = table.querySelector<HTMLTableCellElement>('thead td');
  if (headerCell) {
    headerCell.colSpan = COLUMNS;
  }
}

function rebuildTableBody(table: HTMLTableElement, links: HTMLAnchorElement[]): void {
  const tbody = table.querySelector('tbody');
  if (!tbody) {
    return;
  }

  const fragment = document.createDocumentFragment();

  for (let rowIndex = 0; rowIndex < Math.ceil(links.length / COLUMNS); rowIndex++) {
    fragment.appendChild(buildRow(rowIndex, links));
  }

  tbody.replaceChildren(fragment);
}

function buildRow(rowIndex: number, links: HTMLAnchorElement[]): HTMLTableRowElement {
  const row = document.createElement('tr');
  row.className =
    rowIndex % 2 === 0
      ? 'uir-list-row-tr uir-list-row-even'
      : 'uir-list-row-tr uir-list-row-odd';
  row.id = `row${rowIndex}`;

  for (let columnIndex = 0; columnIndex < COLUMNS; columnIndex++) {
    const cell = document.createElement('td');
    cell.className = 'listtext uir-list-row-cell';
    cell.dataset.listCellType = 'string';

    const link = links[rowIndex * COLUMNS + columnIndex];
    if (link) {
      cell.appendChild(link);
    }

    row.appendChild(cell);
  }

  return row;
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

  return getLinkLabel(anchor).length > 0;
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
    const searchtype = url.searchParams.get('searchtype')?.toLowerCase() ?? '';
    const rectype = url.searchParams.get('rectype') ?? '';
    return `${searchtype}:${rectype}`;
  } catch {
    return anchor.href;
  }
}

function getLinkLabel(anchor: HTMLAnchorElement): string {
  return anchor.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}
