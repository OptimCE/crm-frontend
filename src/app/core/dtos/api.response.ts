
export class ApiResponse<T> {
  /** The data payload returned by the operation */
  data: T;
  /** Optional error code if the operation failed */
  error_code?: number;

  /**
   * Creates a new Response instance
   * @param {T} data - The data payload
   * @param {number} [error_code] - Optional error code if operation failed
   */
  constructor(data: T, error_code?: number) {
    this.data = data;
    this.error_code = error_code;
  }
}

/**
 * Pagination information for paginated API responses
 */
export class Pagination {
  /** Current page number (1-based) */
  page: number;
  /** Number of items per page */
  limit: number;
  /** Total number of items across all pages */
  total: number;
  /** Total number of pages available */
  total_pages: number;

  /**
   * Creates a new Pagination instance
   * @param {number} [page=0] - Current page number
   * @param {number} [limit=0] - Number of items per page
   * @param {number} [total=0] - Total number of items
   * @param {number} [total_pages=0] - Total number of pages
   */
  constructor(page: number = 0, limit: number = 0, total: number = 0, total_pages: number = 0) {
    this.page = page;
    this.limit = limit;
    this.total = total;
    this.total_pages = total_pages;
  }
}

/**
 * Extended response object that includes pagination information
 * @template T - Type of data contained in the response
 * @extends {ApiResponse<T>}
 */
export class ApiResponsePaginated<T> extends ApiResponse<T> {
  /** Pagination information for the response */
  pagination: Pagination;

  /**
   * Creates a new ResponsePaginated instance
   * @param {T} data - The data payload
   * @param {Pagination} pagination - Pagination information
   * @param {number} [error_code] - Optional error code if operation failed
   */
  constructor(data: T, pagination: Pagination, error_code?: number) {
    super(data, error_code);
    this.pagination = pagination;
  }
}
