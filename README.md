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

- `src/pages/` Login, Signup, Home (logged-in placeholder)
- `src/auth/` session state (`AuthContext`) and route guards
- `src/lib/api.ts` API client; the login token is kept in localStorage
- `src/quiz/` question parser + tests, kept for the quiz features that come next
