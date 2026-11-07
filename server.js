import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';

const root = path.dirname(fileURLToPath(import.meta.url));
const dev = process.argv.includes('--dev');
const port = Number(process.env.PORT || 3000);
const limits = new Map();

if (!process.env.GEMINI_API_KEY) {
  try {
    const env = await readFile(path.join(root, '.env.local'), 'utf8');
    const match = env.match(/^\s*GEMINI_API_KEY\s*=\s*(.*)\s*$/m);
    if (match) process.env.GEMINI_API_KEY = match[1].replace(/^['"]|['"]$/g, '');
  } catch { /* Production should set GEMINI_API_KEY in its environment. */ }
}

const functionDeclarations = [
  { name: 'location', parameters: { type: Type.OBJECT, description: 'Geographic coordinates of a location.', properties: {
    name: { type: Type.STRING, description: 'Name of the location.' },
    description: { type: Type.STRING, description: 'Description of the location and its relevance.' },
    lat: { type: Type.STRING, description: 'Latitude.' }, lng: { type: Type.STRING, description: 'Longitude.' },
    time: { type: Type.STRING, description: 'Time of day to visit.' }, duration: { type: Type.STRING, description: 'Suggested visit duration.' },
    sequence: { type: Type.NUMBER, description: 'Order in the itinerary.' },
  }, required: ['name', 'description', 'lat', 'lng'] } },
  { name: 'line', parameters: { type: Type.OBJECT, description: 'Connection between two locations.', properties: {
    name: { type: Type.STRING, description: 'Route name.' },
    start: { type: Type.OBJECT, properties: { lat: { type: Type.STRING }, lng: { type: Type.STRING } } },
    end: { type: Type.OBJECT, properties: { lat: { type: Type.STRING }, lng: { type: Type.STRING } } },
    transport: { type: Type.STRING, description: 'Transportation method.' }, travelTime: { type: Type.STRING, description: 'Estimated travel time.' },
  }, required: ['name', 'start', 'end'] } },
];

function json(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(value));
}

async function api(req, res) {
  if (req.method !== 'POST' || req.url !== '/api/plan') return json(res, 404, { error: 'İstek bulunamadı.' });
  const ip = req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = limits.get(ip);
  if (entry && now - entry.start < 60_000 && entry.count >= 15) return json(res, 429, { error: 'Çok fazla istek. Bir dakika sonra tekrar deneyin.' });
  limits.set(ip, !entry || now - entry.start >= 60_000 ? { start: now, count: 1 } : { start: entry.start, count: entry.count + 1 });
  try {
    let raw = '';
    for await (const part of req) {
      raw += part;
      if (raw.length > 16_000) return json(res, 413, { error: 'İstek çok uzun.' });
    }
    const { prompt, plannerMode, systemInstruction } = JSON.parse(raw || '{}');
    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 2_000 || typeof plannerMode !== 'boolean' || typeof systemInstruction !== 'string' || systemInstruction.length > 12_000) {
      return json(res, 400, { error: 'İstek bilgileri geçersiz.' });
    }
    if (!process.env.GEMINI_API_KEY) return json(res, 503, { error: 'Sunucuda Gemini API anahtarı yapılandırılmamış.' });
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const stream = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash', contents: plannerMode ? `${prompt} day trip` : prompt,
      config: { systemInstruction, temperature: 1, tools: [{ functionDeclarations }] },
    });
    const functionCalls = [];
    for await (const chunk of stream) functionCalls.push(...(chunk.functionCalls ?? []));
    return json(res, 200, { functionCalls });
  } catch (error) {
    console.error('Gemini request failed:', error?.message || 'Unknown error');
    return json(res, 502, { error: 'Gemini yanıtı alınamadı. Lütfen tekrar deneyin.' });
  }
}

let vite;
if (dev) {
  const { createServer: createViteServer } = await import('vite');
  vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
}

const server = createServer((req, res) => {
  if (req.url?.startsWith('/api/')) return void api(req, res);
  if (vite) return vite.middlewares(req, res, (err) => {
    if (err) { console.error(err); if (!res.headersSent) res.writeHead(500).end('Server error'); }
    else if (!res.writableEnded) res.writeHead(404).end('Not found');
  });
  void (async () => {
    try {
      const requested = decodeURIComponent((req.url || '/').split('?')[0]);
      const rel = requested === '/' ? 'index.html' : requested.replace(/^\/+/, '');
      const dist = path.resolve(root, 'dist');
      let file = path.resolve(dist, rel);
      if (!file.startsWith(dist + path.sep)) return res.writeHead(403).end();
      if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
      const data = await readFile(file);
      const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' }[path.extname(file)] || 'application/octet-stream';
      res.writeHead(200, { 'content-type': mime }).end(data);
    } catch { res.writeHead(404).end('Not found'); }
  })();
});
server.listen(port, '0.0.0.0', () => console.log(`Maps Planner listening on port ${port}`));
process.on('SIGTERM', () => { server.close(); vite?.close(); });
process.on('SIGINT', () => { server.close(); vite?.close(); });
