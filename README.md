# MARD — React fitness MVP

Responsive Uzbek-language React site for workout tracking and fitness habits. The existing MARD visual design is preserved.

## Start the frontend

From this folder, run:

```sh
npm install
npm run dev
```

Open the local URL printed by Vite (default `http://localhost:5173`). Camera access needs localhost or HTTPS. For a production bundle, run `npm run build`; the deployable site is generated in `dist/`.

## Connect to the API

The frontend defaults to `http://localhost:4000/api` in `src/api.js`. Start and configure the backend using `backend/node/README.md`. Add the frontend origin to the backend's `CORS_ORIGINS` setting. The account flow connects register/login, profile, personal goal, progress, workout summaries, reminder settings and Telegram linking to the Express API. The camera processes pose landmarks in the browser; video is not uploaded.

Without an account, the app offers a demo mode with browser-local storage. Telegram requires bot credentials and a public HTTPS webhook. The gym finder includes district boundaries, nearby open-map search, an interactive street-map view, and Google Maps search links.

## Gym map providers

The gym finder no longer draws its own country map. It opens a live Google map when configured and keeps an OpenStreetMap street map as a working fallback. For Google Maps, enable Maps Embed API in Google Cloud, copy `.env.example` to `.env`, and set `VITE_GOOGLE_MAPS_EMBED_API_KEY` to a browser key restricted to the local/deployed website origins.

For Google-backed gym listings, set `GOOGLE_MAPS_PLACES_API_KEY` in `backend/node/.env` and enable Places API (New). Keep this server key private and restrict it to the deployed backend. Search uses the selected district's geographic bounds and follows up to three 20-place pages; Google does not guarantee that a search contains every gym, so the app also links to a live Google Maps search.
