/**
 * extract-pdfs.mjs — Шаг 1: извлечение текста из PDF-файлов
 *
 * Использование:
 *   node rag/extract-pdfs.mjs
 *
 * Результат:
 *   Создаёт rag/extracted.json — массив объектов { source, page, text }
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Загружаем конфиг
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));
const literatureDir = config.literature_dir;
const outputPath = path.join(__dirname, 'extracted.json');

// Динамический импорт pdf-parse
let pdfParse;
try {
    pdfParse = (await import('pdf-parse')).default;
} catch (e) {
    console.error('❌ Библиотека pdf-parse не установлена. Выполните: npm install pdf-parse');
    process.exit(1);
}

// Проверяем существование папки с литературой
if (!fs.existsSync(literatureDir)) {
    console.error(`❌ Папка не найдена: ${literatureDir}`);
    console.error('   Создайте папку и поместите в неё PDF-файлы.');
    process.exit(1);
}

// Собираем все PDF-файлы
const pdfFiles = fs.readdirSync(literatureDir)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .map(f => path.join(literatureDir, f));

if (pdfFiles.length === 0) {
    console.error(`❌ В папке ${literatureDir} не найдено PDF-файлов.`);
    process.exit(1);
}

console.log(`📄 Найдено PDF-файлов: ${pdfFiles.length}`);

const allDocs = [];

for (const filePath of pdfFiles) {
    const fileName = path.basename(filePath);
    console.log(`  📖 Обработка: ${fileName}`);

    const dataBuffer = fs.readFileSync(filePath);

    try {
        const data = await pdfParse(dataBuffer);
        const pages = data.text.split('\f'); // символ разрыва страницы

        pages.forEach((pageText, idx) => {
            const trimmed = pageText.trim();
            if (trimmed.length > 20) { // отбрасываем пустые страницы
                allDocs.push({
                    source: fileName,
                    page: idx + 1,
                    text: trimmed
                });
            }
        });

        console.log(`     ✅ Извлечено страниц: ${pages.length}`);
    } catch (err) {
        console.error(`     ❌ Ошибка при обработке ${fileName}: ${err.message}`);
    }
}

// Сохраняем результат
fs.writeFileSync(outputPath, JSON.stringify(allDocs, null, 2), 'utf-8');
console.log(`\n✅ Извлечение завершено. Сохранено документов: ${allDocs.length}`);
console.log(`   Файл: ${outputPath}`);
