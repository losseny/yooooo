import Bottleneck from 'bottleneck';
import {AxiosError} from 'axios';
import {DEFAULT_HTTP_RETRY_CONFIG, HttpRetryConfig} from './http-retry.config';

export class HttpRetryService {
    private limiter: Bottleneck | undefined;
    private maxRetries: number = DEFAULT_HTTP_RETRY_CONFIG.maxRetries!;

    constructor(
        private readonly logger: Console
    ) {
    }

    configure(config: Partial<HttpRetryConfig> = {}): void {
        const merged: HttpRetryConfig = {...DEFAULT_HTTP_RETRY_CONFIG, ...config};

        const {
            reservoir,
            reservoirRefreshAmount,
            reservoirRefreshIntervalMs,
            maxConcurrent,
            maxRetries,
            context,
        } = merged;

        this.maxRetries = maxRetries!;

        this.limiter = new Bottleneck({
            reservoir,
            reservoirRefreshAmount,
            reservoirRefreshInterval: reservoirRefreshIntervalMs,
            maxConcurrent,
        });

        this.logger.log(
            `Rate limiting: ${reservoir ?? 'unlimited'} req / ` +
            `${reservoirRefreshIntervalMs ?? 'no refresh'}ms, ` +
            `refresh amount ${reservoirRefreshAmount ?? 'none'}, ` +
            `max ${maxConcurrent ?? 'unlimited'} concurrent, ` +
            `${maxRetries ?? 0} retries on 429`,
            context,
        );
    }

    /**
     * Schedule a request via the rate limiter, with automatic retry on 429 responses.
     * Honors SumSub's `Retry-After` header when present, falls back to exponential backoff.
     */
    async schedule<T>(fn: () => Promise<T>, attempt = 1): Promise<T> {
        if (!this.limiter) {
            throw new Error('HttpRetryService not configured. Call configure() first.');
        }

        try {
            return await this.limiter.schedule(() => fn());
        } catch (error) {
            const axiosError = error as AxiosError;

            if (axiosError.response?.status === 429 && attempt <= this.maxRetries) {
                const waitMs = this.calculateRetryDelay(axiosError, attempt);
                await this.sleep(waitMs);
                return this.schedule(fn, attempt + 1);
            }

            throw error;
        }
    }

    /**
     * Calculate how long to wait before retrying a 429.
     * Prefers the Retry-After header, falls back to exponential backoff (1s, 2s, 4s, ...).
     */
    private calculateRetryDelay(error: AxiosError, attempt: number): number {
        const retryAfter = error.response?.headers['retry-after'];

        if (retryAfter) {
            const seconds = Number(retryAfter);
            if (!isNaN(seconds)) return seconds * 1000;
        }

        return Math.min(1000 * Math.pow(2, attempt - 1), 30_000);
    }

    public sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}