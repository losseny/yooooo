import {
    GigaApiSignature,
    PageInfo,
    ProductDetail,
    ProductInventory,
    ProductPrice,
    ProductRecord,
    QueryDataResponse,
    queryLogisticsBody,
    QueryProductsBody,
    QueryResponse
} from "./types";
import axios, {AxiosInstance, AxiosResponse, Method} from 'axios';
import {GigaApiError} from "./context/giga-api.error";
import {GigaB2bContext} from "./context/giga-b2b.context";
import {DateTime} from "luxon";

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
    ) {
        super(console);

        this.context = context;
        this.instance = axios.create({
            baseURL: this.context.apiHost,
            timeout: 15000,
            headers: {Accept: 'application/json'},
        });

        this.logger.log('GigaB2B context initialized')
    }

    public async queryProducts(pageInfo?: PageInfo): Promise<QueryResponse<QueryDataResponse<ProductRecord>> | undefined> {
        const queryProductsParams: QueryProductsBody = {
            page: pageInfo?.page ? pageInfo.page++ : 1,
            pageSize: pageInfo?.pageSize ?? 100,
            lastUpdatedAfter: DateTime
                .fromJSDate(this.context.market.lastImportedProductsDate)
                .toFormat("yyyy-MM-dd"),
            sort: 1,
        };

        try {
            const response: QueryResponse<QueryDataResponse<ProductRecord>> = await this.post<QueryProductsBody, QueryDataResponse<ProductRecord>>(
                '/b2b-overseas-api/v1/buyer/product/skus/v1',
                queryProductsParams
            );

            if (queryProductsParams.page >= response.data.pageInfo.page) {
                response.data.pageInfo.end = true;
            }

            return response;
        } catch (error) {
            return undefined;
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

    private async queryProductLogistics<T>(uri: string, queryableSkus: string[] | ProductRecord[]): Promise<QueryResponse<T[]> | undefined> {
        try {
            if (queryableSkus.length === 0) {
                return undefined;
            }

            const body: queryLogisticsBody = {skus: []};

            if (typeof queryableSkus[0] != 'string') {
                body.skus = (queryableSkus as ProductRecord[]).map((record: ProductRecord): string => record.sku)
            } else {
                body.skus = queryableSkus as string[];
            }

            return await this.post<{ skus: string[] }, T[]>(
                uri,
                body
            );
        } catch (error) {
            return undefined;
        }
    }

    private async get<T>(
        endpoint: string,
    ): Promise<QueryResponse<T>> {
        return this.request('GET', endpoint);
    }

    private async post<B, T>(endpoint: string, body?: B): Promise<QueryResponse<T>> {
        return this.request<T>('POST', endpoint, body);
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

        try {
            response = await this.instance.request<QueryResponse<Response>>({
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
            });
        } catch (e) {
            throw this.toGigaApiError(e, uri)
        }

        return this.unwrap(response.data, uri)
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

    private unwrap<Response>(
        envelope: QueryResponse<Response>,
        uri: string,
    ): QueryResponse<Response> {
        if (!envelope) {
            throw new GigaApiError(`Empty response body from ${uri}`, uri)
        }

        return envelope;
    }

}