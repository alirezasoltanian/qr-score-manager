# QR Score Manager — MVP

A small, self-hosted QR capture dashboard. The phone scans QR codes locally in the browser and sends only decoded QR text to the VPS. The server stores timestamped detections in SQLite.

## Scope of this MVP

Included:
- Phone camera QR detection using the browser `BarcodeDetector` API.
- Authenticated QR event ingestion.
- Duplicate suppression for the same payload within 30 seconds.
- Dashboard with recent events and basic counts.
- Docker deployment baseline.

Not included:
- Automated contest registration, reward claiming, OTP handling, or multi-account submission.
- Bypassing CAPTCHA, rate limits, eligibility checks, or other contest controls.
- Browser profile/session storage. Add account workflows only after confirming the organizer's documented rules and supported integration method.

## Requirements

- Debian 13 VPS with Docker Engine and Docker Compose plugin.
- A domain pointed to the VPS.
- HTTPS reverse proxy (camera access requires a secure context).
- Modern Android Chrome with `BarcodeDetector` support.

## Local run

```bash
cp .env.example .env
# Generate a strong token and place it in APP_TOKEN:
openssl rand -hex 32
npm install
npm start
```

Open `http://localhost:3000` for dashboard. Camera access on a phone requires HTTPS; plain HTTP generally will not allow camera access.

## Docker

```bash
cp .env.example .env
# Edit APP_TOKEN before exposing the service.
docker compose up -d --build
docker compose logs -f app
```

The app listens on port 3000 inside the Docker network. Put a TLS reverse proxy in front of it and proxy WebSocket upgrades if used. Do not expose port 3000 publicly.

## Domain and HTTPS

Point `qr.solop.ir` A/AAAA records to the VPS. Configure your existing reverse proxy (Nginx, Caddy, or Traefik) to proxy `https://qr.solop.ir` to `http://127.0.0.1:3000` or the Compose service. Enable TLS and redirect HTTP to HTTPS. Camera access on the phone requires HTTPS.

## Use

1. Open `https://qr.solop.ir/` and enter `APP_TOKEN`.
2. Open `https://qr.solop.ir/phone.html` on the phone.
3. Enter the same token and start the camera.
4. Aim at the LED QR. The phone detects the QR locally and posts its text to the VPS.
5. View detections in the dashboard.

## Security notes

- Use a unique random `APP_TOKEN` (at least 32 random bytes).
- Keep `.env`, SQLite files, and backups private.
- Restrict dashboard access with an additional VPN/IP allowlist if possible.
- Use HTTPS only; do not put secrets in URLs.
- Back up `data/app.sqlite` securely.
- The 30-second expiry shown is an estimate from first detection, not proof of the organizer's actual expiry timestamp. Validate server-side acceptance rules independently.

## Next engineering steps

1. Verify camera and QR detection on the actual phone and LED.
2. Measure detection latency and tune scan cadence.
3. Confirm QR payload shape and whether the decoded value is a URL or opaque token.
4. Confirm official contest rules and integration options before adding any submission workflow.
