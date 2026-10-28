import { z } from 'zod';
import { startPrintSchema } from './files';

export interface QueueItemDto {
    id: string;
    printerId: string;
    fileId: string;
    filename: string;
    thumbnail: string | null;
    estPrintTimeSec: number;
    position: number;
    excludedObjects: string[];
    options: QueuePrintOptions;
    createdAt: string;
}

export const queuePrintOptionsSchema = startPrintSchema.omit({ fileId: true, excludedObjects: true });
export type QueuePrintOptions = z.input<typeof queuePrintOptionsSchema>;

export const addQueueItemSchema = startPrintSchema.extend({ fileId: z.string().min(1) });
export type AddQueueItemInput = z.input<typeof addQueueItemSchema>;

export const reorderQueueSchema = z.object({ ids: z.array(z.string().min(1)).max(500) });
export type ReorderQueueInput = z.infer<typeof reorderQueueSchema>;

export interface QueueStatusDto {
    awaitingBedClear: boolean;
    nextFilename: string | null;
}
