import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ChatRepository, ChatMessageRepository } from './repositories/chat.repository';
import { Chat, ChatMessage, ChatStatus } from './entities/chat.entity';
import { Order } from '../order/entities/order.entity';

@Injectable()
export class ChatService {
  constructor(
    private readonly chatRepository: ChatRepository,
    private readonly chatMessageRepository: ChatMessageRepository,
  ) {}

  async createChatForOrder(order: Order): Promise<Chat> {
    // Check if chat already exists
    const existingChat = await this.chatRepository.findByOrderId(order.id);
    if (existingChat) {
      return existingChat;
    }

    const chat = this.chatRepository.create({
      orderId: order.id,
      globalBuyerId: order.globalBuyerId,
      exporterId: order.exporterId,
      status: ChatStatus.ACTIVE,
      title: `Order Discussion - ${order.orderNumber}`,
      lastMessageAt: new Date(),
    });

    const savedChat = await this.chatRepository.save(chat);

    // Send initial system message
    await this.sendSystemMessage(
      savedChat.id,
      `Chat started for order ${order.orderNumber}. Both parties can now communicate directly.`
    );

    return savedChat;
  }

  async sendMessage(
    chatId: string,
    senderId: string,
    message: string,
    attachments: string[] = []
  ): Promise<ChatMessage> {
    const chat = await this.chatRepository.findOne({
      where: { id: chatId },
      relations: ['globalBuyer', 'globalBuyer.user', 'exporter', 'exporter.user'],
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    // Check if user has access to this chat
    const hasAccess = 
      chat.globalBuyer?.userId === senderId || 
      chat.exporter?.userId === senderId;

    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this chat');
    }

    if (chat.status === ChatStatus.CLOSED) {
      throw new BadRequestException('Cannot send messages to a closed chat');
    }

    const chatMessage = this.chatMessageRepository.create({
      chatId,
      senderId,
      message,
      attachments,
      isSystemMessage: false,
    });

    const savedMessage = await this.chatMessageRepository.save(chatMessage);

    // Update chat's last message timestamp
    chat.lastMessageAt = new Date();
    await this.chatRepository.save(chat);

    return savedMessage;
  }

  async sendSystemMessage(chatId: string, message: string): Promise<ChatMessage> {
    const chatMessage = this.chatMessageRepository.create({
      chatId,
      senderId: null, // System message
      message,
      isSystemMessage: true,
    });

    return this.chatMessageRepository.save(chatMessage);
  }

  async getChatByOrderId(orderId: string, userId: string): Promise<Chat> {
    const chat = await this.chatRepository.findByOrderId(orderId);

    if (!chat) {
      throw new NotFoundException('Chat not found for this order');
    }

    // Check access
    const hasAccess = 
      chat.globalBuyer?.userId === userId || 
      chat.exporter?.userId === userId;

    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this chat');
    }

    return chat;
  }

  async getChatById(chatId: string, userId: string): Promise<Chat> {
    const chat = await this.chatRepository.findOne({
      where: { id: chatId },
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

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    // Check access
    const hasAccess = 
      chat.globalBuyer?.userId === userId || 
      chat.exporter?.userId === userId;

    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this chat');
    }

    return chat;
  }

  async getUserChats(userId: string): Promise<Chat[]> {
    return this.chatRepository.findByUserId(userId);
  }

  async getActiveChats(userId: string): Promise<Chat[]> {
    return this.chatRepository.findActiveChats(userId);
  }

  async markMessagesAsRead(chatId: string, userId: string): Promise<void> {
    const chat = await this.getChatById(chatId, userId);
    await this.chatMessageRepository.markMessagesAsRead(chatId, userId);
  }

  async getChatMessages(chatId: string, userId: string): Promise<ChatMessage[]> {
    // Verify access first
    await this.getChatById(chatId, userId);
    
    return this.chatMessageRepository.findByChatId(chatId);
  }

  async updateChatStatus(chatId: string, status: ChatStatus, userId: string): Promise<Chat> {
    const chat = await this.getChatById(chatId, userId);
    
    chat.status = status;
    return this.chatRepository.save(chat);
  }

  async archiveChat(chatId: string, userId: string): Promise<Chat> {
    return this.updateChatStatus(chatId, ChatStatus.ARCHIVED, userId);
  }

  async closeChat(chatId: string, userId: string): Promise<Chat> {
    const chat = await this.updateChatStatus(chatId, ChatStatus.CLOSED, userId);
    
    // Send system message
    await this.sendSystemMessage(chatId, 'Chat has been closed.');
    
    return chat;
  }

  async getUnreadMessageCount(chatId: string, userId: string): Promise<number> {
    // Verify access first
    await this.getChatById(chatId, userId);
    
    return this.chatMessageRepository.getUnreadCount(chatId, userId);
  }
}
