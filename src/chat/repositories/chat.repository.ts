import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Chat, ChatMessage, ChatStatus } from '../entities/chat.entity';

@Injectable()
export class ChatRepository extends Repository<Chat> {
  constructor(
    @InjectRepository(Chat)
    private repository: Repository<Chat>,
  ) {
    super(repository.target, repository.manager, repository.queryRunner);
  }

  async findByOrderId(orderId: string): Promise<Chat | null> {
    return this.findOne({
      where: { orderId },
      relations: [
        'globalBuyer', 
        'globalBuyer.user', 
        'exporter', 
        'exporter.user', 
        'order', 
        'messages', 
        'messages.sender'
      ],
      order: { messages: { createdAt: 'ASC' } },
    });
  }

  async findByUserId(userId: string): Promise<Chat[]> {
    return this.find({
      where: [
        { globalBuyer: { userId } },
        { exporter: { userId } },
      ],
      relations: [
        'globalBuyer', 
        'globalBuyer.user', 
        'exporter', 
        'exporter.user', 
        'order', 
        'messages'
      ],
      order: { lastMessageAt: 'DESC' },
    });
  }

  async findActiveChats(userId: string): Promise<Chat[]> {
    return this.find({
      where: [
        { globalBuyer: { userId }, status: ChatStatus.ACTIVE },
        { exporter: { userId }, status: ChatStatus.ACTIVE },
      ],
      relations: [
        'globalBuyer', 
        'globalBuyer.user', 
        'exporter', 
        'exporter.user', 
        'order'
      ],
      order: { lastMessageAt: 'DESC' },
    });
  }
}

@Injectable()
export class ChatMessageRepository extends Repository<ChatMessage> {
  constructor(
    @InjectRepository(ChatMessage)
    private repository: Repository<ChatMessage>,
  ) {
    super(repository.target, repository.manager, repository.queryRunner);
  }

  async findByChatId(chatId: string): Promise<ChatMessage[]> {
    return this.find({
      where: { chatId },
      relations: ['sender'],
      order: { createdAt: 'ASC' },
    });
  }

  async markMessagesAsRead(chatId: string, userId: string): Promise<void> {
    await this.createQueryBuilder()
      .update(ChatMessage)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where('chatId = :chatId', { chatId })
      .andWhere('senderId != :userId OR senderId IS NULL', { userId })
      .andWhere('isRead = :isRead', { isRead: false })
      .execute();
  }

  async getUnreadCount(chatId: string, userId: string): Promise<number> {
    return this.createQueryBuilder('message')
      .where('message.chatId = :chatId', { chatId })
      .andWhere('(message.senderId != :userId OR message.senderId IS NULL)', { userId })
      .andWhere('message.isRead = :isRead', { isRead: false })
      .getCount();
  }
}
