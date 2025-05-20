# WhatsApp Bot with OpenAI Integration

This project is a WhatsApp chatbot built using [NestJS](https://nestjs.com/) and integrates with the [OpenAI API](https://platform.openai.com/docs/api-reference) to generate intelligent responses. It uses the WhatsApp Cloud API for messaging and OpenAI's GPT models for AI-powered replies.

## Features
- Receives and sends WhatsApp messages via webhook
- Uses OpenAI GPT (e.g., gpt-3.5-turbo) to generate responses
- Modular NestJS structure for easy extension
- Configurable via environment variables or config files

## Project Structure

```
whatsapp_bot/
├── src/
│   ├── app.controller.ts
│   ├── app.controller.spec.ts
│   ├── app.module.ts
│   ├── app.service.ts
│   ├── main.ts
│   ├── config/
│   │   └── AppConfig.ts
│   ├── openai/
│   │   ├── openai.service.ts
│   │   └── openai.service.spec.ts
│   └── whatsapp/
│       ├── whatsapp.controller.ts
│       ├── whatsapp.controller.spec.ts
│       ├── whatsapp.service.ts
│       └── whatsapp.service.spec.ts
├── package.json
├── tsconfig.json
├── nest-cli.json
└── ...
```

## Key Files
- `src/whatsapp/whatsapp.controller.ts`: Handles WhatsApp webhook endpoints.
- `src/whatsapp/whatsapp.service.ts`: Business logic for WhatsApp messaging and AI integration.
- `src/openai/openai.service.ts`: Encapsulates all OpenAI API logic.
- `src/config/AppConfig.ts`: Centralized configuration (API keys, versioning, etc).

## Installation

1. **Clone the repository**
2. **Install dependencies:**
   ```sh
   npm install
   ```
3. **Set up environment variables** (or update `AppConfig.ts`):

   Create a `.env` file in the root directory with the following sample content:
   ```env
   WHATSAPP_API_KEY=your_whatsapp_api_key_here
   WHATSAPP_API_VERSION=v19.0
   WHATSAPP_PHONE_NUMBER_ID=1234567890
   OPENAI_API_KEY=sk-your_openai_key_here
   ```

4. **Run the application:**
   ```sh
   npm run start:dev
   ```

## Usage
- Expose your webhook endpoint to WhatsApp Cloud API (e.g., using [ngrok](https://ngrok.com/)).
- Send a WhatsApp message to your bot number. The bot will reply using OpenAI.

## Scripts
See `package.json` for all available scripts:
- `start`, `start:dev`, `build`, `test`, etc.

## Dependencies
- `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`
- `axios`
- `openai`
- `rxjs`

## License
This project is UNLICENSED. Modify as needed for your use case.
