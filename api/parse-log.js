import { parseJournalLog } from '../lib/parse-log.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  try {
    const result = await parseJournalLog(req.body, apiKey);
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to parse transcript' });
  }
}
