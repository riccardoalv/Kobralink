import type { FarolPrintEvent } from '@farolprint/shared';
import { Controller, Get, Post } from '@nestjs/common';
import { NotificationService } from './notification.service';

@Controller('api/v1')
export class NotificationController {
    constructor(private readonly notifications: NotificationService) {}

    @Get('notifications')
    recent(): FarolPrintEvent[] {
        return this.notifications.recent();
    }

    @Post('notifications/test')
    test() {
        return this.notifications.test();
    }
}
