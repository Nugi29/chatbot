import { Injectable } from '@nestjs/common';
import { OpenAI } from 'openai';
import { AppConfig } from 'src/config/AppConfig';

@Injectable()
export class OpenaiService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateOpenAIResponse(prompt: string, history?: { role: 'user' | 'assistant'; content: string }[]): Promise<string> {
    try {
      const messages: { role: 'user' | 'assistant' | 'system'; content: string }[] = [
        { role: 'system', content: 'You are a helpful WhatsApp assistant. Keep replies short and clear.' },
      ];
      if (history && history.length) {
        messages.push(...history);
      }
      messages.push({ role: 'user', content: prompt });

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
      });
      return completion.choices[0].message?.content || 'No response';
    } catch (error) {
      console.error('OpenAI error:', error);
      return 'Sorry, I could not process your request.';
    }
  }
}
