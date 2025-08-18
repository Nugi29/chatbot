## WhatsApp AI Chatbot (NestJS)

Simple WhatsApp chatbot built with NestJS. It uses:
- WhatsApp Cloud API to receive and send messages
- OpenAI (gpt-4o-mini) for short, helpful replies
- Optional Google Sheets to store conversation history and simple settings (no database)

## Quick start

Prerequisites
- Node.js 18+ and npm
- Meta developer app with WhatsApp Cloud API, a phone number ID, and a permanent access token
- OpenAI API key
- (Optional) Google Cloud service account with Sheets access and a spreadsheet ID

1) Install

```powershell
npm install
```

2) Configure environment

Create a .env file in the project root with values from your accounts:

```env
# WhatsApp Cloud API
WHATSAPP_API_KEY=EA...your_meta_token
WHATSAPP_API_VERSION=v21.0
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_CHALLANGE_KEY=your_webhook_verify_token

# OpenAI
OPENAI_API_KEY=sk-...

# Google Sheets (optional, enables chat history and settings)
GOOGLE_SHEETS_ID=your_spreadsheet_id
# One of the following for credentials:
# 1) put service-account.json at project root (file is already supported), or
# 2) set path to the file:
# GOOGLE_SERVICE_ACCOUNT_PATH=C:\path\to\service-account.json
```

Notes
- The app will also accept GOOGLE_SERVICE_ACCOUNT as raw JSON (or base64) if you prefer injecting credentials via env.
- On first use, the app ensures sheets: settings, messages, facts with basic headers.

3) Run the server

```powershell
npm run start:dev
```

Expose your local server publicly (for example with ngrok) and set the webhook in Meta.

Expose with ngrok

```powershell
ngrok http 3000
```

Then use the forwarding URL shown by ngrok and set your webhook to:
- https://<your-subdomain>.ngrok.app/whatsapp/webhook

Callback URL example
- https://your-host/whatsapp/webhook
- Verify token: use the same string as WHATSAPP_CHALLANGE_KEY

## How it works

1. Incoming webhook extracts the sender id, name, text, and message id
2. Messages are stored to Google Sheets (if configured) and deduplicated by message id
3. A short prompt is built with optional business facts from the settings sheet (keys starting with "biz:")
4. OpenAI (gpt-4o-mini) generates a concise reply
5. Reply is sent back via WhatsApp Cloud API

## Scripts

Common scripts in package.json:
- npm run start — start in production mode
- npm run start:dev — start in watch mode
- npm run build — build to dist/
- npm run test — run unit tests

## Main dependencies

Runtime packages used by the app:
- @nestjs/common: ^11.0.1
- @nestjs/config: ^4.0.2
- @nestjs/core: ^11.0.1
- @nestjs/platform-express: ^11.0.1
- axios: ^1.9.0
- googleapis: ^144.0.0
- openai: ^4.100.0
- reflect-metadata: ^0.2.2
- rxjs: ^7.8.1

## Project layout

```
src/
   config/AppConfig.ts      # reads env values
   openai/openai.service.ts # OpenAI chat completions (gpt-4o-mini)
   sheets/sheets.service.ts # Google Sheets storage (optional)
   whatsapp/...
      whatsapp.controller.ts # webhook + utility endpoints
      whatsapp.service.ts    # message flow and Cloud API send
```

## Troubleshooting

- 401/190 from WhatsApp: token expired/invalid. Regenerate a permanent token and update WHATSAPP_API_KEY
- 400 (#100) invalid parameter: check version/IDs and payload, and ensure the phone number ID belongs to the same WABA as your token
- 403/10/200: permissions or app mode. Make sure your number is in testers when in development mode
- No replies and no errors: check /whatsapp/health and server logs, verify your webhook is reachable

## Security: do not commit secrets

- The file `service-account.json` contains sensitive keys. It is ignored by `.gitignore` so it won't be included in commits.
- Prefer setting credentials via environment variables:
   - `GOOGLE_SERVICE_ACCOUNT_PATH` pointing to a local file path
   - or `GOOGLE_SERVICE_ACCOUNT` containing the JSON (raw or base64)

### Using GitHub Actions or deployment platforms

Store secrets in repository Settings → Secrets and variables → Actions:
- `OPENAI_API_KEY`
- `WHATSAPP_API_KEY`
- `GOOGLE_SHEETS_ID`
- `GOOGLE_SERVICE_ACCOUNT` (paste the JSON or base64 of the JSON)

If using a hosting provider, add the same env vars in its dashboard. Do not upload the JSON file to the repo.

## 📝 License

This project is open source and available for educational purposes. Feel free to use, modify, and distribute as needed.


## Author

⭐️ From [Nugi29](https://github.com/Nugi29)
