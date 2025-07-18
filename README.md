# Quicke

Quicke is a modern, multi-provider chat and productivity platform. It lets you chat with multiple language models side-by-side, manage your API keys, and organize your conversations—all in one place.

---

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [Docker](https://www.docker.com/)
- [pnpm](https://pnpm.io/) (optional, for faster installs)

---

## Features

- **Chat with Multiple Models:** Compare responses from different providers (OpenAI, Google Gemini, Anthropic, etc.) in a single interface.
- **Threaded Conversations:** Organize your chats into threads for easy reference.
- **File Uploads:** Attach files (PDFs, images, etc.) to your conversations.
- **API Key Management:** Securely store and manage your API keys for each provider.
- **Onboarding & Guest Mode:** Try Quicke as a guest, or sign up for more features.

---

## Getting Started

### 1. Clone the Repo
```sh
git clone https://github.com/your-username/quicke.git
cd quicke
```

### 2. Install Dependencies
We use [pnpm](https://pnpm.io/) for fast, workspace-aware installs:
```sh
pnpm install
```

### 3. Set Up Environment Variables
Copy the example files and fill in your secrets:
```sh
cp apps/api-worker/.env.example apps/api-worker/.env
cp apps/web/.env.example apps/web/.env.local
```
Edit these files and add your database URL, NextAuth secret, and any API keys you want to use.

### 4. Set Up the Database
If you’re using the default (Postgres) setup:
```sh
pnpm --filter @quicke/api-worker exec prisma migrate dev
```

### 5. Start the App
**Backend (API Worker, Docker):**
```sh
cd apps/api-worker
docker build -t quicke-api-worker .
docker run -p 8080:8080 --env-file .env quicke-api-worker
```
**Frontend (Web):**
```sh
pnpm --filter web dev
# or
cd apps/web
npm install
npm run dev
```

- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend API: [http://localhost:8080](http://localhost:8080)

---

## Project Structure

```
Quicke/
  apps/
    api-worker/      # Backend API (Express, Prisma)
    web/             # Frontend (Next.js, React)
  packages/
    db/              # Shared DB logic
    utils/           # Shared utilities
```

---

## Environment Variables

You’ll need to set these (see `.env.example` for details):
- `DATABASE_URL` (Postgres connection string)
- `NEXTAUTH_SECRET` (random string for session encryption)
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `SYSTEM_GEMINI_API_KEY` (optional, for model access)

---

## Endpoints

| Route               | Description                   |
|---------------------|-------------------------------|
| `/api/stream`       | Stream LLM completions        |
| `/api/summarize`    | Summarize content (text, file)|
| `/api/upload`       | Upload and store files        |

All endpoints require valid JWT in cookies.

---

## Contributing
Pull requests are welcome! If you find a bug or have a feature request, open an issue or submit a PR.

---

## License
MIT
