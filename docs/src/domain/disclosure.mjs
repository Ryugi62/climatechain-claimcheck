// Display text that sits next to a result. Pure strings; never read by the verdict code (SPEC G28, G29).
export const MATCH_LIMIT = 'Not an audit · Gold Standard record only';

// Title of the wording-check box: the two measured error counts, computed from the measurement file.
export function wordingErrorTitle(n) {
  return `changes caught ${n.changed.may_conflict}/${n.changed.n} · false alarms ${n.match.may_conflict}/${n.match.n}`;
}
