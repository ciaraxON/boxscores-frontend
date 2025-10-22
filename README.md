# Boxscores Frontend

Live demo: https://boxscores-frontend.vercel.app/

This React app displays player lists, player details and player games (box scores). It was bootstrapped with Create React App and expects a backend providing player data and game endpoints.

## Table of contents

- [Demo](#demo)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Local development](#local-development)
- [Available scripts](#available-scripts)
- [Environment / configuration](#environment--configuration)
- [Backend API (expected)](#backend-api-expected)
- [Routing](#routing)
- [Notes](#notes)
- [License](#license)

## Demo

The frontend is deployed at: https://boxscores-frontend.vercel.app/

## Features

- List of players with thumbnail, team/college and position
- Player details page with full image, profile fields and social links
- Most recent game summary on player detail page
- Full game list with filters (game type, season, opponent) and media viewer (YouTube, mp4, webm)
- Robust handling of multiple JSON field naming conventions

## Prerequisites

- Node.js 18+ and npm (or compatible)
- Backend API running and reachable (defaults expect `http://localhost:8080` for local dev)

## Local development

1. Open a terminal in `frontend`
2. Install dependencies:
3. Start the dev server:
4. Open `http://localhost:3000`

## Available scripts

- `npm start` — development server
- `npm test` — run tests (CRA test runner)
- `npm run build` — production build into `build/`
- `npm run eject` — eject CRA config (one-way)

## Environment / configuration

- The app uses `window.location.origin` and `process.env.PUBLIC_URL` for resolving image paths.
- Backend origin in code defaults to `http://localhost:8080`. To point to a different backend in production, update API host in code or set up a proxy/rewrites in deployment (Vercel).
- Routes are client-side (React Router); server should serve `index.html` for SPA routes in production.

## Backend API (expected endpoints)

The frontend expects the backend to expose these endpoints:

- `GET /players` — list of players (array)
- `GET /playerdetails/:encodedCombinedKey` — returns an array of player objects matching the friendly combined key OR player id
- `GET /player/:playerId/latestgame` — latest game for a player (404 if none)
- `GET /player/:playerId/games` — list of games for a player (accepts query params `gameType`, `season`, `opponent`)

Notes on fields: the frontend tolerates multiple naming conventions (e.g. `PlayerID`, `playerID`, `playerId`, image fields like `imageURL`, `ImageURL`, social objects under `SocialLinks` or `socialLinks`, etc.).

## Routing

- `/` — players list
- `/player/:playerName` — player details (uses a combined key derived from name)
- `/player/:playerKey/games` — player games list

## Notes

- Image and social URL normalization logic is implemented client-side to support relative URLs, data URIs and common host formats.
- When deploying to Vercel (or another static host), point the build to the backend via environment variables or platform rewrite rules to avoid CORS issues.
- The app uses accessible patterns (aria attributes, keyboard Escape to close dialogs).

## License

MIT
4. 
