@echo off
title Медицинский чат-помощник — DeepSeek V4 Pro + RAG
echo ============================================
echo   Запуск сервера медицинского чата
echo   DeepSeek V4 Pro + RAG
echo ============================================
echo.
echo 1. Убедитесь, что в rag/config.json указан API-ключ
echo 2. Поместите PDF-файлы литературы в папку literature\
echo 3. Запустите сборку индекса: node rag\build-index.mjs
echo.
echo ============================================
node server.mjs
pause
