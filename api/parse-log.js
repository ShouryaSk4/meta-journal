const SYSTEM_PROMPT = `You extract structured daily journal data from spoken or typed natural language.

Return ONLY valid JSON with this exact shape (no extra keys):
{
  "sc": {
    "health": number 1-10,
    "work": number 1-10,
    "mind": number 1-10,
    "money": number 1-10,
    "rel": number 1-10,
    "growth": number 1-10,
    "spirit": number 1-10,
    "disc": number 1-10,
    "energy": number 1-10,
    "day": number 1-10 (0.5 steps allowed, e.g. 7.5)
  },
  "sleep": number or null (hours),
  "workout_type": string or null,
  "workout_min": number or null,
  "deep": number or null (deep work hours),
  "waste": number or null (wasted hours),
  "spirit_time": number or null (inner/spiritual time in minutes),
  "output": string or null (what shipped / main output),
  "win": string or null,
  "mistake": string or null,
  "fix": string or null,
  "why": string or null (why this day score)
}

Rules:
- Infer scores from sentiment and explicit ratings. If the user says "health was pretty good, like 8" use 8.
- If a score is not mentioned, use 6 as default.
- Clamp all sc values: integers 1-10 except day which can be 0.5 increments 1-10.
- Extract numbers for sleep, deep work, waste, workout minutes when mentioned.
- Keep text fields concise (one line each).
- "relationships" / "relations" maps to sc.rel.
- "discipline" maps to sc.disc.
- "inner self" / "spirit" / "meditation" maps to sc.spirit and possibly spirit_time.`;

const AUDIO_USER_PROMPT =
  'Listen to this voice memo about my day. Transcribe what I said, then extract the journal JSON as specified in the system instruction.';

// Journal parsing model (override with GEMINI_MODEL env on Vercel / .env)
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not set on the server' });
  }

  const { transcript, audio, audioMime } = req.body || {};
  let parts;

  if (audio && typeof audio === 'string' && audio.trim()) {
    parts = [
      { inline_data: { mime_type: audioMime || 'audio/webm', data: audio.trim() } },
      { text: AUDIO_USER_PROMPT },
    ];
  } else if (transcript && typeof transcript === 'string' && transcript.trim()) {
    parts = [{ text: transcript.trim() }];
  } else {
    return res.status(400).json({ error: 'transcript or audio is required' });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  try {
    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini error:', errText);
      return res.status(502).json({ error: 'Gemini request failed' });
    }

    const data = await geminiRes.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      console.error('Gemini empty response:', JSON.stringify(data));
      return res.status(502).json({ error: 'Empty model response' });
    }

    const parsed = JSON.parse(content);
    return res.status(200).json({ data: parsed, model: GEMINI_MODEL });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to parse transcript' });
  }
}
