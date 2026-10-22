const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

const rounds = [
  { left: "PUTIN", right: "ZELENSKY", aliasesL: ["putin","p","🇷🇺"], aliasesR: ["zelensky","zelenski","z","🇺🇦"] },
  { left: "USA", right: "EUROPE", aliasesL: ["usa","america","us","🇺🇸"], aliasesR: ["europe","eu","🇪🇺"] },
  { left: "BOYS", right: "GIRLS", aliasesL: ["boys","boy","b","👦"], aliasesR: ["girls","girl","g","👧"] },
  { left: "TRUMP", right: "KIM JONG UN", aliasesL: ["trump","t"], aliasesR: ["kim","kim jong un","kju"] },
  { left: "MARVEL", right: "DC", aliasesL: ["marvel","m"], aliasesR: ["dc","d"] },
  { left: "DRAGONS", right: "ROBOTS", aliasesL: ["dragons","dragon"], aliasesR: ["robots","robot"] }
];
let roundIndex = 0;
const state = {
  title: "PUTIN vs ZELENSKY",
  teams: { left: rounds[0].left, right: rounds[0].right },
  roundNumber: 1,
  scores: { putin: 0, zelensky: 0 },
  roundSeconds: 600,
  remaining: 600,
  running: false,
  likes: 0,
  viewers: 0,
  supporters: [],
  events: [],
  connection: "Not connected",
  username: "",
  winner: null
};
let roundTimer = null;
let nextRoundTimer = null;
let tiktokConnection = null;

function emitState() { io.emit("state", state); }
function logEvent(type, text, extra = {}) {
  const event = { id: Date.now() + Math.random(), time: new Date().toLocaleTimeString(), type, text, ...extra };
  state.events.unshift(event);
  state.events = state.events.slice(0, 80);
  io.emit("event", event);
  emitState();
}
function giftPoints(giftName) {
  const name = String(giftName || "").toLowerCase();
  if (name.includes("rose")) return 10;
  if (name.includes("finger heart") || name.includes("heart me")) return 30;
  if (name.includes("perfume") || name.includes("gift")) return 150;
  if (name.includes("tiktok") || name.includes("music")) return 500;
  if (name.includes("crown") || name.includes("universe") || name.includes("galaxy")) return 1500;
  return 10;
}

function addScore(team, points, source, user = "Viewer") {
  if (!["putin", "zelensky"].includes(team)) return;
  state.scores[team] += points;
  const found = state.supporters.find(x => x.user === user && x.team === team);
  if (found) found.points += points;
  else state.supporters.push({ user, team, points });
  state.supporters.sort((a, b) => b.points - a.points);
  state.supporters = state.supporters.slice(0, 10);
  logEvent(source || "score", user + " +" + points + " for " + team.toUpperCase(), { team, points, user });
}
function stopRound() {
  clearInterval(roundTimer); roundTimer = null; state.running = false;
  state.winner = state.scores.putin === state.scores.zelensky ? "DRAW" : state.scores.putin > state.scores.zelensky ? state.teams.left + " WINS" : state.teams.right + " WINS";
  state.roundHistory.unshift({ round: state.roundNumber, left: state.teams.left, right: state.teams.right, leftScore: state.scores.putin, rightScore: state.scores.zelensky, winner: state.winner, endedAt: new Date().toISOString() });
  state.roundHistory = state.roundHistory.slice(0, 20);
  logEvent("round", "ROUND " + state.roundNumber + " OVER — " + state.winner);
  clearTimeout(nextRoundTimer);
  nextRoundTimer = setTimeout(() => {
    roundIndex = (roundIndex + 1) % rounds.length;
    state.roundNumber += 1;
    state.teams = { left: rounds[roundIndex].left, right: rounds[roundIndex].right };
    state.scores = { putin: 0, zelensky: 0 };
    state.remaining = state.roundSeconds; state.likes = 0; state.winner = null;
    state.supporters = []; state.events = [];
    logEvent("round", "NEXT BATTLE: " + state.teams.left + " VS " + state.teams.right);
    startRound();
  }, 5000);
}
function startRound() {
  clearTimeout(nextRoundTimer); clearInterval(roundTimer); state.remaining = state.roundSeconds; state.running = true; state.winner = null;
  logEvent("round", "ROUND " + state.roundNumber + " STARTED — " + state.teams.left + " VS " + state.teams.right);
  roundTimer = setInterval(() => {
    if (!state.running) return;
    state.remaining = Math.max(0, state.remaining - 1);
    if (state.remaining <= 0) stopRound(); else emitState();
  }, 1000);
  emitState();
}
function resetRound() {
  clearInterval(roundTimer); roundTimer = null; clearTimeout(nextRoundTimer);
  state.scores = { putin: 0, zelensky: 0 }; state.remaining = state.roundSeconds;
  state.running = false; state.likes = 0; state.winner = null; state.supporters = []; state.events = [];
  logEvent("round", "NEW ROUND READY");
}
app.get("/health", (req, res) => res.json({ ok: true, app: "putinvszelensky-live-arena", connection: state.connection }));
app.get("/api/state", (req, res) => res.json(state));
app.get("/api/rounds", (req, res) => res.json({ current: { number: state.roundNumber, teams: state.teams, remaining: state.remaining, running: state.running }, history: state.roundHistory }));
app.get("/api/health", (req, res) => res.json({ ok: true, uptimeSeconds: Math.floor(process.uptime()), connection: state.connection, roundNumber: state.roundNumber, running: state.running }));
app.post("/api/control", (req, res) => {
  const { action, team, points, user } = req.body || {};
  if (action === "start") startRound();
  else if (action === "reset") resetRound();
  else if (action === "score") addScore(team, Math.max(1, Math.min(100000, Number(points) || 1)), "manual", user || "Host");
  else if (action === "stop") { clearInterval(roundTimer); roundTimer = null; state.running = false; emitState(); }
  else if (action === "demo") {
    state.viewers = 17;
    logEvent("demo", "DEMO TEST EVENT — TikTok is not connected");
    addScore("putin", 10, "demo", "DemoViewer");
    addScore("zelensky", 15, "demo", "DemoViewer2");
  } else return res.status(400).json({ error: "Unknown action" });
  emitState(); res.json({ ok: true, state });
});
app.post("/api/connect", async (req, res) => {
  const username = String(req.body.username || "").trim().replace(/^@/, "");
  if (!username) return res.status(400).json({ error: "Enter your TikTok LIVE username without @." });
  try {
    if (tiktokConnection && typeof tiktokConnection.disconnect === "function") await tiktokConnection.disconnect();
    const { TikTokLiveConnection, WebcastEvent } = require("tiktok-live-connector");
    tiktokConnection = new TikTokLiveConnection(username);
    state.username = username;
    state.connection = "Connecting to @" + username + "…";
    logEvent("connection", state.connection);
    tiktokConnection.on(WebcastEvent.CHAT, data => {
      const comment = String(data.comment || "").trim().toLowerCase();
      const user = data.nickname || data.uniqueId || "Viewer";
      logEvent("chat", "@" + user + ": " + (data.comment || ""));
      const round = rounds[roundIndex];
      if (round.aliasesL.includes(comment)) addScore("putin", 1, "comment", user);
      if (round.aliasesR.includes(comment)) addScore("zelensky", 1, "comment", user);
    });
    tiktokConnection.on(WebcastEvent.LIKE, data => {
      state.likes += Number(data.likeCount || 1);
      if (state.scores.putin <= state.scores.zelensky) addScore("putin", Math.max(1, Number(data.likeCount || 1)), "likes", "LIVE likes");
      else addScore("zelensky", Math.max(1, Number(data.likeCount || 1)), "likes", "LIVE likes");
    });
    tiktokConnection.on(WebcastEvent.GIFT, data => {
      const gift = data.giftName || "Gift";
      const user = data.nickname || data.uniqueId || "Viewer";
      logEvent("gift", "🎁 " + user + " sent " + gift);
      const target = state.scores.putin <= state.scores.zelensky ? "putin" : "zelensky";
      const count = Math.max(1, Number(data.repeatCount || 1));
      const points = giftPoints(gift) * count;
      state.giftCount += count; state.totalGiftPoints += points;
      addScore(target, points, "gift", user);
    });
    tiktokConnection.on(WebcastEvent.ROOM_USER, data => { state.viewers = Number(data.viewerCount || state.viewers); emitState(); });
    tiktokConnection.on("connected", () => { state.connection = "Connected to @" + username; logEvent("connection", state.connection); });
    tiktokConnection.on("disconnected", () => { state.connection = "Disconnected"; logEvent("connection", state.connection); });
    tiktokConnection.on("error", err => { state.connection = "Connection error: " + (err.message || "TikTok error"); logEvent("error", state.connection); });
    tiktokConnection.connect().then(() => {
      state.connection = "Connected to @" + username; logEvent("connection", state.connection);
    }).catch(err => {
      state.connection = "Could not connect: " + (err.message || "TikTok LIVE unavailable");
      logEvent("error", state.connection); emitState();
    });
    emitState(); res.json({ ok: true, message: "Connection attempt started", state });
  } catch (err) {
    state.connection = "Connection setup failed: " + err.message;
    logEvent("error", state.connection); res.status(500).json({ error: state.connection });
  }
});
io.on("connection", socket => {
  socket.emit("initial", { state, events: state.events });
});
app.get("/pc", (req, res) => res.sendFile(path.join(__dirname, "public", "pc.html")));
app.get("/pc.html", (req, res) => res.sendFile(path.join(__dirname, "public", "pc.html")));
server.listen(PORT, "0.0.0.0", () => { console.log("PUTIN vs ZELENSKY arena listening on " + PORT); setTimeout(() => { if (!state.running) startRound(); }, 1000); });