import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatRepository, ChatMessageRepository } from './repositories/chat.repository';
import { Chat, ChatMessage } from './entities/chat.entity';
import { OrderModule } from '../order/order.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Chat, ChatMessage]),
    forwardRef(() => OrderModule),
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatRepository, ChatMessageRepository],
  exports: [ChatService, ChatRepository, ChatMessageRepository],
})
export class ChatModule {}
