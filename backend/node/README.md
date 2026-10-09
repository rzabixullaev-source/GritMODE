# MARD API

Node.js 22+, Express 5, MongoDB Atlas. The API uses native JavaScript ES modules (`"type": "module"`). Camera frames stay in the browser; the API stores account data and workout summaries only.

## Run locally

1. Install Node.js 22 or newer.
2. Copy `.env.example` to `.env`.
3. Add the MongoDB Atlas connection URI and a private `JWT_SECRET` of at least 32 characters.
4. Run `npm install`, then `npm run dev`.
5. Open `GET /api/health` to confirm the API is listening.

The API cannot start until `MONGODB_URI` and `JWT_SECRET` are configured. Keep `.env` private.

## Routes

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Public | Create account |
| POST | `/api/auth/login` | Public | Log in and receive JWT |
| GET, PATCH | `/api/profile` | JWT | Read or update profile |
| GET, PUT | `/api/goals/active` | JWT | Read or set current streak goal |
| GET | `/api/goals/progress` | JWT | Get current streak and goal progress |
| GET, POST | `/api/workouts` | JWT | Read workout history or record a squat session |
| GET, PUT | `/api/reminders` | JWT | Read or save reminder settings |
| POST | `/api/reminders/telegram/link-code` | JWT | Create a 10-minute bot link |
| DELETE | `/api/reminders/telegram/link` | JWT | Disconnect Telegram |
| POST | `/api/telegram/webhook` | Telegram secret | Link the chat using `/start <code>` |
| GET | `/api/gyms?bbox=west,south,east,north&area=...` | Public | Search district gyms using Google Places when configured, OpenStreetMap otherwise |
| GET | `/api/health` | Public | Service status |

For protected routes, send `Authorization: Bearer <token>`. All user data is scoped to the account in the token. Passwords are hashed before storage.

## Telegram reminders

Create a bot with `@BotFather`, then set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_BOT_USERNAME` in `.env` (username without `@`). Local development defaults to `TELEGRAM_MODE=polling`, so the API can receive `/start` updates without a public webhook URL. Only one API process should poll a bot at a time. The bot token is secret; never commit `.env` or share the token.

For deployment, use `TELEGRAM_MODE=webhook`, set `TELEGRAM_WEBHOOK_SECRET` to a random value of at least 16 characters, and set `TELEGRAM_WEBHOOK_URL` to the public HTTPS endpoint `https://YOUR_API/api/telegram/webhook`. On startup, the API validates the bot token and username with `getMe`, then registers the webhook. Polling and webhooks are mutually exclusive in Telegram. The API sends a reminder once at the configured local time when no workout has been recorded that day. Users must link the bot and enable reminders.

For production, use HTTPS and a persistent API host. The built-in scheduler is designed for a single running API instance; multiple instances need a shared job queue or distributed lock.

## MVP scope

- MongoDB Atlas network access and credentials are required to run it.
- Only squat session summaries are supported; video and camera frames are never uploaded.
- Google gym search requires `GOOGLE_MAPS_PLACES_API_KEY` and Places API (New). Without that key, gym search falls back to OpenStreetMap/Photon.
- Friend challenges and real-time AI pose feedback remain frontend/product work.
