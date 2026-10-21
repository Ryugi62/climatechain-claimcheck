// Adapter: NLI model behind the checkNarrative port. The library is injected (browser: vendored transformers.web, node: the npm package),
// so nothing here imports a framework. Inference only; no training.
export const NLI_MODEL = 'Xenova/nli-deberta-v3-xsmall';

/** Map raw logits to entail/contradict/neutral using the model's own id2label. */
export function toInference(logits, id2label) {
  const m = Math.max(...logits);
  const ex = logits.map((x) => Math.exp(x - m));
  const z = ex.reduce((a, b) => a + b, 0);
  const out = { entail: 0, contradict: 0, neutral: 0 };
  ex.forEach((e, i) => {
    const name = String(id2label[i] ?? id2label[String(i)]).toLowerCase();
    const p = e / z;
    if (name.startsWith('entail')) out.entail = p;
    else if (name.startsWith('contra')) out.contradict = p;
    else out.neutral = p;
  });
  return out;
}

export function createTransformersNli({ load, id = NLI_MODEL, dtype = 'q8', device, onProgress } = {}) {
  let ready = null;
  const init = () => (ready ??= load().then(async (t) => ({
    tok: await t.AutoTokenizer.from_pretrained(id, { progress_callback: onProgress }),
    model: await t.AutoModelForSequenceClassification.from_pretrained(id, { dtype, ...(device ? { device } : {}), progress_callback: onProgress }),
  })));
  return {
    warm: init,
    async infer(pairs) {
      if (!pairs.length) return [];
      const { tok, model } = await init();
      const enc = await tok(pairs.map((p) => p.premise), { text_pair: pairs.map((p) => p.hypothesis), padding: true, truncation: true, max_length: 256 });
      const { logits } = await model(enc);
      const [n, k] = logits.dims;
      const data = logits.data;
      const out = [];
      for (let i = 0; i < n; i++) out.push(toInference(Array.from(data.subarray(i * k, (i + 1) * k)), model.config.id2label));
      return out;
    },
  };
}
