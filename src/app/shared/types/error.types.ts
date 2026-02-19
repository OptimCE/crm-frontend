export type ErrorHandlerParams = Record<string, any>;

export type ErrorAdded = Record<string, (params?: ErrorHandlerParams) => string>;
export type ErrorSummaryAdded = Record<
  string,
  (params: ErrorHandlerParams, controlName: string, displayName?: string) => string
>;
export type ErrorHandlerType = Record<string, (params?: ErrorHandlerParams) => string>;
