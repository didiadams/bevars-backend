import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
  Logger,
  HttpStatus,
} from '@nestjs/common';

@Catch() // Global catch-all
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let responsePayload: any = {
      statusCode: status,
      message: 'Internal server error',
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse();
      // Default HttpException response shape can be a string or object
      if (typeof exResponse === 'string') {
        responsePayload = { statusCode: status, message: exResponse };
      } else if (typeof exResponse === 'object' && exResponse !== null) {
        // Preserve provided structure (e.g. { message: string | string[], error: string })
        const { message, error, ...rest } = exResponse as Record<string, any>;
        responsePayload = {
          statusCode: status,
          message: message ?? error ?? exception.message,
          error: error,
          ...rest,
        };
      } else {
        responsePayload = { statusCode: status, message: exception.message };
      }
    }

    // Attach common metadata
    responsePayload = {
      ...responsePayload,
      path: request.url,
      method: request.method,
      timestamp: new Date().toISOString(),
      success: false,
    };

    // Improve visibility for validation errors (message can be array)
    if (Array.isArray(responsePayload.message)) {
      responsePayload.errors = responsePayload.message; // alias for frontend clarity
    }

    // Structured logging
    this.logger.error(
      `HTTP Status: ${status} | Path: ${request.method} ${request.url} | Message: ${JSON.stringify(responsePayload.message)}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    // Optionally log raw exception for internal diagnostics (keep separate line)
    this.logger.debug('Raw exception object:', (exception as any));

    response.status(status).json(responsePayload);
  }
}
