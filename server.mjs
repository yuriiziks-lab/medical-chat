/**
 * server.mjs — Бэкенд-сервер для медицинского чата с RAG
 *
 * Объединяет:
 * - Чат с DeepSeek V4 Pro
 * - RAG-поиск по медицинской литературе
 *
 * Запуск:
 *   node server.mjs
 *
 * Сервер слушает на http://localhost:3000
 * HTML-чат доступен по http://localhost:3000
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Загрузка конфига
let config;
try {
    config = JSON.parse(fs.readFileSync(path.join(__dirname, 'rag', 'config.json'), 'utf-8'));
} catch {
    config = {};
}

// Приоритет: переменная окружения (Render.com) -> config.json -> пустая строка
const API_KEY = process.env.DEEPSEEK_API_KEY || config.api_key || '';
const LLM_MODEL = process.env.LLM_MODEL || config.llm_model || 'deepseek-v4-flash';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || config.embedding_model || 'deepseek-embedding-v2';
const DEEPSEEK_BASE = process.env.DEEPSEEK_BASE || config.api_base || 'https://api.deepseek.com';

const PORT = process.env.PORT || 3000;

// MIME-типы для статики
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.json': 'application/json',
    '.css': 'text/css',
    '.png': 'image/png',
    '.ico': 'image/x-icon'
};

/**
 * Косинусное сходство
 */
function cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
}

/**
 * Загрузка индекса
 */
let indexCache = null;
function loadIndex() {
    if (indexCache) return indexCache;
    const indexPath = path.resolve(__dirname, config.index_path || './rag/index.json');
    if (fs.existsSync(indexPath)) {
        indexCache = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
        console.log(`📚 Индекс загружен: ${indexCache.total_chunks} чанков`);
    } else {
        console.log('📚 Индекс не найден. RAG отключён.');
        indexCache = { chunks: [] };
    }
    return indexCache;
}

/**
 * Генерация эмбеддинга через DeepSeek API
 */
async function getEmbedding(text) {
    if (!API_KEY) return null;

    const res = await fetch(`${DEEPSEEK_BASE}/v1/embeddings`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
            model: EMBEDDING_MODEL,
            input: [text]
        })
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.data[0].embedding;
}

/**
 * RAG-поиск
 */
async function searchRAG(query) {
    const index = loadIndex();
    if (index.chunks.length === 0) return [];

    const queryEmb = await getEmbedding(query);
    if (!queryEmb) return [];

    const scored = index.chunks.map(chunk => ({
        chunk,
        similarity: cosineSimilarity(queryEmb, chunk.embedding)
    }));

    return scored
        .filter(s => s.similarity >= config.similarity_threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, config.top_k);
}

/**
 * Запрос к DeepSeek LLM
 */
async function queryDeepSeek(messages) {
    if (!API_KEY) {
        return { error: 'API-ключ не настроен на сервере. Укажите его в rag/config.json' };
    }

    const res = await fetch(`${DEEPSEEK_BASE}/v1/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
            model: LLM_MODEL,
            messages: messages,
            max_tokens: 8192
        })
    });

    if (!res.ok) {
        const errText = await res.text();
        return { error: `API error ${res.status}: ${errText}` };
    }

    return await res.json();
}

// --- HTTP-сервер ---
const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = url.pathname;

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // --- API: чат ---
    if (pathname === '/api/chat' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { message, history } = JSON.parse(body);

                // 1. RAG-поиск
                const ragResults = await searchRAG(message);
                let contextText = '';
                if (ragResults.length > 0) {
                    contextText = ragResults.map(r =>
                        `[Источник: ${r.chunk.metadata.source}, стр. ${r.chunk.metadata.page}]\n${r.chunk.text}`
                    ).join('\n\n---\n\n');
                    console.log(`🔍 RAG: найдено ${ragResults.length} чанков`);
                }

                // 2. Формируем сообщения
                const systemPrompt = `ТЫ — ДИАГНОСТИЧЕСКИЙ ПОМОЩНИК. Твоя задача — собрать анамнез через серию наводящих вопросов и выдать список возможных заболеваний с указанием процента совпадения.

ПРОТОКОЛ РАБОТЫ:

1. ПЕРВЫЙ ШАГ — СБОР СИМПТОМОВ
   Попроси пользователя описать основные симптомы: локализация, характер боли/дискомфорта, длительность, интенсивность по шкале 0-10.

2. ВТОРОЙ ШАГ — НАВОДЯЩИЕ ВОПРОСЫ (минимум 5, максимум 12)
   Задавай вопросы ПО ОДНОМУ за раз. Дождись ответа перед следующим вопросом.
   Используй следующие категории вопросов (выбирай релевантные):

   А) ХАРАКТЕР И ДИНАМИКА СИМПТОМОВ:
   - Когда именно появились первые симптомы? (дата/время)
   - Как началось: внезапно или постепенно, в течение нескольких дней/недель?
   - Какова интенсивность по шкале от 0 до 10? Меняется ли со временем?
   - Боль/дискомфорт постоянные или приступообразные? Если приступы — как долго длятся?

   Б) ЛОКАЛИЗАЦИЯ И ИРРАДИАЦИЯ:
   - Где именно ощущается симптом? Можете показать пальцем?
   - Отдаёт ли боль/ощущение в другие части тела? (например, в руку, челюсть, спину, ногу)

   В) ПРОВОЦИРУЮЩИЕ И ОБЛЕГЧАЮЩИЕ ФАКТОРЫ:
   - Что усиливает симптомы? (движение, еда, дыхание, положение тела, стресс)
   - Что облегчает симптомы? (покой, тепло/холод, лекарства, определённая поза)

   Г) СОПУТСТВУЮЩИЕ СИМПТОМЫ:
   - Есть ли температура, озноб, потливость?
   - Есть ли тошнота, рвота, диарея, запор?
   - Есть ли слабость, головокружение, одышка?
   - Есть ли изменения аппетита, веса, сна?

   Д) АНАМНЕЗ И ФАКТОРЫ РИСКА:
   - Были ли подобные симптомы раньше? Если да — как часто и чем лечили?
   - Есть ли хронические заболевания? (диабет, гипертония, астма, гастрит и т.д.)
   - Принимаете ли регулярно какие-либо лекарства?
   - Есть ли аллергия на лекарства или продукты?
   - Курите, употребляете алкоголь? Как часто?
   - Есть ли наследственные заболевания у близких родственников?

   Е) ОБРАЗ ЖИЗНИ И КОНТЕКСТ:
   - Чем вы занимаетесь (работа, физическая активность)?
   - Были ли недавно травмы, операции, инфекции?
   - Путешествовали ли недавно? Был ли контакт с больными?
   - У женщин: есть ли беременность? Когда был последний менструальный цикл?

3. ТРЕТИЙ ШАГ — ПРЕДВАРИТЕЛЬНЫЙ АНАЛИЗ
   После сбора информации (не менее 5 ответов пользователя) выдай структурированный список:

   ## Возможные состояния (вероятность ≥50%)

   | Заболевание | Вероятность | Ключевые совпадения |
   |---|---|---|
   | [Название] | [%] | [какие симптомы совпадают] |
   | [Название] | [%] | [какие симптомы совпадают] |

   Формула расчёта вероятности: (количество совпавших симптомов / общее количество характерных симптомов для данного заболевания) × 100%.
   Указывай ТОЛЬКО состояния с вероятностью ≥50%.

4. ЧЕТВЁРТЫЙ ШАГ — РЕКОМЕНДАЦИИ
   После списка добавь:
   - К какому врачу рекомендовано обратиться
   - Какие обследования могут потребоваться
   - Срочность визита (если симптомы опасные — подчеркни)

ВАЖНЫЕ ПРАВИЛА:
- Все ответы на русском языке.
- Основывайся на доказательной медицине (клинические рекомендации, МКБ-10/11).
- Если симптомов недостаточно для ≥50% — задай ещё вопросы, не выдавай пустой список.
- При подозрении на неотложное состояние (инфаркт, инсульт, анафилаксия и т.д.) — сразу напиши "⚠️ НЕОТЛОЖНОЕ СОСТОЯНИЕ" и рекомендацию вызвать скорую.
- НЕ назначай лечение и дозировки.
- НЕ давай окончательный диагноз — только список возможных состояний.`;

                // Добавляем контекст из литературы, если есть
                let userMessage = message;
                if (contextText) {
                    userMessage = `Вопрос пользователя: ${message}\n\nКонтекст из медицинской литературы:\n${contextText}`;
                }

                const messages = [
                    { role: 'system', content: systemPrompt },
                    ...(history || []),
                    { role: 'user', content: userMessage }
                ];

                // 3. Запрос к DeepSeek
                const result = await queryDeepSeek(messages);

                if (result.error) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: result.error }));
                    return;
                }

                // 4. Ответ
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    reply: result.choices[0].message.content,
                    reasoning: result.choices[0].message.reasoning_content || '',
                    sources: ragResults.map(r => ({
                        source: r.chunk.metadata.source,
                        page: r.chunk.metadata.page,
                        similarity: r.similarity
                    }))
                }));

            } catch (e) {
                console.error('❌ Ошибка:', e);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    // --- API: проверка статуса ---
    if (pathname === '/api/status' && req.method === 'GET') {
        const index = loadIndex();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            api_key_configured: !!API_KEY,
            index_loaded: index.chunks.length > 0,
            total_chunks: index.chunks.length,
            model: LLM_MODEL,
            embedding_model: EMBEDDING_MODEL
        }));
        return;
    }

    // --- Статика ---
    let filePath = pathname === '/' ? '/medical-chat-deepseek.html' : pathname;
    filePath = path.join(__dirname, filePath);

    const ext = path.extname(filePath);
    const contentType = MIME[ext] || 'application/octet-stream';

    try {
        const content = fs.readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
    } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 — файл не найден');
    }
});

server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════╗
║   🏥 Медицинский чат-помощник           ║
║   DeepSeek V4 Pro + RAG                 ║
║                                          ║
║   Сервер запущен: http://localhost:${PORT}  ║
╚══════════════════════════════════════════╝
  `);
    console.log(`📋 API:`);
    console.log(`   POST /api/chat    — чат с RAG`);
    console.log(`   GET  /api/status  — статус сервера`);
    console.log(`   GET  /            — HTML-чат`);
    console.log('');
    loadIndex();
});
