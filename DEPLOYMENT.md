# Deploying Connectify — Render (backend) + Vercel (frontend)

This project deploys as two separate services, matching the two-app
structure we've had since Phase 1:

- **Render** hosts `server/` — a persistent Node process, which is required
  because Socket.IO needs a long-running connection. Vercel's serverless
  functions can't hold a WebSocket connection open, which is exactly why
  the backend goes to Render instead.
- **Vercel** hosts `client/` — a static React build, which is exactly what
  Vercel is built for.

Push your code to a GitHub repository first — both platforms deploy by
connecting to a repo, not by manual file upload.

---

## Part 1: Deploy the backend to Render

1. Go to [render.com](https://render.com) → **New +** → **Web Service**
2. Connect your GitHub repo
3. Configure:
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/api/health` (reuses the endpoint from Phase 1)
4. Add environment variables (Render dashboard → Environment):

   ```
   MONGO_URI=<your Atlas connection string>
   JWT_SECRET=<your real generated secret — NOT the placeholder>
   JWT_EXPIRES_IN=7d
   CLIENT_URL=http://localhost:5173   (temporary — we'll update this in Part 3)
   NODE_ENV=production
   ```

   Note: Render automatically injects its own `PORT` — you don't need to
   set it. Our `server.js` already uses `process.env.PORT || 5000`, so
   this works without any code change.

5. Deploy. Once live, note your backend URL, e.g.
   `https://connectify-api.onrender.com`

**MongoDB Atlas network access**: Render's free tier doesn't have a
static outbound IP, so Atlas needs to allow connections from anywhere
(Network Access → `0.0.0.0/0`) — the same setting you configured back in
Phase 2. This is fine for a portfolio project; a real production setup
would use Atlas's private networking/VPC peering instead of an open IP
allowlist.

**Free tier note**: Render's free web services spin down after 15
minutes of inactivity and take ~30-60 seconds to "wake up" on the next
request. This is worth mentioning honestly if you demo this project live
— the first request after idle time will be slow, not broken.

---

## Part 2: Deploy the frontend to Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New** → **Project**
2. Import the same GitHub repo
3. Configure:
   - **Root Directory**: `client`
   - **Framework Preset**: Vite (auto-detected)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `dist` (default)
4. Add environment variables (Vercel dashboard → Settings → Environment Variables):

   ```
   VITE_API_URL=https://connectify-api.onrender.com/api
   VITE_SOCKET_URL=https://connectify-api.onrender.com
   ```

   Use your actual Render URL from Part 1.

5. Deploy. Note your frontend URL, e.g. `https://connectify.vercel.app`

The `vercel.json` file in `client/` (added in this phase) rewrites every
route to `index.html`, so React Router's client-side routes (like
`/login`) don't 404 on a direct visit or a page refresh — without it,
Vercel would look for an actual file at `/login` and fail to find one.

---

## Part 2.5: TURN server for voice/video calling across networks

Voice/video calling works fine when both people are on the same local
network — but between two genuinely different real-world networks
(different home ISPs, mobile carriers, corporate firewalls), a direct
peer-to-peer connection often can't be established, and calls will fail
silently or show a "Call failed" message without a working TURN server.
Google's free STUN server (already configured) isn't enough on its own.

This project uses **Cloudflare Realtime TURN**, which issues short-lived
credentials (minted on demand) rather than a permanent username/password
— a meaningful security improvement, since a leaked short-lived
credential is only useful for a limited window. Because minting them
requires a secret API token, credential generation happens **on the
backend** (`server/src/services/turnService.js`), never in the browser.

1. Sign up for a Cloudflare account and enable Realtime TURN
   (Cloudflare dashboard → Realtime → TURN). Cloudflare's free tier
   includes 1,000 GB/month of TURN relay traffic — generous for a
   portfolio project.
2. Create a TURN key and note your **Key ID** and **API Token**
3. Add them to your Render environment variables (NOT Vercel — these
   are backend secrets):

   ```
   CLOUDFLARE_TURN_KEY_ID=<your key id>
   CLOUDFLARE_TURN_API_TOKEN=<your api token>
   ```

4. Redeploy the backend on Render

**Never commit these to GitHub or expose them to the frontend** — same
principle as `JWT_SECRET`/`MONGO_URI`. The frontend never sees these
values directly; it calls `GET /api/calls/turn-credentials` (an
authenticated endpoint) right before each call, and the backend mints a
fresh short-lived credential on its behalf. If these env vars aren't
set, calling still works — it falls back to STUN-only, which is fine on
the same network but won't reliably connect calls across different ones.

---

## Part 3: Connect them

Go back to Render → your service → Environment → update:

```
CLIENT_URL=https://connectify.vercel.app
```

(your actual Vercel URL from Part 2). Render will redeploy automatically.
This is the value our CORS config (`app.js`, Phase 1) and Socket.IO's CORS
config (`socketHandler.js`, Phase 10) both check against — without this
update, the deployed frontend would be blocked from calling the deployed
backend at all.

---

## Part 4: Verify

Visit your Vercel URL and test the full flow: register, login, refresh
(session persistence), send a message, open a second browser and confirm
real-time delivery still works end to end in production.

---

## Notes worth knowing for an interview

- **Why two platforms instead of one?** Vercel's serverless model spins
  up a function per request and tears it down — great for stateless HTTP,
  incompatible with a WebSocket connection that needs to stay open.
  Render (or similar: Railway, Fly.io, a VPS) runs your process
  continuously, which Socket.IO requires.
- **Stateless JWTs survive a backend restart/redeploy** with zero impact
  on logged-in users — since sessions aren't stored server-side, a
  redeploy doesn't invalidate anyone's token.
- **The in-memory `userSockets` map does NOT survive a restart** — if
  Render restarts the process (deploys, or free-tier spin-down/wake),
  all socket connections drop and reconnect fresh, rebuilding presence
  state from scratch. This is consistent with the scaling limitation
  already documented in Phase 10/12: a single in-memory map only works
  for a single server instance.
- **CORS in production is stricter, not looser** — `CLIENT_URL` should be
  the exact deployed frontend origin, not a wildcard, especially now that
  real user credentials are involved.
