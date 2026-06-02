/**
 * chunk-text.mjs — Шаг 2: разбиение извлечённого текста на чанки
 *
 * Использование:
 *   node rag/chunk-text.mjs
 *
 * Результат:
 *   Создаёт rag/chunked.json — массив чанков с метаданными
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));

const inputPath = path.join(__dirname, 'extracted.json');
const outputPath = path.join(__dirname, 'chunked.json');

if (!fs.existsSync(inputPath)) {
    console.error(`❌ Файл не найден: ${inputPath}`);
    console.error('   Сначала выполните: node rag/extract-pdfs.mjs');
    process.exit(1);
}

const docs = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
const CHUNK_SIZE = config.chunk_size;
const OVERLAP = config.chunk_overlap;

console.log(`📄 Загружено документов: ${docs.length}`);
console.log(`📐 Размер чанка: ${CHUNK_SIZE} символов, перекрытие: ${OVERLAP}`);

const chunks = [];
let chunkId = 0;

for (const doc of docs) {
    const text = doc.text;
    let start = 0;

    while (start < text.length) {
        const end = Math.min(start + CHUNK_SIZE, text.length);

        // Берём чанк
        let chunkText = text.slice(start, end);

        // Пытаемся разбить по границе предложения или абзаца
        if (end < text.length) {
            // Ищем последнюю точку с пробелом или перенос строки
            const lastPeriod = chunkText.lastIndexOf('. ');
            const lastNewline = chunkText.lastIndexOf('\n\n');
            const splitAt = Math.max(lastPeriod, lastNewline);

            if (splitAt > CHUNK_SIZE * 0.5) {
                // Если нашли хорошую границу — режем там
                chunkText = text.slice(start, start + splitAt + 1);
                start = start + splitAt + 1 - OVERLAP;
            } else {
                start = end - OVERLAP;
            }
        } else {
            start = text.length;
        }

        chunkText = chunkText.trim();
        if (chunkText.length > 50) {
            chunks.push({
                id: chunkId++,
                text: chunkText,
                metadata: {
                    source: doc.source,
                    page: doc.page
                }
            });
        }
    }
}

fs.writeFileSync(outputPath, JSON.stringify(chunks, null, 2), 'utf-8');
console.log(`\n✅ Разбиение завершено. Создано чанков: ${chunks.length}`);
console.log(`   Файл: ${outputPath}`);
