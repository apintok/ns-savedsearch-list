import './style.css';

const TRANSFORMED_ATTR = 'data-ns-ssl-transformed';
const FILTER_INPUT_ID = 'ns-ssl-filter-input';
const MIN_RECORD_TYPES = 3;
const COLUMNS = 3;

/** Full sorted link list per table, used when filtering without re-reading the DOM. */
const tableLinks = new WeakMap<HTMLTableElement, HTMLAnchorElement[]>();

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
  /** Entry point: watches the page and transforms the search-type list when it appears. */
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

/**
 * Returns true when the URL is the New Saved Search picker (no search type selected yet).
 */
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

/**
 * Locates the search-type table, rebuilds it as a 3-column layout, and adds the filter bar.
 */
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
  tableLinks.set(table, sortedLinks);

  updateTableHeader(table);
  installFilterBar(table, sortedLinks.length);
  renderLinks(table, sortedLinks);

  table.setAttribute(TRANSFORMED_ATTR, 'true');
  table.classList.add('ns-ssl-transformed');
  document.documentElement.dataset.nsSsl = 'transformed';
}

/**
 * Finds the NetSuite list table that contains the "Search Type" record picker.
 */
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

/**
 * Checks whether a table is the search-type picker by its header and row count.
 */
function hasSearchTypeRows(table: HTMLTableElement): boolean {
  const header = table.querySelector(
    'thead [data-label="Search Type"], thead .listheader',
  );
  if (!header) {
    return false;
  }

  return collectLinksFromTable(table).length >= MIN_RECORD_TYPES;
}

/**
 * Extracts unique record-type links from the table body, one per row.
 */
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

/** Sorts record-type links alphabetically by their visible label. */
function sortLinks(links: HTMLAnchorElement[]): HTMLAnchorElement[] {
  return [...links].sort((a, b) =>
    getLinkLabel(a).localeCompare(getLinkLabel(b), undefined, {
      sensitivity: 'base',
    }),
  );
}

/** Expands the "Search Type" header cell to span all three columns. */
function updateTableHeader(table: HTMLTableElement): void {
  const headerCell = table.querySelector<HTMLTableCellElement>('thead td');
  if (headerCell) {
    headerCell.colSpan = COLUMNS;
  }
}

/**
 * Inserts a filter input row below the table header and wires it to live filtering.
 */
function installFilterBar(table: HTMLTableElement, totalCount: number): void {
  const thead = table.querySelector('thead');
  if (!thead || thead.querySelector('.ns-ssl-filter-row')) {
    return;
  }

  const row = document.createElement('tr');
  row.className = 'ns-ssl-filter-row';

  const cell = document.createElement('td');
  cell.colSpan = COLUMNS;
  cell.className = 'ns-ssl-filter-cell';

  const label = document.createElement('label');
  label.className = 'ns-ssl-filter-label';
  label.htmlFor = FILTER_INPUT_ID;

  const labelText = document.createElement('span');
  labelText.className = 'ns-ssl-filter-label-text';
  labelText.textContent = 'Filter search types:';

  const input = document.createElement('input');
  input.type = 'search';
  input.id = FILTER_INPUT_ID;
  input.className = 'ns-ssl-filter-input';
  input.placeholder = 'Search by name…';
  input.autocomplete = 'off';
  input.spellcheck = false;

  const status = document.createElement('span');
  status.className = 'ns-ssl-filter-status';
  status.dataset.total = String(totalCount);
  updateFilterStatus(status, totalCount, totalCount);

  input.addEventListener('input', () => {
    const allLinks = tableLinks.get(table) ?? [];
    const query = input.value.trim();
    const filtered = filterLinksByName(allLinks, query);
    renderLinks(table, filtered);
    updateFilterStatus(status, filtered.length, totalCount, query);
  });

  label.appendChild(labelText);
  label.appendChild(input);
  cell.appendChild(label);
  cell.appendChild(status);
  row.appendChild(cell);
  thead.appendChild(row);
}

/**
 * Updates the filter status text (total count, filtered count, or no-match message).
 */
function updateFilterStatus(
  status: HTMLSpanElement,
  visibleCount: number,
  totalCount: number,
  query = '',
): void {
  if (query && visibleCount === 0) {
    status.textContent = `No matches for “${query}”`;
    return;
  }

  if (query) {
    status.textContent = `Showing ${visibleCount} of ${totalCount}`;
    return;
  }

  status.textContent = `${totalCount} search types`;
}

/**
 * Returns links whose visible label contains the filter query (case-insensitive).
 */
function filterLinksByName(
  links: HTMLAnchorElement[],
  query: string,
): HTMLAnchorElement[] {
  if (!query) {
    return links;
  }

  const normalizedQuery = query.toLocaleLowerCase();
  return links.filter((link) =>
    getLinkLabel(link).toLocaleLowerCase().includes(normalizedQuery),
  );
}

/** Renders the given links into the table body. */
function renderLinks(table: HTMLTableElement, links: HTMLAnchorElement[]): void {
  rebuildTableBody(table, links);
}

/**
 * Replaces tbody content with a 3-column grid of links, or an empty-state row.
 */
function rebuildTableBody(table: HTMLTableElement, links: HTMLAnchorElement[]): void {
  const tbody = table.querySelector('tbody');
  if (!tbody) {
    return;
  }

  if (links.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.className = 'ns-ssl-empty-row';

    const emptyCell = document.createElement('td');
    emptyCell.colSpan = COLUMNS;
    emptyCell.className = 'ns-ssl-empty-cell listtext';
    emptyCell.textContent = 'No search types match your filter.';

    emptyRow.appendChild(emptyCell);
    tbody.replaceChildren(emptyRow);
    return;
  }

  const fragment = document.createDocumentFragment();

  for (let rowIndex = 0; rowIndex < Math.ceil(links.length / COLUMNS); rowIndex++) {
    fragment.appendChild(buildRow(rowIndex, links));
  }

  tbody.replaceChildren(fragment);
}

/**
 * Builds one table row with up to three record-type link cells.
 */
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
      cell.dataset.nsSslLabel = getLinkLabel(link);
      cell.appendChild(link);
    }

    row.appendChild(cell);
  }

  return row;
}

/**
 * Returns true when an anchor points to a saved-search record-type definition page.
 */
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

/** Returns true when a URL string contains a searchtype query parameter. */
function hasSearchTypeParam(value: string): boolean {
  return /[?&]searchtype=/i.test(value);
}

/** Returns true when a URL string references search.nl. */
function mentionsSearchNl(value: string): boolean {
  return /search\.nl/i.test(value);
}

/**
 * Builds a stable deduplication key from searchtype and rectype URL parameters.
 */
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

/** Returns the trimmed, normalized visible text of a record-type link. */
function getLinkLabel(anchor: HTMLAnchorElement): string {
  return anchor.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}
