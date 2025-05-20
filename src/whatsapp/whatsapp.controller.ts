import { Controller,Get, Logger, Post, Req, Res } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);
    constructor(private whatsappService:WhatsappService) {}

    @Get('test')
    test(){
        return 'pasindu';
    }

    @Get('webhook')
    challengeWebhook(@Req() req, @Res() res) {
        let mode = req.query["hub.mode"];
        let token = req.query["hub.verify_token"];
        let challenge = req.query["hub.challenge"];
        // Check if a token and mode is in the query string of the request
        if (mode && token) {
          // Check the mode and token sent is correct
          if (mode === "subscribe" && token === process.env.WHATSAPP_CHALLANGE_KEY) {
            // Respond with the challenge token from the request
            console.log("WEBHOOK_VERIFIED");
            res.status(200).send(challenge);
          } else {
            // Respond with '403 Forbidden' if verify tokens do not match
            res.sendStatus(403);
          }
        }
    }

    @Post('webhook')
    async handleWebhook(@Req() req, @Res() res) {
        const payload = req.body.entry;
        try {
          const change = payload[0].changes[0].value;
          const senderNumber = change.contacts[0].wa_id;
          const messageText = change.messages[0].text.body;
          const senderName = change.contacts[0].profile.name;

          this.logger.log(`Sender Number: ${senderNumber}`);
          this.logger.log(`Message: ${messageText}`);
          this.logger.log(`Sender Name: ${senderName}`);

          // Generate OpenAI response
          await this.whatsappService.handleUserMessage(senderNumber, messageText);

          res.sendStatus(200); // Respond with 200 OK to acknowledge receipt of the message
        } catch (e) {
          this.logger.error(e);
          res.sendStatus(500);
        }
    }

}
