/**
 * search.mjs — Шаг 5: поиск релевантных чанков по запросу
 *
 * Использование (CLI):
 *   node rag/search.mjs "боль в животе после еды"
 *
 * Использование (модуль):
 *   import { searchChunks } from './rag/search.mjs';
 *   const results = await searchChunks('боль в животе');
 *
 * Результат:
 *   Массив чанков, отсортированных по косинусному сходству (top-K)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));

/**
 * Косинусное сходство между двумя векторами
 */
function cosineSimilarity(a, b) {
    if (a.length !== b.length) return 0;
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
 * Загружает индекс
 */
function loadIndex() {
    const indexPath = config.index_path;
    if (!fs.existsSync(indexPath)) {
        console.error(`❌ Индекс не найден: ${indexPath}`);
        console.error('   Сначала выполните: node rag/build-index.mjs');
        process.exit(1);
    }
    return JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
}

/**
 * Генерирует эмбеддинг для текста запроса через DeepSeek API
 */
async function getQueryEmbedding(text) {
    const apiKey = config.api_key;
    if (!apiKey) {
        throw new Error('API-ключ не задан в config.json');
    }

    const res = await fetch(`${config.api_base}/v1/embeddings`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: config.embedding_model,
            input: [text]
        })
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    return data.data[0].embedding;
}

/**
 * Поиск релевантных чанков
 * @param {string} query - текст запроса
 * @param {number} [topK] - количество результатов (по умолчанию из config)
 * @param {number} [threshold] - минимальный порог сходства
 * @returns {Array<{chunk: Object, similarity: number}>}
 */
export async function searchChunks(query, topK, threshold) {
    topK = topK || config.top_k;
    threshold = threshold || config.similarity_threshold;

    const index = loadIndex();
    const queryEmbedding = await getQueryEmbedding(query);

    // Вычисляем сходство со всеми чанками
    const scored = index.chunks.map(chunk => ({
        chunk,
        similarity: cosineSimilarity(queryEmbedding, chunk.embedding)
    }));

    // Фильтруем по порогу и сортируем
    const filtered = scored
        .filter(s => s.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);

    return filtered;
}

// CLI-режим
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('search.mjs')) {
    const query = process.argv.slice(2).join(' ');
    if (!query) {
        console.error('❌ Укажите поисковый запрос:');
        console.error('   node rag/search.mjs "боль в животе после еды"');
        process.exit(1);
    }

    console.log(`🔍 Поиск: "${query}"`);
    console.log(`📐 Top-K: ${config.top_k}, порог: ${config.similarity_threshold}\n`);

    const results = await searchChunks(query);

    if (results.length === 0) {
        console.log('😕 Ничего не найдено. Попробуйте изменить запрос.');
        process.exit(0);
    }

    console.log(`✅ Найдено результатов: ${results.length}\n`);

    results.forEach((r, i) => {
        console.log(`--- Результат ${i + 1} (сходство: ${(r.similarity * 100).toFixed(1)}%) ---`);
        console.log(`📁 ${r.chunk.metadata.source}, стр. ${r.chunk.metadata.page}`);
        console.log(`📝 ${r.chunk.text.slice(0, 300)}...`);
        console.log('');
    });
}
