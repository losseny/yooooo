import {Environment} from "./env";
import * as crypto from 'crypto';
import {
    GigaApiSignature,
    ProductDetails,
    ProductRecord,
    QueryDataResponse,
    QueryProductsBody,
    QueryResponse
} from "./types";
import axios, {AxiosInstance, AxiosResponse, Method} from 'axios';

export class GigaApi {

    private static readonly ALGORITHM: string = "sha256";
    private readonly instance: AxiosInstance;

    constructor(private readonly logger: any = console) {
        if (!Environment.GetEnvironment("GIGA_B2B_BASE_URL")) {
            throw new Error('GIGA_B2B_BASE_URL was not configured');
        }
        this.instance = axios.create({
            baseURL: Environment.GetEnvironment("GIGA_B2B_BASE_URL"),
            timeout: 15000,
            headers: {Accept: 'application/json'},
        });
    }

    public async queryProducts(queryProductsParams?: QueryProductsBody): Promise<QueryResponse<QueryDataResponse<ProductRecord>>> {
        if (!queryProductsParams) {
            queryProductsParams = {
                lastUpdatedAfter: '2024-02-19 02:16:48',
                firstArrivalDate: '2025-02-19',
                sort: 4,
                page: 1,
                pageSize: 100,
            };
        }
        return await this.post<QueryProductsBody, QueryDataResponse<ProductRecord>>(
            '/api/v1/test"',
            queryProductsParams
        );
    }

    public async queryProductsDetails(queryableSkus: string[] | ProductRecord[]): Promise<QueryResponse<ProductDetails> | undefined> {
        if (queryableSkus.length === 0) {
            return undefined;
        }

        const body: { skus: string[] } = {skus: []};

        if (typeof queryableSkus[0] != 'string') {
            body.skus = (queryableSkus as ProductRecord[]).map((record: ProductRecord): string => record.sku)
        } else {
            body.skus = queryableSkus as string[];
        }

        return await this.post<{ skus: string[] }, ProductDetails>(
            '/b2b-overseas-api/v1/buyer/product/detailInfo/v1',
            body
        );
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

    private async request<Response>(
        method: Method,
        endpoint: string,
        body?: any,
    ): Promise<QueryResponse<Response>> {
        const signature: GigaApiSignature = this.generateApiSign(endpoint)
        let response: AxiosResponse<QueryResponse<Response>>;

        try {
            response = await this.instance.request<QueryResponse<Response>>({
                url: endpoint,
                method: method,
                headers: {
                    timestamp: String(signature.timestamp),
                    nonce: signature.nonce,
                    sign: signature.signature,
                    "client-id": signature.clientId,
                },
                data: body,
            });
        } catch (e: any) {
            console.log(JSON.stringify(e.status, null, 2));
            console.log(JSON.stringify(typeof e.status, null, 2));
            throw e;
        }

        // if (
        //     !response.status ||
        //     response.status < HttpStatus.OK
        // ) {
        //     throw new Error(response.statusText);
        // }

        return response.data;
    }

    private generateApiSign(uri: string): GigaApiSignature {
        const timestamp: number = Date.now();
        const nonce: string = this.secureRandomDigits10();

        const message: string = `${Environment.GetEnvironment("GIGA_B2B_CLIENT_ID")}&${uri}&${timestamp}&${nonce}`;
        const key: string = `${Environment.GetEnvironment("GIGA_B2B_CLIENT_ID")}&${Environment.GetEnvironment("GIGA_B2B_PASSWORD")}&${nonce}`;

        return {
            signature: this.sign(message, key),
            nonce,
            timestamp,
            uri,
            clientId: Environment.GetEnvironment("GIGA_B2B_CLIENT_ID")
        }
    }

    private sign(message: string, key: string): string {
        const digest = crypto.createHmac(GigaApi.ALGORITHM, key)
            .update(message, 'utf8')
            .digest('hex');

        return Buffer.from(digest).toString('base64');
    }

    private secureRandomDigits10(): string {
        const arr = new Uint32Array(1);
        crypto.getRandomValues(arr);
        return String(arr[0] % 10000000000).padStart(10, '0');
    }
}