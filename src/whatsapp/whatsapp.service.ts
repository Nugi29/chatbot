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
  const apiKey = process.env.WHATSAPP_API_KEY?.trim();
  const apiVersion = process.env.WHATSAPP_API_VERSION?.trim();
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
    if (!apiKey || !apiVersion || !phoneId) {
      this.logger.warn('Missing WhatsApp API env vars. Skipping send.');
      return;
    }

    // Normalize recipient number to digits-only (wa_id format)
    const toDigits = (to || '').replace(/\D/g, '');
    if (!toDigits) {
      this.logger.warn('sendMessage called with invalid recipient number');
      return;
    }

    let data = JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toDigits,
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
      const errCode = errObj?.code;
      const errSub = errObj?.error_subcode;
      const errType = errObj?.type;
      const trace = errObj?.fbtrace_id;
      this.logger.error(
        `WhatsApp send failed (${status || 'no-status'}) [code=${errCode ?? 'n/a'} sub=${errSub ?? 'n/a'} type=${errType ?? 'n/a'} trace=${trace ?? 'n/a'}]: ${errMsg}`,
      );

      // Friendly hints for common issues
      if (status === 401 || errCode === 190) {
        this.logger.warn('Access token invalid/expired. Generate a new permanent token in Meta Developer and update WHATSAPP_API_KEY.');
      } else if (status === 400 && /Unsupported post request|does not exist|cannot be loaded/i.test(errMsg || '')) {
        this.logger.warn('Phone Number ID likely does not belong to this token/app. Verify WHATSAPP_PHONE_NUMBER_ID and the token are from the same WhatsApp Business Account.');
      } else if (status === 400 && /Invalid parameter|(#100)/i.test(errMsg || '')) {
        this.logger.warn('Invalid parameter. Check WHATSAPP_API_VERSION and payload fields (to, type=text).');
      } else if (status === 403 || errCode === 10 || errCode === 200) {
        this.logger.warn('Permission issue. Ensure the app has WhatsApp permissions and the number is in the allowed/testers list if in Development mode.');
      } else if (status === 429 || errCode === 613) {
        this.logger.warn('Rate limit hit. Slow down message sending.');
      }
    }
  }

  async generateOpenAIResponse(prompt: string): Promise<string> {
    return this.openaiService.generateOpenAIResponse(prompt);
  }

}
