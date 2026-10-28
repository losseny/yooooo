import {
    GigaApiSignature,
    OrderStatusInfo,
    OrderTrackInfo,
    PageInfo,
    ProductDetail,
    ProductInventory,
    ProductPrice,
    ProductRecord,
    QueryDataResponse,
    queryLogisticsBody,
    QueryProductsBody,
    QueryResponse,
    ShipmentOrder
} from "./types";
import axios, {AxiosInstance, AxiosResponse, Method} from 'axios';
import {GigaApiError} from "./context/giga-api.error";
import {GigaB2bContext} from "./context/giga-b2b.context";
import {DateTime} from "luxon";
import {ExternalCommunicationDataResponse} from "./common.index";
import {MarketConfigEntryStatus} from "./database/entities/enums";
import {HttpRetryService} from "./infrastructure/http-retry/http-retry.service";
import * as fs from "fs";
import * as path from "path";
import {randomUUID} from "crypto";

DateTime.local();


export abstract class MarketApiContextInterface {

    protected constructor(
        protected readonly logger: Console
    ) {
    }

}


export class GigaApi extends MarketApiContextInterface {
    private readonly context: GigaB2bContext;
    private readonly instance: AxiosInstance;

    constructor(
        context: GigaB2bContext,
        private readonly httpRetry: HttpRetryService,
    ) {
        super(console);

        this.context = context;
        this.instance = axios.create({
            baseURL: this.context.apiHost,
            timeout: Number(process.env.GIGA_TIMEOUT_MS ?? 15000),
            headers: {Accept: 'application/json'},
        });

        this.logger.log('GigaB2B context initialized')
    }


    public async queryProducts(pageInfo?: PageInfo): Promise<QueryResponse<QueryDataResponse<ProductRecord>> | undefined> {
        const queryProductsParams: QueryProductsBody = {
            page: pageInfo?.page ? pageInfo.page + 1 : 1,
            pageSize: pageInfo?.pageSize ?? 200,
            lastUpdatedAfter: DateTime
                .fromJSDate(this.context.market.lastImportedProductsDate ?? new Date())
                .toFormat("yyyy-MM-dd HH:mm:ss"),
            sort: 1,
        };

        this.logger.log(
            `Querying products: page=${queryProductsParams.page}, ` +
            `pageSize=${queryProductsParams.pageSize}, ` +
            `lastUpdatedAfter=${queryProductsParams.lastUpdatedAfter}`,
        );

        try {
            const response: QueryResponse<QueryDataResponse<ProductRecord>> = await this.post<QueryProductsBody, QueryDataResponse<ProductRecord>>(
                '/b2b-overseas-api/v1/buyer/product/skus/v1',
                queryProductsParams
            );

            if (!response.success) {
                this.logger.error(`Failed to query products: ${response.code} ${response.msg} ${response.subMsg ?? ''}`);
                return undefined;
            }

            // Giga returns pageInfo/records null when there are no (more) results.
            response.data.records ??= [];
            response.data.pageInfo ??= {
                page: queryProductsParams.page,
                totalPage: 0,
                pageSize: queryProductsParams.pageSize,
                totalNum: 0,
            };
            response.data.pageInfo.end = response.data.pageInfo.page >= response.data.pageInfo.totalPage;

            this.logger.log(
                `Queried products: page ${response.data.pageInfo.page} returned ` +
                `${response.data.records?.length ?? 0} record(s)`,
            );

            return response;
        } catch (error) {
            this.logger.error(`Failed to query products: ${this.formatError(error)}`);
            return undefined;
        }
    }

    public async validateMarketInstance(): Promise<ExternalCommunicationDataResponse<MarketConfigEntryStatus>> {
        const queryProductsParams: QueryProductsBody = {
            page: 1,
            pageSize: 100,
            lastUpdatedAfter: DateTime
                .fromJSDate(new Date())
                .toFormat("yyyy-MM-dd HH:mm:ss"),
            sort: 1,
        };

        this.logger.log('Validating market instance');

        try {
            const validation: QueryResponse<QueryDataResponse<ProductRecord>> = await this.post<QueryProductsBody, QueryDataResponse<ProductRecord>>(
                '/b2b-overseas-api/v1/buyer/product/skus/v1',
                queryProductsParams
            );

            if (validation && validation.success) {
                this.logger.log('Market instance validation succeeded');
                return {
                    success: true,
                    data: MarketConfigEntryStatus.Valid
                }
            }

            this.logger.warn('Market instance validation failed');
            return {
                success: false,
                data: MarketConfigEntryStatus.Invalid
            }
        } catch (error) {
            this.logger.error(`Failed to validate market instance: ${this.formatError(error)}`);
            return {
                success: false,
                data: MarketConfigEntryStatus.Invalid
            }
        }
    }


    public async queryProductsDetails(queryableSkus: string[] | ProductRecord[]): Promise<QueryResponse<ProductDetail[]> | undefined> {
        return await this.queryProductLogistics<ProductDetail>(
            '/b2b-overseas-api/v1/buyer/product/detailInfo/v1',
            queryableSkus
        );
    }

    public async queryProductInventories(queryableSkus: string[] | ProductRecord[]): Promise<QueryResponse<ProductInventory[]> | undefined> {
        return await this.queryProductLogistics<ProductInventory>(
            '/b2b-overseas-api/v1/buyer/inventory/quantity/v2',
            queryableSkus
        );
    }

    public async queryProductPrices(queryableSkus: string[] | ProductRecord[]): Promise<QueryResponse<ProductPrice[]> | undefined> {
        return await this.queryProductLogistics<ProductPrice>(
            '/b2b-overseas-api/v1/buyer/product/price/v1',
            queryableSkus
        );
    }

    public async queryOrderStatus(orderNumbers: string[]): Promise<QueryResponse<OrderStatusInfo[]>> {
        this.logger.log(`Querying order status for ${orderNumbers.length} order number(s)`);

        const body: { orderNo: string[] } = {
            orderNo: orderNumbers
        }
        const response: QueryResponse<OrderStatusInfo[]> = await this.post<{ orderNo: string[] }, OrderStatusInfo[]>(
            '/b2b-overseas-api/v1/buyer/order/status/v1',
            body
        );

        this.logger.log(`Order status query returned ${response?.data?.length ?? 0} result(s)`);

        return response;
    }

    async queryOrderLogistics(orderNumbers: string[]): Promise<QueryResponse<OrderTrackInfo[]>> {
        this.logger.log(`Querying order logistics for ${orderNumbers.length} order number(s)`);

        const body: { orderNo: string[] } = {
            orderNo: orderNumbers
        }
        const response: QueryResponse<OrderTrackInfo[]> = await this.post<{ orderNo: string[] }, OrderTrackInfo[]>(
            '/b2b-overseas-api/v1/buyer/order/track-no/v1',
            body
        );
        console.log(JSON.stringify(response, null, 2));

        this.logger.log(`Order logistics query returned ${response?.data?.length ?? 0} result(s)`);

        return response;
    }

    async exportShipmentOrder(shipmentOrder: ShipmentOrder): Promise<QueryResponse<void>> {
        this.logger.log(`Exporting shipment order ${shipmentOrder.orderNo}`);
        //
        // const response: QueryResponse<void> = await this.post<ShipmentOrder, void>(
        //     '/b2b-overseas-api/v1/buyer/order/dropShip-sync/v1',
        //     shipmentOrder
        // );

        const response = {
            success: true,
            code: "",
            data: null,
            requestId: "",
            msg: "",
            subMsg: null,
            recommend: null,
        }
        this.logger.log(`Shipment order ${shipmentOrder.orderNo} exported (success: ${response?.success})`);

        return response;
    }

    private async queryProductLogistics<T>(uri: string, queryableSkus: string[] | ProductRecord[]): Promise<QueryResponse<T[]> | undefined> {
        this.logger.log(`Querying ${uri} for ${queryableSkus.length} SKU(s)`);

        try {
            if (queryableSkus.length === 0) {
                this.logger.warn(`Skipping ${uri}: no SKUs provided`);
                return undefined;
            }

            const body: queryLogisticsBody = {skus: []};

            if (typeof queryableSkus[0] != 'string') {
                body.skus = (queryableSkus as ProductRecord[]).map((record: ProductRecord): string => record.sku)
            } else {
                body.skus = queryableSkus as string[];
            }

            const response: QueryResponse<T[]> = await this.post<{ skus: string[] }, T[]>(
                uri,
                body
            );

            this.logger.log(`${uri} returned ${response.data?.length ?? 0} result(s)`);

            return response;
        } catch (error) {
            this.logger.error(`Failed to query ${uri}: ${this.formatError(error)}`);
            return undefined;
        }
    }

    private async get<T>(
        endpoint: string,
    ): Promise<QueryResponse<T>> {
        return this.request('GET', endpoint);
    }

    public async post<B, T>(endpoint: string, body?: B): Promise<QueryResponse<T>> {
        return this.request<T, B>('POST', endpoint, body);
    }

    private async patch<B, T>(endpoint: string, body: B): Promise<QueryResponse<T>> {
        return this.request<T>('PATCH', endpoint, body);
    }

    private async request<Response, Request = unknown, >(
        method: Method,
        endpoint: string,
        body?: Request,
        options?: { query: Record<string, string> }
    ): Promise<QueryResponse<Response>> {
        const uri: string = this.buildUri(endpoint, options?.query);
        const hasBody: boolean = body !== undefined

        const signature: GigaApiSignature = this.context.generateApiSign(endpoint)
        let response: AxiosResponse<QueryResponse<Response>>;

        const start: number = Date.now();

        try {
            response = await this.httpRetry.schedule<AxiosResponse<QueryResponse<Response>>>(() =>
                this.instance.request<QueryResponse<Response>>({
                    url: uri,
                    method: method,
                    headers: {
                        timestamp: String(signature.timestamp),
                        nonce: signature.nonce,
                        sign: signature.signature,
                        "client-id": signature.clientId,
                        ...(hasBody ? {'Content-Type': 'application/json'} : {})
                    },
                    ...(hasBody ? {data: body} : {})
                })
            );
        } catch (e) {
            if (axios.isAxiosError(e)) {
                this.record(method, uri, body, start, e.response?.status, e.response?.headers, e.response?.data ?? e.message);
            }
            throw this.toGigaApiError(e, uri)
        }

        this.record(method, uri, body, start, response.status, response.headers, response.data);

        this.logger.log(
            `GigaApi ${method} ${uri} completed in ${Date.now() - start}ms (HTTP ${response.status})`,
        );

        return this.unwrap(response.data, uri)
    }

    // Writes every request/response pair to GIGA_RECORD_DIR (if set) as raw material for a Giga mock.
    private record(method: Method, uri: string, body: unknown, start: number, status: number | undefined, headers: unknown, response: unknown): void {
        const dir: string | undefined = process.env.GIGA_RECORD_DIR;
        if (!dir) {
            return;
        }

        const target: string = path.join(dir, 'raw', uri.replace(/^\/b2b-overseas-api\//, '').replace(/[^\w.-]+/g, '_'));
        fs.mkdirSync(target, {recursive: true});
        fs.writeFileSync(
            path.join(target, `${new Date(start).toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}.json`),
            JSON.stringify({
                method,
                uri,
                requestedAt: new Date(start).toISOString(),
                durationMs: Date.now() - start,
                request: body ?? null,
                status: status ?? null,
                headers: headers ?? null,
                response,
            }, null, 2),
        );
    }

    private buildUri(endpoint: string, query: Record<string, string> | undefined): string {
        if (!query || Object.keys(query).length === 0) {
            return endpoint;
        }

        return `${endpoint}?${new URLSearchParams(query).toString()}`
    }

    private toGigaApiError(e: unknown, uri: string): GigaApiError {
        if (!axios.isAxiosError(e)) {
            const message: string = e instanceof Error ? e.message : String(e);
            this.logger.error(`Unexpected error calling ${uri}: ${message}`);
            return new GigaApiError(message, uri);
        }

        const status: number | undefined = e.response?.status;
        const data: unknown = e.response?.data;

        this.logger.error(
            `GigaApi ${uri} failed (HTTP ${status ?? 'no response'}): ` +
            `${typeof data === 'string' ? data : JSON.stringify(data)}`,
        )

        return new GigaApiError(
            `Request to ${uri} failed with status ${status ?? 'unknown'}`,
            uri,
            status,
            undefined,
            data,
        )
    }

    private formatError(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }

    private unwrap<Response>(
        envelope: QueryResponse<Response>,
        uri: string,
    ): QueryResponse<Response> {
        if (!envelope) {
            this.logger.error(`Empty response body from ${uri}`);
            throw new GigaApiError(`Empty response body from ${uri}`, uri)
        }

        return envelope;
    }
}