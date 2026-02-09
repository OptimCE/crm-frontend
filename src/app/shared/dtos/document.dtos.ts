import {PaginationQuery, Sort} from './query.dtos';

export interface DocumentQueryDTO extends PaginationQuery {
  file_name?: string;
  file_type?: string;
  sort_upload_date?: Sort;
  sort_file_size?: Sort;
}

/**
 * DTO for uploading a new document.
 */
export interface UploadDocumentDTO {
  id_member: number
  // file: Express.Multer.File; TODO: Fix this
}

/**
 * DTO representing a downloaded document.
 */
export interface DownloadDocument {
  // document: Buffer; TODO: Fix this
  fileName: string;
  fileType: string;
}

/**
 * DTO exposed to the API clients representing a document.
 */
export interface DocumentExposedDTO {
  id: number;
  file_name: string;
  file_size: number;
  upload_date: Date;
  file_type: string;
}

/**
 * Internal DTO representing a document, including sensitive or internal fields.
 * Extends DocumentExposedDTO.
 */
export interface DocumentDTO extends DocumentExposedDTO {
  member_id: number;
  file_url: string;
}
