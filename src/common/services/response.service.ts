import { HttpStatus, Injectable } from '@nestjs/common';

@Injectable()
export class ResponseService {
  sendSuccess<T>(
    message: string,
    data: T | any = null,
    statusCode: number = HttpStatus.OK,
  ) {
    return {
      statusCode,
      message,
      data,
    };
  }
  sendCreated<T>(
    message: string,
    data: T | any = null,
    statusCode: number = HttpStatus.CREATED,
  ) {
    return {
      statusCode,
      message,
      data,
    };
  }
  sendNoContent(message: string) {
    return {
      statusCode: HttpStatus.NO_CONTENT,
      message,
    };
  }
  sendAccepted<T>(message: string, data: T | any = null) {
    return this.sendSuccess(message, data, HttpStatus.ACCEPTED);
  }
  sendError(message: string, error: any = null) {
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message,
      error,
    };
  }
}
