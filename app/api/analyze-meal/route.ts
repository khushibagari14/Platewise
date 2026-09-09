import { MealAnalysis, MealItem } from '@/lib/nutrition';

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_IMAGES = 4;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const requests = new Map<string, number[]>();

function safeNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 10) / 10 : 0;
}

function validateAnalysis(value: unknown): MealAnalysis | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  if (!Array.isArray(source.items) || source.items.length < 1 || source.items.length > 20) return null;
  const items: MealItem[] = source.items.map((entry) => {
    const item = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
    return {
      id: crypto.randomUUID(), name: (typeof item.name === 'string' ? item.name : 'Unknown food').slice(0, 80),
      portion: (typeof item.portion === 'string' ? item.portion : 'Estimated serving').slice(0, 60), quantity: 1,
      calories: safeNumber(item.calories), protein: safeNumber(item.protein),
      carbs: safeNumber(item.carbs), fat: safeNumber(item.fat), fiber: safeNumber(item.fiber),
    };
  });
  const confidence = source.confidence === 'high' || source.confidence === 'low' ? source.confidence : 'medium';
  const notes = Array.isArray(source.notes) ? source.notes.slice(0, 3).map((note) => String(note).slice(0, 220)) : [];
  return { title: (typeof source.title === 'string' ? source.title : 'Your meal').slice(0, 90), items, confidence, notes };
}

function checkRateLimit(request: Request): boolean {
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0] || 'local';
  const now = Date.now();
  const recent = (requests.get(ip) || []).filter((time) => now - time < 60_000);
  if (recent.length >= 6) return false;
  recent.push(now);
  requests.set(ip, recent);
  if (requests.size > 500) requests.clear();
  return true;
}

function parseModelJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(cleaned); } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { return null; }
  }
}

export async function POST(request: Request) {
  try {
    if (!checkRateLimit(request)) return Response.json({ error: 'Too many scans at once. Please wait a minute and try again.' }, { status: 429 });
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return Response.json({ error: 'Meal analysis is not available right now. Please try again later.' }, { status: 503 });
    const form = await request.formData();
    const images = form.getAll('images').filter((entry): entry is File => entry instanceof File);
    if (!images.length || images.length > MAX_IMAGES) return Response.json({ error: `Please add between 1 and ${MAX_IMAGES} meal photos.` }, { status: 400 });
    if (images.some((image) => !ALLOWED.has(image.type))) return Response.json({ error: 'Please use JPEG, PNG or WebP photos.' }, { status: 415 });
    if (images.some((image) => image.size > MAX_BYTES)) return Response.json({ error: 'Each photo must be under 8 MB.' }, { status: 413 });

    const imageParts = await Promise.all(images.map(async (image) => {
      const bytes = new Uint8Array(await image.arrayBuffer());
      let binary = '';
      for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
      return { inline_data: { mime_type: image.type, data: btoa(binary) } };
    }));
    const requestBody = JSON.stringify({
        contents: [{ role: 'user', parts: [
          { text: `Analyze these ${images.length} photo(s) as different views of one meal. Identify visible foods and estimate the pictured portions. Do not count an item twice when it appears in multiple photos. Return JSON only. If this is not food, return an empty items array. Do not give medical advice. Nutrient values must be per listed portion and use grams except calories.` },
          ...imageParts,
        ] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT', required: ['title', 'items', 'confidence', 'notes'],
            properties: {
              title: { type: 'STRING' },
              confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] },
              notes: { type: 'ARRAY', items: { type: 'STRING' } },
              items: { type: 'ARRAY', items: { type: 'OBJECT', required: ['name', 'portion', 'calories', 'protein', 'carbs', 'fat', 'fiber'], properties: {
                name: { type: 'STRING' }, portion: { type: 'STRING' }, calories: { type: 'NUMBER' },
                protein: { type: 'NUMBER' }, carbs: { type: 'NUMBER' }, fat: { type: 'NUMBER' }, fiber: { type: 'NUMBER' },
              } } },
            },
          },
          maxOutputTokens: 2048,
          temperature: .2,
        },
      });
    const configuredModel = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
    const models = [...new Set([configuredModel, 'gemini-3.5-flash', 'gemini-flash-latest'])];
    let geminiResponse: Response | null = null;
    for (const model of models) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);
      try {
        geminiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: requestBody,
        });
      } catch (error) {
        if (model !== models.at(-1)) continue;
        throw error;
      } finally {
        clearTimeout(timeout);
      }
      if (geminiResponse.ok || [401, 403].includes(geminiResponse.status)) break;
    }
    if (!geminiResponse) return Response.json({ error: 'Meal analysis is not available right now. Please try again.' }, { status: 503 });
    if (!geminiResponse.ok) {
      const status = geminiResponse.status === 429 ? 429 : 502;
      return Response.json({ error: status === 429 ? 'Meal analysis is busy right now. Please wait a moment and retry.' : 'We could not read these photos. Please try again.' }, { status });
    }
    const payload = await geminiResponse.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = payload.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text;
    if (!text) return Response.json({ error: 'We could not find food in that photo. Try a clearer picture of the whole meal.' }, { status: 422 });
    const parsed = validateAnalysis(parseModelJson(text));
    if (!parsed?.items.length) return Response.json({ error: 'We could not find food in that photo. Try a clearer picture of the whole meal.' }, { status: 422 });
    return Response.json(parsed);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return Response.json({ error: 'The analysis took too long. Please try again.' }, { status: 504 });
    return Response.json({ error: 'We could not analyze this meal. Please try again.' }, { status: 500 });
  }
}
