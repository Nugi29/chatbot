import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WhatsappController } from './whatsapp/whatsapp.controller';
import { ConfigModule } from '@nestjs/config';
import { WhatsappService } from './whatsapp/whatsapp.service';
import { OpenaiService } from './openai/openai.service';
import { SheetsService } from './sheets/sheets.service';


@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [AppController, WhatsappController],
  providers: [AppService, WhatsappService, OpenaiService, SheetsService],
})
export class AppModule {}
