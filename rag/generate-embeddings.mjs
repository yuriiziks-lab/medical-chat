/**
 * generate-embeddings.mjs — Шаг 3: генерация эмбеддингов через DeepSeek API
 *
 * Использование:
 *   node rag/generate-embeddings.mjs
 *
 * Результат:
 *   Создаёт rag/embedded.json — чанки с эмбеддингами
 *
 * Примечание:
 *   DeepSeek поддерживает эмбеддинги через /v1/embeddings endpoint.
 *   Если модель deepseek-embedding-v2 недоступна, скрипт предложит
 *   использовать OpenAI text-embedding-3-small или Ollama nomic-embed-text.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));

const inputPath = path.join(__dirname, 'chunked.json');
const outputPath = path.join(__dirname, 'embedded.json');

if (!fs.existsSync(inputPath)) {
    console.error(`❌ Файл не найден: ${inputPath}`);
    console.error('   Сначала выполните: node rag/chunk-text.mjs');
    process.exit(1);
}

const chunks = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
const apiKey = config.api_key;

if (!apiKey) {
    console.error('❌ API-ключ не задан. Отредактируйте rag/config.json');
    console.error('   Укажите ваш DeepSeek API-ключ в поле "api_key"');
    process.exit(1);
}

console.log(`📄 Загружено чанков: ${chunks.length}`);
console.log(`🤖 Модель эмбеддингов: ${config.embedding_model}`);
console.log(`🌐 API: ${config.api_base}`);

const BATCH_SIZE = 20; // отправляем пачками по 20
const results = [];

for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map(c => c.text);

    console.log(`  📤 Отправка пачки ${i / BATCH_SIZE + 1}/${Math.ceil(chunks.length / BATCH_SIZE)} (${texts.length} чанков)...`);

    try {
        const res = await fetch(`${config.api_base}/v1/embeddings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: config.embedding_model,
                input: texts
            })
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`HTTP ${res.status}: ${errText}`);
        }

        const data = await res.json();

        data.data.forEach((item, idx) => {
            results.push({
                ...batch[idx],
                embedding: item.embedding
            });
        });

        // Небольшая задержка, чтобы не превысить rate limit
        if (i + BATCH_SIZE < chunks.length) {
            await new Promise(r => setTimeout(r, 200));
        }

    } catch (err) {
        console.error(`     ❌ Ошибка пачки ${i / BATCH_SIZE + 1}: ${err.message}`);

        // Если ошибка из-за модели эмбеддингов — показываем подсказку
        if (err.message.includes('model') || err.message.includes('not found')) {
            console.error('');
            console.error('💡 DeepSeek может не поддерживать эмбеддинги через /v1/embeddings.');
            console.error('   Альтернативы:');
            console.error('   1. OpenAI:  model: "text-embedding-3-small", api_base: "https://api.openai.com"');
            console.error('   2. Ollama:  model: "nomic-embed-text", api_base: "http://localhost:11434"');
            console.error('');
            console.error('   Отредактируйте rag/config.json и укажите нужного провайдера.');
        }

        process.exit(1);
    }
}

// Сохраняем результат
fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');
console.log(`\n✅ Эмбеддинги сгенерированы. Чанков с эмбеддингами: ${results.length}`);
console.log(`   Размерность эмбеддинга: ${results[0]?.embedding?.length || 'N/A'}`);
console.log(`   Файл: ${outputPath}`);
