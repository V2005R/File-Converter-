export enum Category {
  BOOKS = 'Books',
  TOYS = 'Toys',
  FASHION = 'Fashion',
  ESSENTIALS = 'Essentials',
}

export type ProcessingStatus = 'idle' | 'processing' | 'success' | 'error';

export interface ProcessedResult {
  zipBlob: Blob;
  fileName: string;
  count: number;
}
