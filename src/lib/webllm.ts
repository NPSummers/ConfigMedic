import type { ConfigType, Diagnostic } from './types';

export const preferredModel = 'gemma-4-E2B-it-q4f16_1-MLC';
export const modelLabel = 'Gemma 4 E2B';
let engine: any = null;
let loadedModel = '';

export async function loadWebLLM(onProgress?: (message: string) => void) {
  if (engine) return { model: loadedModel, engine };
  onProgress?.('Loading WebLLM runtime…');
  const webllm = await import('@mlc-ai/web-llm');
  const models = webllm.prebuiltAppConfig.model_list.map((item: { model_id: string }) => item.model_id);
  const model = models.includes(preferredModel)
    ? preferredModel
    : models.find((item: string) => /^gemma-4-/i.test(item))
      || models.find((item: string) => /gemma.*it/i.test(item))
      || models.find((item: string) => /Qwen.*Coder.*1\.5B/i.test(item))
      || models.find((item: string) => /Qwen.*Instruct/i.test(item))
      || models[0];
  if (!model) throw new Error('No WebLLM model is available in the current model catalog.');
  engine = await webllm.CreateMLCEngine(model, {
    initProgressCallback: (progress: { text?: string }) => onProgress?.(progress.text || 'Downloading model weights…'),
  });
  loadedModel = model;
  return { model, engine };
}

export async function askWebLLM(source: string, type: ConfigType, diagnostics: Diagnostic[], onProgress?: (message: string) => void) {
  const session = await loadWebLLM(onProgress);
  const prompt = `You are ConfigMedic, a cautious infrastructure configuration reviewer. Analyze this ${type} configuration. Return ONLY valid JSON with this exact shape: {"summary":"short sentence","diagnostics":[{"line":1,"severity":"error|warning|info","title":"...","detail":"...","fix":"..."}],"corrected":"full corrected configuration"}. Preserve the user's intent. Do not invent services, credentials, or secret values. Keep corrected as a complete replacement file. Existing deterministic findings: ${JSON.stringify(diagnostics)}.\n\nCONFIGURATION:\n${source}`;
  const response = await session.engine.chat.completions.create({
    messages: [
      { role: 'system', content: 'You are an expert DevOps reviewer. Be precise, conservative, and return JSON only.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.1,
    max_tokens: 1600,
  });
  const content = response.choices?.[0]?.message?.content || '';
  const json = content.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error('The local model did not return structured JSON.');
  const parsed = JSON.parse(json) as { summary?: string; diagnostics?: Array<Partial<Diagnostic>>; corrected?: string };
  const modelDiagnostics: Diagnostic[] = (parsed.diagnostics || []).map((item, index) => ({
    id: `webllm-${index}`,
    line: Math.max(1, Number(item.line) || 1),
    severity: item.severity === 'error' || item.severity === 'info' ? item.severity : 'warning',
    title: item.title || 'Model observation',
    detail: item.detail || 'The local model flagged this line for review.',
    fix: item.fix || 'Review the surrounding configuration and apply the smallest safe change.',
    source: 'webllm',
  }));
  return { model: session.model, summary: parsed.summary || 'Local model review complete.', diagnostics: modelDiagnostics, corrected: parsed.corrected || source };
}
