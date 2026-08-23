export interface HttpRetryConfig {
    reservoir?: number;
    reservoirRefreshAmount?: number;
    reservoirRefreshIntervalMs?: number;
    maxConcurrent?: number;
    maxRetries?: number;
    context?: string
}

export const DEFAULT_HTTP_RETRY_CONFIG: HttpRetryConfig = {
    reservoir: 100,
    reservoirRefreshAmount: 100,
    reservoirRefreshIntervalMs: 5000,
    maxConcurrent: 10,
    maxRetries: 3,
};