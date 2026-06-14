/**
 * Local dev: static site + WebSocket bridge to Gemini Live Translate (STT).
 * Usage: npm install && npm run dev → http://localhost:3000
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import { GoogleGenAI, Modality } from '@google/genai';
import { parseJournalLog } from '../lib/parse-log.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(ROOT, '.env') });

const PORT = Number(process.env.PORT) || 3000;
const GEMINI_LIVE_MODEL =
  process.env.GEMINI_LIVE_MODEL || 'gemini-3.5-live-translate-preview';
const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

if (!API_KEY) {
  console.error('Missing GEMINI_API_KEY in .env');
  process.exit(1);
}

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.sql': 'text/plain',
};

function mergeTranscript(locked, chunk) {
  chunk = (chunk || '').trim();
  if (!chunk) return (locked || '').trim();
  locked = (locked || '').trim();
  if (!locked) return chunk;
  if (locked === chunk || locked.endsWith(chunk)) return locked;
  if (chunk.indexOf(locked) === 0) return chunk;
  if (locked.indexOf(chunk) >= 0) return locked;
  const sep = locked.match(/[.!?]$/) ? ' ' : '. ';
  return locked + sep + chunk;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function jsonResponse(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function handleParseLog(req, res) {
  if (req.method !== 'POST') {
    jsonResponse(res, 405, { error: 'Method not allowed' });
    return;
  }
  try {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};
    const result = await parseJournalLog(body, API_KEY);
    jsonResponse(res, result.status, result.body);
  } catch (err) {
    console.error('parse-log:', err);
    jsonResponse(res, 500, { error: 'Failed to parse transcript' });
  }
}

function serveStatic(req, res) {
  const urlPath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(ROOT, safe);

  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const urlPath = req.url.split('?')[0];
  if (urlPath === '/api/parse-log') {
    await handleParseLog(req, res);
    return;
  }
  serveStatic(req, res);
});

const wss = new WebSocketServer({ server, path: '/live-stt' });
const ai = new GoogleGenAI({ apiKey: API_KEY });

wss.on('connection', (ws) => {
  let session = null;
  let closed = false;
  let lockedTranscript = '';
  let utteranceTranscript = '';

  const sendDisplay = (finished, turnComplete = false, lastChunk = '') => {
    const display = mergeTranscript(lockedTranscript, utteranceTranscript);
    const chunk = lastChunk || utteranceTranscript || '';
    const tag = turnComplete ? 'turn' : finished ? 'final' : 'interim';
    console.log(`[${tag}] ${chunk || display}`);
    ws.send(
      JSON.stringify({
        type: 'transcript',
        display,
        locked: lockedTranscript,
        utterance: utteranceTranscript,
        chunk,
        finished: Boolean(finished),
        turnComplete: Boolean(turnComplete),
      }),
    );
  };

  const fail = (message) => {
    if (!closed) ws.send(JSON.stringify({ type: 'error', message }));
  };

  (async () => {
    try {
      session = await ai.live.connect({
        model: GEMINI_LIVE_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          translationConfig: {
            targetLanguageCode: 'en',
            echoTargetLanguage: true,
          },
        },
        callbacks: {
          onmessage: (message) => {
            if (closed) return;
            const content = message.serverContent;
            if (!content) return;

            if (content.inputTranscription?.text) {
              const chunk = content.inputTranscription.text;
              const finished = Boolean(content.inputTranscription.finished);
              if (finished) {
                lockedTranscript = mergeTranscript(lockedTranscript, chunk);
                utteranceTranscript = '';
              } else {
                utteranceTranscript = chunk;
              }
              sendDisplay(finished, false, chunk);
            }

            if (content.turnComplete) {
              if (utteranceTranscript.trim()) {
                const pending = utteranceTranscript;
                lockedTranscript = mergeTranscript(lockedTranscript, pending);
                utteranceTranscript = '';
                sendDisplay(true, true, pending);
              } else {
                sendDisplay(false, true);
              }
            }

            if (message.error) {
              fail(String(message.error));
            }
          },
          onerror: (e) => fail(e?.message || 'Live API error'),
          onclose: () => {
            if (!closed) ws.close();
          },
        },
      });
      ws.send(JSON.stringify({ type: 'ready', model: GEMINI_LIVE_MODEL }));
    } catch (err) {
      console.error('Live connect failed:', err);
      fail(err.message || 'Failed to connect to Gemini Live');
      ws.close();
    }
  })();

  ws.on('message', async (raw) => {
    if (!session) return;
    try {
      const msg = JSON.parse(String(raw));
      if (msg.type === 'prefix' && typeof msg.text === 'string') {
        lockedTranscript = msg.text.trim();
        utteranceTranscript = '';
        sendDisplay(false);
        return;
      }
      if (msg.type === 'audio' && msg.data) {
        await session.sendRealtimeInput({
          audio: {
            data: msg.data,
            mimeType: 'audio/pcm;rate=16000',
          },
        });
      }
    } catch (err) {
      console.error('sendRealtimeInput:', err);
      fail(err.message || 'Failed to send audio');
    }
  });

  ws.on('close', () => {
    closed = true;
    try {
      session?.close();
    } catch (_) {
      /* ignore */
    }
  });
});

server.listen(PORT, () => {
  console.log(`Meta Journal local dev: http://localhost:${PORT}`);
  console.log(`Gemini Live STT: ${GEMINI_LIVE_MODEL}`);
  console.log(`WebSocket: ws://localhost:${PORT}/live-stt`);
  console.log(`Parse API:  http://localhost:${PORT}/api/parse-log`);
});
