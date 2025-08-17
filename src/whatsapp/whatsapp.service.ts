import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { OpenaiService } from '../openai/openai.service';
import { AppConfig } from 'src/config/AppConfig';
import { SheetsService } from '../sheets/sheets.service';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  constructor(private openaiService: OpenaiService, private sheets: SheetsService) {}


  async handleUserMessage(number: string, message: string, msgId?: string) {
    try{
        // Dedupe by message ID if provided
        if (msgId && (await this.sheets.hasMessage(msgId))) {
          this.logger.warn(`Duplicate message ignored: ${msgId}`);
          return;
        }

        // Save user message
        await this.sheets.appendMessage(number, 'user', message, msgId);

        const history = await this.sheets.getRecentConversation(number, 12);

        // Pull business facts from settings (keys like biz:name, biz:about, biz:services)
        const settings = await this.sheets.getAllSettings();
        const bizEntries = Object.entries(settings)
          .filter(([k]) => k.startsWith('biz:'))
          .map(([k, v]) => `${k.replace('biz:', '').replace(/_/g, ' ')}: ${v}`);
        const bizContext = bizEntries.length
          ? `Business facts — ${bizEntries.join(' | ')}`
          : '';

        const prompt = bizContext ? `${bizContext}\n\nUser: ${message}` : message;
        const reply = await this.openaiService.generateOpenAIResponse(prompt, history);

        // Save bot reply
        await this.sheets.appendMessage(number, 'assistant', reply);

        await this.sendMessage(number, reply);

      }catch(e){
        this.logger.error('Error handling user message:', e);
        await this.sendMessage(number, 'Sorry, I could not process your request.');
    }
  }

  async sendMessage(to: string, message: string) {
    const apiKey = process.env.WHATSAPP_API_KEY;
    const apiVersion = process.env.WHATSAPP_API_VERSION;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!apiKey || !apiVersion || !phoneId) {
      this.logger.warn('Missing WhatsApp API env vars. Skipping send.');
      return;
    }

    let data = JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'text',
      text: {
        preview_url: false,
        body: message,
      },
    });

    let config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: `https://graph.facebook.com/${apiVersion}/${phoneId}/messages`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      data: data,
    };

    try {
      const response = await axios.request(config);
      this.logger.log(`WhatsApp send ok: ${response.status}`);
    } catch (error: any) {
      // Sanitize logs: avoid printing tokens/headers
      const status = error?.response?.status;
      const errObj = error?.response?.data?.error;
      const errMsg = errObj?.message || error?.message || 'unknown error';
      this.logger.error(`WhatsApp send failed (${status || 'no-status'}): ${errMsg}`);
      if (status === 401) {
        this.logger.warn('Your WHATSAPP_API_KEY is invalid or expired. Refresh the token in Meta Developer and update the env.');
      }
    }
  }

  async generateOpenAIResponse(prompt: string): Promise<string> {
    return this.openaiService.generateOpenAIResponse(prompt);
  }

}
