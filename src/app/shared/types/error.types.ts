export type ErrorHandlerParams = { [key: string]: any };

export type ErrorAdded = { [key: string]: (params?: ErrorHandlerParams) => string };
export type ErrorSummaryAdded = { [key: string]: (params: ErrorHandlerParams, controlName: string, displayName?:string) => string };
export type ErrorHandlerType = { [key: string]: (params?: ErrorHandlerParams) => string };
