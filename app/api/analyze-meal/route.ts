import { MealAnalysis, MealItem } from '@/lib/nutrition';

const MAX_BYTES = 8 * 1024 * 1024;
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

export async function POST(request: Request) {
  try {
    if (!checkRateLimit(request)) return Response.json({ error: 'Too many scans at once. Please wait a minute and try again.' }, { status: 429 });
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return Response.json({ error: 'Gemini is not connected yet. Add your API key to the local environment, then try again.' }, { status: 503 });
    const form = await request.formData();
    const image = form.get('image');
    if (!(image instanceof File)) return Response.json({ error: 'Please add a meal photo.' }, { status: 400 });
    if (!ALLOWED.has(image.type)) return Response.json({ error: 'Please use a JPEG, PNG or WebP photo.' }, { status: 415 });
    if (image.size > MAX_BYTES) return Response.json({ error: 'That photo is too large. Please try one under 8 MB.' }, { status: 413 });

    const bytes = new Uint8Array(await image.arrayBuffer());
    let binary = '';
    for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    const imageData = btoa(binary);
    const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35_000);
    const geminiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [
          { text: 'Analyze this meal photo for an everyday nutrition estimate. Identify visible foods and estimate the pictured portions. Return JSON only. If this is not food, return an empty items array. Do not give medical advice. Nutrient values must be per listed portion and use grams except calories.' },
          { inline_data: { mime_type: image.type, data: imageData } },
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
          temperature: .2,
        },
      }),
    });
    clearTimeout(timeout);
    if (!geminiResponse.ok) {
      const status = geminiResponse.status === 429 ? 429 : 502;
      return Response.json({ error: status === 429 ? 'Gemini is busy right now. Please wait a moment and retry.' : 'Gemini could not read this photo. Please try again.' }, { status });
    }
    const payload = await geminiResponse.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = payload.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text;
    if (!text) return Response.json({ error: 'We could not find food in that photo. Try a clearer picture of the whole meal.' }, { status: 422 });
    const parsed = validateAnalysis(JSON.parse(text));
    if (!parsed?.items.length) return Response.json({ error: 'We could not find food in that photo. Try a clearer picture of the whole meal.' }, { status: 422 });
    return Response.json(parsed);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return Response.json({ error: 'The analysis took too long. Please try again.' }, { status: 504 });
    return Response.json({ error: 'We could not analyze this meal. Please try again.' }, { status: 500 });
  }
}
