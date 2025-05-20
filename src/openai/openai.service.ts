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

  async generateOpenAIResponse(prompt: string): Promise<string> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
      });
      return completion.choices[0].message?.content || 'No response';
    } catch (error) {
      console.error('OpenAI error:', error);
      return 'Sorry, I could not process your request.';
    }
  }
}
