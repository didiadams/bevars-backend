import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChatService } from './chat.service';
import { ChatStatus } from './entities/chat.entity';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('my-chats')
  async getMyChats(@Request() req, @Query('active') activeOnly?: string) {
    if (activeOnly === 'true') {
      return this.chatService.getActiveChats(req.user.id);
    }
    return this.chatService.getUserChats(req.user.id);
  }

  @Get('order/:orderId')
  async getChatByOrder(@Param('orderId') orderId: string, @Request() req) {
    return this.chatService.getChatByOrderId(orderId, req.user.id);
  }

  @Get(':chatId')
  async getChat(@Param('chatId') chatId: string, @Request() req) {
    return this.chatService.getChatById(chatId, req.user.id);
  }

  @Get(':chatId/messages')
  async getChatMessages(@Param('chatId') chatId: string, @Request() req) {
    return this.chatService.getChatMessages(chatId, req.user.id);
  }

  @Post(':chatId/messages')
  async sendMessage(
    @Param('chatId') chatId: string,
    @Body() messageDto: {
      message: string;
      attachments?: string[];
    },
    @Request() req
  ) {
    return this.chatService.sendMessage(
      chatId,
      req.user.id,
      messageDto.message,
      messageDto.attachments
    );
  }

  @Patch(':chatId/read')
  async markAsRead(@Param('chatId') chatId: string, @Request() req) {
    await this.chatService.markMessagesAsRead(chatId, req.user.id);
    return { success: true, message: 'Messages marked as read' };
  }

  @Patch(':chatId/status')
  async updateChatStatus(
    @Param('chatId') chatId: string,
    @Body() statusDto: { status: ChatStatus },
    @Request() req
  ) {
    return this.chatService.updateChatStatus(chatId, statusDto.status, req.user.id);
  }

  @Patch(':chatId/archive')
  async archiveChat(@Param('chatId') chatId: string, @Request() req) {
    return this.chatService.archiveChat(chatId, req.user.id);
  }

  @Patch(':chatId/close')
  async closeChat(@Param('chatId') chatId: string, @Request() req) {
    return this.chatService.closeChat(chatId, req.user.id);
  }

  @Get(':chatId/unread-count')
  async getUnreadCount(@Param('chatId') chatId: string, @Request() req) {
    const count = await this.chatService.getUnreadMessageCount(chatId, req.user.id);
    return { count };
  }
}
