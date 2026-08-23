import {HttpStatus} from "../http-status";

export class GigaApiError extends Error {
    constructor(
        message: string,
        readonly endpoint: string,
        readonly httpStatus?: HttpStatus,
        readonly apiCode?: string | number,
        readonly responseBody?: unknown,
    ) {
        super(message);
        this.name = 'GigaApiError';
    }
}