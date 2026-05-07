# ISHGLAD VENTURES - Desktop POS & Inventory (Single-file App)

This repository contains a single-file React application (`src/App.jsx`) that implements a desktop-style Point of Sale and Inventory Management demo using Vite, Tailwind CSS, and `lucide-react` icons.

Quick start:

1. Install dependencies

```bash
npm install
```

2. Run development server

```bash
npm run dev
```

3. Build production bundle

```bash
npm run build
```

The UI is in `src/App.jsx` — it's a single functional component containing the Cash Register, Inventory, Sales History, toast system, and receipt printing logic.

Production / self-contained start

1. Build the frontend bundle:

```bash
npm run build
```

2. Start the server which will serve the built frontend plus the API:

```bash
npm start
# or: node server/index.js
```

The server serves the production files from `dist/` when present and exposes the API on the same origin (default: `http://localhost:4000`). The SQLite DB is at `data/pos.db` and uploads live in `server/uploads`.

If you want me to build and start the production server now, say "Yes, start production" and I'll run the build, restart the server, and verify the app is served from `http://localhost:4000`.
