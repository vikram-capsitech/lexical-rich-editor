/// <reference lib="webworker" />

type WorkerReq =
  | { type: 'suggest'; searchText: string; cursorIndex?: number; token?: string }
  | { type: 'reward'; suggestionText: string; triggerText: string; token?: string }
  // Legacy shape (no `type` field) — kept for backward compat with storybookUseAutocompleteQuery
  | { searchText: string; cursorIndex?: number; token?: string };

type WorkerRes =
  | { type: 'suggest'; suggestions: string[] }
  | { type: 'reward'; ok: boolean }
  // Legacy shape
  | { suggestions: string[] };

const SUGGEST_URL = 'https://ai.servicesuat.actingoffice.com/api/convomail/suggest';
const REWARD_URL = 'https://ai.servicesuat.actingoffice.com/api/convomail/reward';

self.onmessage = async (event: MessageEvent<WorkerReq>) => {
  const data = event.data as any;

  // ── Reward call ─────────────────────────────────────────────────────────
  if (data.type === 'reward') {
    const { suggestionText, triggerText, token } = data;
    try {
      await fetch(REWARD_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          accepted_suggestion: suggestionText,
          context: triggerText,
        }),
      });
      (self as any).postMessage({ type: 'reward', ok: true } satisfies WorkerRes);
    } catch {
      (self as any).postMessage({ type: 'reward', ok: false } satisfies WorkerRes);
    }
    return;
  }

  // ── Suggest call (new shape + legacy shape) ──────────────────────────────
  const searchText: string = data.searchText ?? '';
  const token: string | undefined = data.token;

  if (!searchText.trim()) {
    // Legacy consumers expect `{ suggestions: [] }`
    (self as any).postMessage({ suggestions: [] } satisfies WorkerRes);
    return;
  }

  try {
    const response = await fetch(SUGGEST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ input_text: searchText, cursor_index: data.cursorIndex ?? undefined }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const body = await response.json();

    // API may return generated_text (primary) or improved_text (fallback)
    // Only treat non-empty strings as valid suggestions
    const raw = body?.generated_text || body?.improved_text || '';
    const suggestions: string[] = raw.trim() ? [String(raw)] : [];

    (self as any).postMessage({ suggestions } satisfies WorkerRes);
  } catch (err) {
    console.error('[AutoCompleteWorker] suggest error:', err);
    (self as any).postMessage({ suggestions: [] } satisfies WorkerRes);
  }
};
