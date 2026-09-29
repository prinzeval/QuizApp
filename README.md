# SmartQuiz (frontend)

React + TypeScript + Vite. Talks to the API in `../quizapp-be`.

```bash
npm install
cp .env.example .env.local   # points at the API (default http://localhost:6969/api/v1)
npm run dev                  # starts on 5173, or the next free port
npm test                     # unit tests
npm run build                # typecheck + production build
```

Start the backend first (see `quizapp-be/README.md`), then open the URL Vite prints.
You'll land on the login page; create an account from there.

## Layout

- `src/pages/` login, signup, rooms (home), room shell with tabs, settings
- `src/features/` one folder per room feature:
  - `materials/` upload (drag & drop, progress), live processing status, extracted-text viewer
  - `quizzes/` quiz generator, quiz list, player (practice / exam), results and review
  - `tutor/` AI tutor chat (AI SDK `useChat`, streamed, with clickable citations to your notes)
  - `progress/` accuracy, topics, weak areas, weekly trend
  - `members/` members, invite links, presence, and the public `/invite/:token` page
- `src/realtime/` Socket.IO connection and `useRoomLive` (presence + live updates)
- `src/hooks/` React Query hooks; `queryKeys.ts` lists every cache key
- `src/lib/` API clients (`api.ts`, `learningApi.ts`) and helpers
- `src/theme.ts` Mantine theme (warm light/dark, Geist + Source Serif 4)

UI is built with Mantine everywhere and must work on phones (checked at 390 and 360 px wide).
