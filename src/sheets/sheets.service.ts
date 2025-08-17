import { Injectable, Logger } from '@nestjs/common';
import { google, sheets_v4 } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Simple Google Sheets storage using a dedicated spreadsheet with two tabs:
 * - settings: A1 headers [key, value]
 * - messages: A1 headers [timestamp, wa_id, role, content]
 *
 * Auth: expects GOOGLE_SERVICE_ACCOUNT (JSON) and GOOGLE_SHEETS_ID in env.
 */
@Injectable()
export class SheetsService {
  private readonly logger = new Logger(SheetsService.name);
  private sheets?: sheets_v4.Sheets;
  private spreadsheetId?: string;

  private getClient() {
    if (this.sheets) return this.sheets;
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    if (!spreadsheetId) {
      this.logger.warn('Google Sheets not configured. Set GOOGLE_SHEETS_ID');
      return undefined;
    }
    try {
      const envPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH;
      const defaultPath = path.resolve(process.cwd(), 'service-account.json');
      const envJson = process.env.GOOGLE_SERVICE_ACCOUNT; // fallback compatibility

      let jsonStr: string | undefined;
      if (envPath && fs.existsSync(envPath)) {
        jsonStr = fs.readFileSync(envPath, 'utf8');
      } else if (fs.existsSync(defaultPath)) {
        jsonStr = fs.readFileSync(defaultPath, 'utf8');
      } else if (envJson) {
        jsonStr = envJson;
      }

      if (!jsonStr) {
        this.logger.warn('No Google credentials found. Place service-account.json at project root or set GOOGLE_SERVICE_ACCOUNT_PATH.');
        return undefined;
      }

      let parsed: any;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (e1) {
        try {
          const decoded = Buffer.from(jsonStr, 'base64').toString('utf8');
          parsed = JSON.parse(decoded);
        } catch (e2) {
          throw e1;
        }
      }

      const privateKey = (parsed.private_key || '').replace(/\\n/g, '\n');
      if (!parsed.client_email || !privateKey) {
        throw new Error('Invalid service account: missing client_email or private_key');
      }
      const auth = new google.auth.JWT({
        email: parsed.client_email,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      this.sheets = google.sheets({ version: 'v4', auth });
      this.spreadsheetId = spreadsheetId;
      return this.sheets;
    } catch (err) {
      this.logger.error('Failed to init Google Sheets client');
      this.logger.error(err as any);
  this.logger.warn('Provide credentials via file. Preferred: service-account.json at project root, or set GOOGLE_SERVICE_ACCOUNT_PATH to the file.');
      return undefined;
    }
  }

  private async ensureSheetExists(title: string) {
    const sheets = this.getClient();
    if (!sheets || !this.spreadsheetId) return;
    try {
      const meta = await sheets.spreadsheets.get({ spreadsheetId: this.spreadsheetId });
      const exists = (meta.data.sheets || []).some((s) => s.properties?.title === title);
      if (!exists) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: this.spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: { title },
                },
              },
            ],
          },
        });
      }
    } catch (e) {
      this.logger.error(`ensureSheetExists(${title}) failed`, e as any);
    }
  }

  async ensureHeaders() {
    const sheets = this.getClient();
    if (!sheets || !this.spreadsheetId) return;
    // Ensure sheets + headers exist for simple structure
    await this.ensureSheetExists('settings');
    await this.ensureSheetExists('messages');
    await this.ensureSheetExists('facts');
    const ranges = ['settings!A1:B1', 'messages!A1:E1', 'facts!A1:D1'];
    const values = [
      [['key', 'value']],
      [['timestamp', 'wa_id', 'role', 'content', 'msg_id']],
      [['wa_id', 'key', 'value', 'updated_at']],
    ];
    try {
      await Promise.all(
        ranges.map((range, i) =>
          sheets.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId!,
            range,
            valueInputOption: 'RAW',
            requestBody: { values: values[i] },
          }),
        ),
      );
    } catch (e) {
      // ignore if already exists
    }
  }

  async appendMessage(waId: string, role: 'user' | 'assistant', content: string, msgId?: string) {
    const sheets = this.getClient();
    if (!sheets || !this.spreadsheetId) return;
    await this.ensureHeaders();
    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'messages!A:E',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[new Date().toISOString(), waId, role, content, msgId || '']],
        },
      });
    } catch (e) {
      this.logger.error('appendMessage failed', e as any);
    }
  }

  async getRecentConversation(waId: string, limit = 10): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
    const sheets = this.getClient();
    if (!sheets || !this.spreadsheetId) return [];
    try {
      const resetAt = await this.getSetting(`reset:${waId}`);
      const resetTime = resetAt ? Date.parse(resetAt) : 0;
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'messages!A2:E',
      });
      const rows = (res.data.values || [])
        .filter((r) => r[1] === waId && (!resetTime || Date.parse(r[0] as string) > resetTime))
        .slice(-limit)
        .map((r) => ({ role: (r[2] as 'user' | 'assistant') || 'user', content: (r[3] as string) || '' }));
      return rows;
    } catch (e) {
      this.logger.error('getRecentConversation failed', e as any);
      return [];
    }
  }

  async hasMessage(msgId: string): Promise<boolean> {
    if (!msgId) return false;
    const sheets = this.getClient();
    if (!sheets || !this.spreadsheetId) return false;
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'messages!E2:E',
      });
      const values = res.data.values || [];
      return values.some((row) => (row[0] || '') === msgId);
    } catch (e) {
      this.logger.error('hasMessage failed', e as any);
      return false;
    }
  }

  async getSetting(key: string): Promise<string | undefined> {
    const sheets = this.getClient();
    if (!sheets || !this.spreadsheetId) return undefined;
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'settings!A2:B',
      });
      for (const row of res.data.values || []) {
        if (row[0] === key) return row[1];
      }
      return undefined;
    } catch (e) {
      this.logger.error('getSetting failed', e as any);
      return undefined;
    }
  }

  async setSetting(key: string, value: string): Promise<void> {
    const sheets = this.getClient();
    if (!sheets || !this.spreadsheetId) return;
    await this.ensureHeaders();
    try {
      // Try find existing row
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'settings!A2:B',
      });
      const rows = res.data.values || [];
      let rowIndex = -1;
      for (let i = 0; i < rows.length; i++) {
        if (rows[i][0] === key) {
          rowIndex = i + 2; // account for header offset
          break;
        }
      }
      if (rowIndex > 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `settings!A${rowIndex}:B${rowIndex}`,
          valueInputOption: 'RAW',
          requestBody: { values: [[key, value]] },
        });
      } else {
        await sheets.spreadsheets.values.append({
          spreadsheetId: this.spreadsheetId,
          range: 'settings!A:B',
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [[key, value]] },
        });
      }
    } catch (e) {
      this.logger.error('setSetting failed', e as any);
    }
  }

  async getAllSettings(): Promise<Record<string, string>> {
    const sheets = this.getClient();
    const map: Record<string, string> = {};
    if (!sheets || !this.spreadsheetId) return map;
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'settings!A2:B',
      });
      for (const row of res.data.values || []) {
        const k = (row[0] as string) || '';
        const v = (row[1] as string) || '';
        if (k) map[k] = v;
      }
      return map;
    } catch (e) {
      this.logger.error('getAllSettings failed', e as any);
      return map;
    }
  }

  async resetConversation(waId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.setSetting(`reset:${waId}`, now);
  }
}
