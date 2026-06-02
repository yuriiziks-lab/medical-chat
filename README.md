# 🏥 Медицинский чат-помощник (DeepSeek V4 Flash + RAG)

Диагностический чат-бот на базе DeepSeek V4 Flash с RAG-поиском по медицинской литературе.

## Быстрый старт (локально)

```bash
# 1. Установить зависимости
npm install

# 2. Указать API-ключ DeepSeek
#    Откройте rag/config.json и укажите api_key

# 3. Поместить PDF-файлы литературы в папку Libr/

# 4. Собрать индекс
npm run build-index

# 5. Запустить сервер
npm start
#    Откройте http://localhost:3000
```

---

## Деплой на Render.com (бесплатно)

### Шаг 1: Подготовить репозиторий на GitHub

1. Создайте новый репозиторий на [github.com](https://github.com)
2. Загрузите туда файлы проекта (кроме `node_modules/`, `Libr/`, `rag/index.json`)

```bash
# Пример через Git Bash
cd C:\Med_New_Ai
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/ВАШ_АККАУНТ/medical-chat.git
git push -u origin main
```

### Шаг 2: Создать Web Service на Render.com — пошагово

#### 2.1. Войти в дашборд Render.com

1. Откройте браузер и перейдите на [dashboard.render.com](https://dashboard.render.com)
2. Если у вас нет аккаунта — нажмите **Sign Up** и зарегистрируйтесь через GitHub, GitLab или Google
3. После входа вы попадёте на главную панель управления (Dashboard)

#### 2.2. Начать создание Web Service

1. В правом верхнем углу нажмите кнопку **New +**
2. В выпадающем меню выберите **Web Service**

   > *Render покажет экран «Connect a repository»*

#### 2.3. Подключить GitHub (если ещё не подключён)

1. Если вы видите список репозиториев — переходите к шагу 2.4
2. Если видите кнопку **Connect GitHub** — нажмите её
3. Откроется окно авторизации GitHub. Нажмите **Authorize Render**
4. Вас вернёт на Render.com, и он покажет список ваших репозиториев

#### 2.4. Выбрать репозиторий

1. Найдите в списке репозиторий `medical-chat` (или тот, который вы создали в Шаге 1)
2. Нажмите на него — он выделится синим
3. Нажмите кнопку **Connect** внизу экрана

   > *Render перейдёт к экрану настройки Web Service*

#### 2.5. Заполнить основную конфигурацию

На экране **«Create Web Service»** заполните поля:

| Поле | Что ввести | Пояснение |
|------|-----------|-----------|
| **Name** | `medical-chat` | Будет частью URL: `medical-chat.onrender.com` |
| **Region** | Выберите `Frankfurt (EU)` | Самый близкий регион к Европе, минимальная задержка |
| **Branch** | `main` | Ветка GitHub, из которой деплоить |
| **Runtime** | Выберите `Node` | Render сам определит версию Node из `package.json` |
| **Build Command** | `npm install` | Установит зависимости (`pdf-parse`, `mime-types`) |
| **Start Command** | `node server.mjs` | Команда запуска сервера |
| **Plan** | Выберите **Free** | Бесплатный план: 512 MB RAM, 100 GB bandwidth |

> **Важно:** Поле **Root Directory** оставьте пустым (проект в корне репозитория).

#### 2.6. Добавить переменные окружения (Environment Variables)

1. Прокрутите страницу вниз до раздела **Environment Variables**
2. Нажмите кнопку **Add Environment Variable** — появится пара полей Key / Value
3. Добавьте **все** переменные по очереди:

| # | Key | Value | Описание |
|---|-----|-------|----------|
| 1 | `DEEPSEEK_API_KEY` | `sk-...ваш-ключ...` | API-ключ DeepSeek (обязательно) |
| 2 | `LLM_MODEL` | `deepseek-v4-flash` | Модель для ответов |
| 3 | `EMBEDDING_MODEL` | `deepseek-embedding-v2` | Модель для эмбеддингов |
| 4 | `DEEPSEEK_BASE` | `https://api.deepseek.com` | Базовый URL DeepSeek API |
| 5 | `NODE_VERSION` | `22` | Фиксирует версию Node.js |

**Как добавить каждую переменную:**

1. Нажмите **Add Environment Variable**
2. В поле **Key** введите `DEEPSEEK_API_KEY`
3. В поле **Value** вставьте ваш API-ключ (начинается с `sk-`)
4. Повторите для остальных переменных

> **Важно:** Значение `DEEPSEEK_API_KEY` будет скрыто звёздочками — это нормально. Render шифрует секреты.

#### 2.7. Дополнительные настройки (Advanced)

Если хотите настроить **Health Check Path** (рекомендуется):

1. Нажмите **Advanced** (под полями конфигурации)
2. В поле **Health Check Path** введите `/api/status`
3. Это позволит Render проверять, что сервер работает

#### 2.8. Создать Web Service

1. Прокрутите страницу в самый низ
2. Нажмите кнопку **Create Web Service**

   > *Render начнёт процесс деплоя. Вы увидите экран с логами в реальном времени.*

#### 2.9. Дождаться деплоя

1. На экране отображается лог сборки (Build Log)
2. Render выполнит последовательно:
   - `Cloning repository...` — клонирование вашего репозитория
   - `Installing dependencies...` — запуск `npm install`
   - `Starting service...` — запуск `node server.mjs`
3. Когда в логе появится строка:
   ```
   Server running on port 10000
   ```
   — это значит, что сервер запущен
4. Render покажет зелёный статус **「Live」** и URL сервиса:
   ```
   https://medical-chat.onrender.com
   ```
5. Нажмите на этот URL — откроется ваш чат

> **На бесплатном плане:** первый запуск может занять 1-2 минуты. При последующих обращениях после простоя — 5-10 секунд «холодного старта».

### Шаг 3: Дождаться деплоя

Render.com автоматически:
- Установит зависимости (`npm install`)
- Запустит сервер (`node server.mjs`)
- Предоставит URL вида: `https://medical-chat.onrender.com`

### Шаг 4: Загрузить медицинскую литературу

На бесплатном плане Render.com нет постоянного диска. Есть два варианта:

**Вариант A: Встроить PDF в репозиторий (если файлы небольшие, < 500 MB)**

```bash
# Создать папку Libr/ в репозитории
mkdir Libr
# Скопировать PDF
cp /path/to/books.pdf Libr/
# Закоммитить и запушить
git add Libr/
git commit -m "Add medical literature"
git push
```

Render.com автоматически передеплоит проект. Затем нужно собрать индекс:

```bash
# Подключиться к Render Shell (в дашборде: Shell)
cd /opt/render/project/src
node rag/build-index.mjs
```

**Вариант B: Использовать Render Disk (платный, от $5/мес)**

В Advanced настройках Web Service добавить Disk:
- **Mount Path**: `/opt/render/project/src/Libr`
- **Size**: 1 GB

### Шаг 5: Разместить чат на вашем сайте

1. Скачайте файл [`medical-chat-deepseek.html`](medical-chat-deepseek.html)
2. Переименуйте в `chat.html`
3. Откройте и найдите строку:
   ```javascript
   const SERVER_BASE = 'http://localhost:3000';
   ```
4. Замените на адрес вашего сервера на Render.com:
   ```javascript
   const SERVER_BASE = 'https://medical-chat.onrender.com';
   ```
5. Загрузите `chat.html` на ваш shared hosting через FTP
6. Добавьте ссылку на других страницах:
   ```html
   <a href="/chat.html">Медицинский чат-помощник</a>
   ```

### Шаг 6: Проверить

Откройте `https://ваш-сайт.com/chat.html` и переключитесь в режим **«Сервер (RAG)»**.

Если сервер онлайн — индикатор покажет зелёный статус.

---

## Особенности бесплатного плана Render.com

| Особенность | Описание |
|-------------|----------|
| **Сон без активности** | Сервер "засыпает" через 15 минут без запросов. Первый запрос после сна — 5-10 секунд |
| **Ограничение RAM** | 512 MB |
| **Ограничение bandwidth** | 100 GB/месяц |
| **Постоянное хранилище** | Нет (только эфемерный диск). Нужен Render Disk ($) или встраивать файлы в репозиторий |
| **Uptime** | Не гарантируется на бесплатном плане |

---

## Структура проекта

```
C:\Med_New_Ai\
├── medical-chat-deepseek.html   ← HTML-чат (фронтенд)
├── server.mjs                   ← Node.js сервер с RAG
├── render.yaml                  ← Конфигурация для Render.com
├── package.json
├── .gitignore
├── README.md
├── Libr\                        ← Сюда класть PDF-файлы литературы
├── plans\
│   └── deployment-architecture.md
└── rag\
    ├── config.json              ← Конфигурация
    ├── extract-pdfs.mjs         ← Извлечение текста из PDF
    ├── chunk-text.mjs           ← Разбиение на чанки
    ├── generate-embeddings.mjs  ← Генерация эмбеддингов
    ├── build-index.mjs          ← Сборщик индекса
    └── search.mjs               ← Поиск по индексу
```

## Переменные окружения (Render.com)

| Переменная | Описание | Значение по умолчанию |
|-----------|----------|----------------------|
| `DEEPSEEK_API_KEY` | API-ключ DeepSeek | (обязательно) |
| `LLM_MODEL` | Модель для чата | `deepseek-v4-flash` |
| `EMBEDDING_MODEL` | Модель для эмбеддингов | `deepseek-embedding-v2` |
| `DEEPSEEK_BASE` | Базовый URL API | `https://api.deepseek.com` |
| `PORT` | Порт сервера | `3000` (Render устанавливает автоматически) |
