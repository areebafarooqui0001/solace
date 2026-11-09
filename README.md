# Solace AI

Expo (React Native) app in `app/`, Node/Express + SQLite (Node built-in `node:sqlite`, no native build) API in `backend/`. Gemini (free tier) or Claude powers the companion "Sunny". Needs Node 22.13+ (or 24.3+).

## 1. Run the backend

```bash
cd backend
cp .env.example .env      # Windows: copy .env.example .env
npm install
npm start                 # http://localhost:4000
```

Open `.env` and set:

- `AI_PROVIDER=gemini` and `GEMINI_API_KEY=` your free key from https://aistudio.google.com (Get API key), or
- `AI_PROVIDER=anthropic` and `ANTHROPIC_API_KEY=` your Claude key (paid)
- `JWT_SECRET=` any long random string

Check http://localhost:4000/health. It should say `"ai":true` and the provider name. If it says `false`, the key is missing or has a typo.

Free-tier note: Google may use free-tier prompts to improve its products, so test with made-up feelings, not real personal ones. Switching to a paid key later is only an `.env` change.

## 2. Run the app on your phone (fastest way to test)

```bash
cd app
cp .env.example .env      # Windows: copy .env.example .env
# edit .env: set EXPO_PUBLIC_API_URL to http://<your computer's IP>:4000
npm install
npx expo start
```

Phone and computer on the same Wi-Fi. Open Expo Go and scan the QR code. Local reminders work in Expo Go; for the final notification test use the APK.

## 3. Deploy the backend (needed for the APK)

The database is a SQLite file. Host it somewhere with a **persistent volume** and set `DB_PATH=/data/solace.db`.
Free tiers with an ephemeral disk wipe users and chats when the instance restarts.
Set env vars: `AI_PROVIDER`, `GEMINI_API_KEY` (or `ANTHROPIC_API_KEY`), `JWT_SECRET`, `DB_PATH`.

## 4. Build the APK

```bash
cd app
# put your deployed URL in eas.json -> build.preview.env.EXPO_PUBLIC_API_URL
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform android --profile preview
```

EAS prints a download link for the `.apk` when the build finishes.

## What is in the app

- Splash, onboarding, signup with goals, login
- Home: self-love level + XP + streak, daily affirmation, daily check-in, quick start (Sunny, Check-in, Breathe, Resources)
- Sunny: Claude-powered companion that reads your mood, remembers what matters (viewable, editable, switch-off-able), suggests activities inline, keeps chat history
- Check-ins: mood, anxiety and self-love screenings (gentle snapshots, never diagnoses) that earn XP and also inform Sunny
- Breathing: 4 in, 4 hold, 6 out, 4 cycles. Circle grows on the inhale, shrinks on the exhale, seconds count down, pause/resume
- Resources: five tap-each-step guides, therapists-near-you search, crisis help (Tele-MANAS 14416 and 112 for India, 988 for US)
- Reminders: daily local notifications that work when the app is closed, tap to open the right screen
- XP rules are enforced on the server (once a day per activity, breathing up to 3x) so they cannot be farmed

## Demo script (2-3 min)

1. Splash, onboarding, sign up with goals.
2. Home: level, XP bar, streak, affirmation. Tap a mood, watch the +25 XP toast.
3. Tell Sunny about a rough day. Show it suggesting breathing inline, then follow it.
4. Breathing: Start, circle grows on inhale and shrinks while "Breathe out" counts down, finish for XP.
5. Check-ins: take the anxiety check, show the result and the three wellness moves, then back in chat show Sunny is gentler.
6. Resources: tap steps in a guide, open the help sheet.
7. Start a second chat that references something from the first, then You > What Sunny remembers.
8. Set a reminder two minutes ahead, close the app, tap the notification.
9. Chat history: reopen, swipe to delete.

## Daily experience (latest additions)
- **Sunny's note**: an AI-written message each day from your mood, goals and (if memory is on) what Sunny remembers, with a personal affirmation and one suggested activity. Cached per day, rewritten after a new check-in, and falls back to a gentle fixed note if the AI is unavailable.
- **Today's small challenge**: one tiny, kind task picked for the day (AI, or a curated pool offline). Tick it for +15 XP, once a day.
- **Reminder time picker** and **two-question signup** (how you've been feeling, preferred check-in time).
- **Therapists near you**, branded app icon, adaptive/monochrome Android icons and native splash screen.

## Google sign-in (optional)
Off by default and hidden in Expo Go. Turns on in a real build when `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` (eas.json) is set and the backend has `GOOGLE_CLIENT_IDS` with the same ID. New Google users get a one-time "about you" screen; existing emails sign in to the same account.

## Free hosting note
On Render's free plan the database is wiped whenever the service sleeps or redeploys. Set `DEMO_EMAIL` and `DEMO_PASSWORD` on the server and a lived-in demo account is recreated at every start. A free uptime monitor pinging `/health` every 5 minutes keeps the service awake. For permanent data use a paid instance with a persistent disk and set `DB_PATH`.
