# PUTIN vs ZELENSKY — LIVE ARENA

A standalone Node.js web app with a mobile game screen at `/` and a PC control room at `/pc.html`.

## Deploy on Render
- Create a new **Web Service** from this repository.
- Runtime: Node.
- Build command: `npm install`
- Start command: `npm start`
- No environment variables are required for the basic app.

## Routes
- `/` — mobile game screen
- `/pc.html` — PC control room
- `/health` — JSON health check
- `/api/state` — current game state

## Important
The game server and demo controls are separate from a verified TikTok LIVE integration. The TikTok connector may stop working when TikTok changes access or protocol behavior. The app has not been verified against a live TikTok account. The PC control room intentionally does not claim to display TikTok video preview. Test the deployed app using the demo control before relying on it during a stream.
