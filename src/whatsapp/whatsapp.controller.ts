import { Body, Controller, Get, Logger, Post, Req, Res } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);
    constructor(private whatsappService:WhatsappService) {}

    @Get('test')
    test(){
        return 'nugitha';
    }

    @Get('webhook')
    challengeWebhook(@Req() req, @Res() res) {
        let mode = req.query["hub.mode"];
        let token = req.query["hub.verify_token"];
        let challenge = req.query["hub.challenge"];
        // Check if a token and mode is in the query string of the request
        if (mode && token) {
          // Check the mode and token sent is correct
          const verifyToken = process.env.WHATSAPP_CHALLANGE_KEY?.trim();
          if (mode === "subscribe" && token === verifyToken) {
            // Respond with the challenge token from the request
            console.log("WEBHOOK_VERIFIED");
            res.status(200).send(challenge);
          } else {
            // Respond with '403 Forbidden' if verify tokens do not match
            res.sendStatus(403);
          }
        }
    }

    @Get('health')
    health() {
      return {
        whatsapp: {
          hasApiKey: !!process.env.WHATSAPP_API_KEY,
          hasVersion: !!process.env.WHATSAPP_API_VERSION,
          hasPhoneId: !!process.env.WHATSAPP_PHONE_NUMBER_ID,
        },
        openai: {
          hasKey: !!process.env.OPENAI_API_KEY,
        },
        googleSheets: {
          hasCreds: !!process.env.GOOGLE_SERVICE_ACCOUNT || !!process.env.GOOGLE_SERVICE_ACCOUNT_PATH,
          hasSheetId: !!process.env.GOOGLE_SHEETS_ID,
        },
      };
    }

    @Post('send-test')
    async sendTest(@Body() body, @Res() res) {
      const to = body?.to;
      const text = body?.text || 'Hello! How can I assist you today?';
      if (!to) {
        return res.status(400).json({ error: 'Missing to (phone number with country code)' });
      }
      await this.whatsappService.sendMessage(to, text);
      return res.json({ ok: true });
    }

    @Post('webhook')
    async handleWebhook(@Req() req, @Res() res) {
        try {
          const entry = req.body?.entry;
          if (!Array.isArray(entry) || !entry.length) {
            this.logger.warn('Webhook received without entry');
            return res.sendStatus(200);
          }
          const change = entry[0]?.changes?.[0]?.value;
          const contact = change?.contacts?.[0];
          const message = change?.messages?.[0];

          if (!contact || !message) {
            this.logger.warn('Webhook missing contact or message');
            return res.sendStatus(200);
          }

          const senderNumber = contact.wa_id;
          const senderName = contact?.profile?.name;
          const messageText =
            message?.text?.body ||
            message?.button?.text ||
            message?.interactive?.button_reply?.title ||
            message?.interactive?.list_reply?.title ||
            '';
          const messageId = message?.id || message?.key?.id || '';

          this.logger.log(`Sender Number: ${senderNumber}`);
          this.logger.log(`Message: ${messageText}`);
          this.logger.log(`Sender Name: ${senderName}`);

          if (!messageText) {
            await this.whatsappService.sendMessage(senderNumber, 'Please send a text message.');
            return res.sendStatus(200);
          }

          await this.whatsappService.handleUserMessage(senderNumber, messageText, messageId);
          return res.sendStatus(200);
        } catch (e) {
          this.logger.error(e);
          return res.sendStatus(500);
        }
    }

}
