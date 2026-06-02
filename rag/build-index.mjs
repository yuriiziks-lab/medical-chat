/**
 * build-index.mjs — Шаг 4: сборка финального векторного индекса
 *
 * Использование:
 *   node rag/build-index.mjs
 *
 * Результат:
 *   Создаёт rag/index.json — готовый индекс для поиска
 *
 * Запускает шаги 1-3 последовательно, если промежуточных файлов нет.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));

const steps = [
    { file: 'extracted.json', script: 'extract-pdfs.mjs', label: 'Извлечение текста из PDF' },
    { file: 'chunked.json', script: 'chunk-text.mjs', label: 'Разбиение на чанки' },
    { file: 'embedded.json', script: 'generate-embeddings.mjs', label: 'Генерация эмбеддингов' }
];

console.log('🔨 Сборка векторного индекса\n');

for (const step of steps) {
    const stepPath = path.join(__dirname, step.file);
    if (!fs.existsSync(stepPath)) {
        console.log(`📌 Шаг: ${step.label}`);
        console.log(`   Запуск: node rag/${step.script}`);
        try {
            execSync(`node "${path.join(__dirname, step.script)}"`, {
                cwd: path.join(__dirname, '..'),
                stdio: 'inherit'
            });
        } catch (e) {
            console.error(`\n❌ Ошибка на шаге "${step.label}"`);
            process.exit(1);
        }
    } else {
        console.log(`✅ Шаг пропущен (файл уже существует): ${step.file}`);
    }
}

// Финальная сборка index.json
console.log('\n📦 Сборка index.json...');

const embedded = JSON.parse(fs.readFileSync(path.join(__dirname, 'embedded.json'), 'utf-8'));

const indexData = {
    chunks: embedded.map(c => ({
        id: c.id,
        text: c.text,
        metadata: c.metadata,
        embedding: c.embedding
    })),
    model: config.embedding_model,
    chunk_size: config.chunk_size,
    overlap: config.chunk_overlap,
    built_at: new Date().toISOString(),
    total_chunks: embedded.length
};

const indexPath = config.index_path;
fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 2), 'utf-8');

console.log(`\n✅ Индекс собран!`);
console.log(`   Всего чанков: ${indexData.total_chunks}`);
console.log(`   Файл: ${indexPath}`);
console.log(`\n📊 Статистика:`);
console.log(`   - Источников (PDF): ${new Set(embedded.map(c => c.metadata.source)).size}`);
console.log(`   - Размерность эмбеддингов: ${embedded[0]?.embedding?.length || 'N/A'}`);
