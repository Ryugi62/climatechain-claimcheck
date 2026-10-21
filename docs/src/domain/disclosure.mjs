// Display text that sits next to a result. Pure strings; never read by the verdict code (SPEC G28, G29).
export const MATCH_LIMIT = 'Not an audit · Gold Standard record only';

// Title of the wording-check box: the two measured error counts, computed from the measurement file.
export function wordingErrorTitle(n) {
  return `changes caught ${n.changed.may_conflict}/${n.changed.n} · false alarms ${n.match.may_conflict}/${n.match.n}`;
}

const TITLE = { MATCH: 'Match', MISMATCH: 'Mismatch', NOT_FOUND: 'Not found', DUPLICATE: 'Double use', NO_SERIAL: 'No serial to check' };
// Big result title. A sentence without a serial that is checked by company name must not be titled "nothing to check" above a card that reports a result.
export function verdictTitle(verdict, { byCompany = false } = {}) {
  return verdict === 'NO_SERIAL' && byCompany ? 'No serial: checked by company name' : TITLE[verdict];
}

// Text of one serial line when the sentence quantity differs from the registry range (the serial itself was found and is retired).
const LINE_TEXT = { quantity_differs: 'Serial found, retired in the registry; the quantity in the sentence differs.' };
export function lineText(reason) { return LINE_TEXT[reason] || null; }
