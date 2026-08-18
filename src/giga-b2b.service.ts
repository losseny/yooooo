import {GigaApi} from "./giga-b2b.api";
import {ProductDetails, ProductRecord, QueryDataResponse, QueryProductsBody, QueryResponse} from "./types";

export class GigaB2bService {
    private readonly api: GigaApi;

    public constructor() {
        this.api = new GigaApi();
    }

    public async* importExternalMarketProducts(): AsyncGenerator<QueryResponse<ProductDetails> | any[]> {
        let availableProducts: QueryResponse<QueryDataResponse<ProductRecord>>;
        const options: QueryProductsBody = {
            lastUpdatedAfter: '2024-02-19 02:16:48',
            firstArrivalDate: '2025-02-19',
            sort: 4,
            page: 1,
            pageSize: 100,
        };

        while (true) {
            try {
                availableProducts = await this.api.queryProducts(options);
                console.log(JSON.stringify(availableProducts.data.pageInfo, null, 2));

                if (!availableProducts) {
                    yield [];
                    break;
                }

                const productDetails: QueryResponse<ProductDetails> | undefined = await this.api.queryProductsDetails(availableProducts.data.records);
                if (!productDetails) {
                    yield [];
                    break;
                }
                yield productDetails;

                if (options.page >= availableProducts.data.pageInfo.totalPage) {
                    break
                }
                options.page++;

            } catch (e) {
                yield [];
            }
        }
    }
}