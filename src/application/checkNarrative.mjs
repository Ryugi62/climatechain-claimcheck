import { recordText, narrativeOf, classifyReceipt, RECEIPT, RECEIPT_LABEL } from '../domain/narrative.mjs';

// port: nli.infer([{premise, hypothesis}]) -> Promise<[{entail, contradict, neutral}]>
// Never touches the verdict. A failing model gives NO_RECEIPT plus the error text.
export async function checkNarrative({ text, record }, { nli }) {
  const narrative = narrativeOf(text);
  const none = (extra = {}) => ({ receipt: RECEIPT.NO_RECEIPT, label: RECEIPT_LABEL.NO_RECEIPT, narrative, ...extra });
  if (!record || !narrative || narrative.split(/\s+/).length < 3) return none();
  const premise = recordText(record);
  try {
    const [inf] = await nli.infer([{ premise, hypothesis: narrative }]);
    const receipt = classifyReceipt(inf);
    return { receipt, label: RECEIPT_LABEL[receipt], narrative, premise, inference: inf };
  } catch (e) {
    return none({ error: String((e && e.message) || e) });
  }
}
