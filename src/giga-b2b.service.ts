import {GigaApi} from "./giga-b2b.api";
import {ProductDetail, ProductInventory, ProductPrice, ProductRecord, QueryDataResponse, QueryResponse} from "./types";
import {GigaB2bContext} from "./context/giga-b2b.context";
import {HttpRetryService} from "./infrastructure/http-retry/http-retry.service";
import {
    ExternalCommunicationAttachment,
    ExternalCommunicationAttachmentData,
    ExternalCommunicationDataResponse,
    ExternalMarketProductUpdate,
    ExternalOrderLogisticsDetails,
    ExternalOrderStatusDetails,
    LogisticsAvailability,
    LogisticsOverview,
    ProductCategoryBundle
} from "./common.index";
import {Product} from "./database/entities/product.entity";
import {OrderVariant} from "./database/entities/order-variant.entity";
import {MarketConfigEntryStatus, RemoteDocType} from "./database/entities/enums";
import axios from "axios";
import {ProductCategory} from "./database/entities/product-category.entity";
import {ProductImage} from "./database/entities/product-image.entity";

export class GigaB2bService {
    private readonly api: GigaApi;
    private readonly logger: Console = console;

    public constructor(
        private readonly context: GigaB2bContext,
        private readonly httpRetry: HttpRetryService,
    ) {
        this.api = new GigaApi(context);
        this.httpRetry.configure();
    }


    public async* importExternalMarketProducts(): AsyncGenerator<ProductCategoryBundle[]> {
        let availableProducts: QueryResponse<QueryDataResponse<ProductRecord>> | undefined = undefined;

        while (true) {
            try {
                availableProducts = await this.api.queryProducts(availableProducts?.data.pageInfo);

                if (!availableProducts) {
                    yield [];
                    break;
                }

                const productDetails: QueryResponse<ProductDetail[]> | undefined = await this.api.queryProductsDetails(availableProducts.data.records);
                if (!productDetails) {
                    yield [];
                } else {
                    yield this.mapMarketProductsToBundles(productDetails.data);
                }

                if (availableProducts.data.pageInfo.end) {
                    break
                }

            } catch (e) {
                yield [];
                if (!availableProducts) {
                    break;
                }
            }
        }
    }

    async downloadMarketProductsAttachments(products: Product[], pictureLimit: number = 1): Promise<ExternalCommunicationAttachment<Product>[]> {
        if (!products || !products.length) {
            this.logger.log('No products to download attachments');
            return [];
        }

        this.logger.log(
            `Downloading attachments for ${this.context.market.marketPlace}`,
        );

        const skus: string[] = this.extractSkus(products)
        const productDetails: QueryResponse<ProductDetail[]> | undefined = await this.api.queryProductsDetails(skus);

        if (!productDetails || productDetails.data.length === 0) {
            return []
        }

        const result: ExternalCommunicationAttachment<Product>[] = [];
        let images: ExternalCommunicationAttachmentData[] = [];
        let manuals: ExternalCommunicationAttachmentData[] = [];
        let i: number = 0;

        for (const detail of productDetails.data) {
            const product: Product | undefined = products.find((queryProduct: Product): boolean => queryProduct.sku === detail.sku);
            if (!product) {
                // Not found
                continue;
            }

            try {
                images = await this.downloadMarketProductsImages(
                    detail,
                    pictureLimit,
                );
                manuals = await this.downloadMarketProductsManuals(detail);

                this.logger.log(
                    `Successfully downloaded ${images.length} images and ${
                        manuals.length
                    } manuals for product ${product.sku} on position ${i + 1}`,
                );

                result.push({
                    context: product,
                    data: [...images, ...manuals],
                });
                i++;
            } catch (e: any) {
                if (e && e?.message) {
                    this.logger.error(
                        `Failed to download of attachments for product ${product.sku}. Error: ${e.message}`,
                    );
                }
                result.push({
                    context: product,
                    data: [...images, ...manuals],
                });
            }
        }

        return result;
    }

    exportOrders(orderVariants: OrderVariant[]): Promise<ExternalCommunicationDataResponse<OrderVariant>[]> {
        return Promise.resolve([]);
    }

    async importGivenMarketSkus(skus: string[]): Promise<ProductCategoryBundle[]> {
        const productDetails: QueryResponse<ProductDetail[]> | undefined = await this.api.queryProductsDetails(skus);
        if (!productDetails || productDetails.data.length === 0) {
            return [];
        }

        return this.mapMarketProductsToBundles(productDetails.data);
    }

    ordersStatusValidation(orderVariants: OrderVariant[]): Promise<ExternalCommunicationDataResponse<ExternalOrderStatusDetails>[]> {
        return Promise.resolve([]);
    }

    productAvailableOnMarket(skus: string[]): Promise<LogisticsAvailability[]> {
        return Promise.resolve([]);
    }

    queryOrderLogistics(orderVariants: OrderVariant[]): Promise<ExternalCommunicationDataResponse<ExternalOrderLogisticsDetails>[]> {
        return Promise.resolve([]);
    }

    async updateProductsFromExternalMarket(products: Product[]): Promise<ExternalMarketProductUpdate[]> {
        const updates: ExternalMarketProductUpdate[] = [];
        const skus: string[] = this.extractSkus(products);

        const prices: LogisticsOverview<string>[] = await this.processProductPrice(skus);
        const inventories: LogisticsOverview<number>[] = await this.processProductInventory(skus)

        if (!prices || !inventories) {
            return [];
        }

        for (const product of products) {
            const update: ExternalMarketProductUpdate = {
                product: product,
                update: {
                    price: this.findProductLogistics<string>(product.sku, prices, '0'),
                    stock: this.findProductLogistics<number>(product.sku, inventories, 0),
                },
            };

            updates.push(update);
        }

        return updates;
    }

    validateExternalMarketInstance(): Promise<ExternalCommunicationDataResponse<MarketConfigEntryStatus> | undefined> {
        return Promise.resolve(undefined);
    }

    private findProductLogistics<T extends string | number>(sku: string, overview: LogisticsOverview<T>[], defaultValue: T) {
        const logistic: LogisticsOverview<T> | undefined = overview.find((price: LogisticsOverview<T>): boolean => price.sku === sku);
        if (!logistic) {
            return new LogisticsOverview<T>(
                sku,
                defaultValue,
                this.context.market,
            )
        }
        return logistic;
    }

    private async processProductInventory(skus: string[]): Promise<LogisticsOverview<number>[]> {
        try {
            const inventories: QueryResponse<ProductInventory[]> | undefined = await this.api.queryProductInventories(skus);

            if (!inventories || !inventories.data.length) {
                return skus.map(
                    (sku: string): LogisticsOverview<number> =>
                        new LogisticsOverview<number>(
                            sku,
                            0,
                            this.context.market,
                            true,
                        ),
                );
            }

            return inventories.data.map(
                (inventory: ProductInventory) =>
                    new LogisticsOverview<number>(
                        inventory.sku,
                        0, // TODO: check which is the most accurate stock value
                        this.context.market,
                        true // TODO: figure out when stock is not available. Maybe nextArrivalInventory again or error code B50004??
                    )
            )
        } catch (error) {
            return skus.map(
                (sku: string): LogisticsOverview<number> =>
                    new LogisticsOverview<number>(
                        sku,
                        0,
                        this.context.market,
                        true,
                    ),
            );
        }
    }


    private async processProductPrice(skus: string[]): Promise<LogisticsOverview<string>[]> {
        try {
            const prices: QueryResponse<ProductPrice[]> | undefined = await this.api.queryProductPrices(skus);

            if (!prices || prices.data.length <= 0) {
                console.log(`No price available: ${prices}`);
                return [];
            }

            return prices.data.map(
                (result: ProductPrice): LogisticsOverview<string> => {
                    if (!result || !result.price || !result.shippingFee) {
                        return new LogisticsOverview<string>(
                            undefined,
                            '0',
                            this.context.market,
                            false,
                        );
                    }
                    if (!result.skuAvailable) {
                        return new LogisticsOverview<string>(
                            result.sku,
                            '0',
                            this.context.market,
                            false,
                        );
                    }

                    if (Number(result.price) === 0) {
                        return new LogisticsOverview<string>(
                            result.sku,
                            '0',
                            this.context.market,
                            true,
                        );
                    }

                    if (Number(result.price) > 10000) {
                        return new LogisticsOverview<string>(
                            result.sku,
                            '0',
                            this.context.market,
                            false,
                        );
                    }

                    const calculatedPrice: number = result.price + result.shippingFee;

                    return new LogisticsOverview<string>(
                        result.sku,
                        String(calculatedPrice * 1.07), // TODO: research! What does this 1.07 mean?
                        this.context.market,
                        result.skuAvailable,
                    );
                },
            );
        } catch (error) {
            return skus.map(
                (sku: string): LogisticsOverview<string> =>
                    new LogisticsOverview<string>(
                        sku,
                        '0',
                        this.context.market,
                        true,
                    ),
            );
        }
    }

    private extractSkus(products: Product[]): string[] {
        if (!products || !products.length) {
            return [];
        }
        return products.map((product: Product): string => product.sku);
    }

    private async downloadMarketProductsImages(
        marketProduct: ProductDetail,
        maxImages: number,
    ): Promise<ExternalCommunicationAttachmentData[]> {
        const urls: string[] = marketProduct.imageUrls?.slice(0, maxImages) ?? [];

        if (urls.length === 0) {
            this.logger.warn(
                `No images available for product ${marketProduct.sku} on GigaB2B`,
            );
            return [];
        }

        const attachments: (ExternalCommunicationAttachmentData | undefined)[] =
            await Promise.all(
                urls.map(async (url: string, index: number) => {
                    const data: Buffer | undefined = await this.downloadAttachment(
                        url,
                        'image/jpeg',
                    );

                    if (!data) {
                        return undefined;
                    }

                    return {
                        attachment: data,
                        name: `${marketProduct.sku}-p-${index + 1}.jpg`,
                        docType: RemoteDocType.ProductImage,
                    };
                }),
            );

        return attachments.filter(
            (a): a is ExternalCommunicationAttachmentData => a !== undefined,
        );
    }

    private async downloadMarketProductsManuals(
        marketProduct: ProductDetail,
    ): Promise<ExternalCommunicationAttachmentData[]> {
        const urls: string[] = marketProduct.fileUrls ?? [];

        if (urls.length !== 1) {
            this.logger.warn(
                `No single manual available for product ${marketProduct.sku} on GigaB2B`,
            );
            return [];
        }

        const attachments: (ExternalCommunicationAttachmentData | undefined)[] =
            await Promise.all(
                urls.map(async (url: string) => {
                    const data: Buffer | undefined = await this.downloadAttachment(
                        url,
                        'application/pdf',
                    );

                    if (!data) {
                        return undefined;
                    }

                    return {
                        attachment: data,
                        name: `${marketProduct.sku}.pdf`,
                        docType: RemoteDocType.Pdf,
                    };
                }),
            );

        return attachments.filter(
            (a): a is ExternalCommunicationAttachmentData => a !== undefined,
        );
    }

    private async downloadAttachment(
        url: string,
        contentType: string,
    ): Promise<Buffer> {
        return this.httpRetry.schedule<Buffer>(async () => {
            const response = await axios.get<Buffer>(url, {
                responseType: 'arraybuffer',
                headers: {'content-type': contentType},
            });

            return response.data;
        });
    }

    private mapMarketProductsToBundles(
        marketProducts: ProductDetail[]
    ): ProductCategoryBundle[] {

        if (!marketProducts?.length) {
            return [];
        }

        const bundles: ProductCategoryBundle[] = [];

        for (const [category, productsInCategory] of this.groupByCategory(marketProducts)) {
            const productCategory: ProductCategory = new ProductCategory();
            productCategory.category = category;
            productCategory.marketId = this.context.market.id;

            const products: Product[] = productsInCategory.map((marketProduct: ProductDetail): Product =>
                this.toProduct(marketProduct),
            );

            bundles.push(new ProductCategoryBundle(productCategory, products));
        }

        this.logger.log(
            `Mapped ${marketProducts.length} products to ${bundles.length} bundles`,
        );

        return bundles;
    }

    private groupByCategory(
        marketProducts: ProductDetail[]
    ): Map<string, ProductDetail[]> {
        const byCategory: Map<string, ProductDetail[]> = new Map<string, ProductDetail[]>();
        const UNCATEGORIZED: string = 'Uncategorized';

        for (const marketProduct of marketProducts) {
            const raw: string = marketProduct.category;
            const key: string =
                typeof raw === 'string' && raw.trim() !== '' ? raw : UNCATEGORIZED;

            const bucket: ProductDetail[] = byCategory.get(key) ?? [];
            bucket.push(marketProduct);
            byCategory.set(key, bucket);
        }

        const uncategorized: ProductDetail[] | undefined = byCategory.get(UNCATEGORIZED);
        if (uncategorized) {
            this.logger.warn(
                `${uncategorized.length} products have no category and were grouped under '${UNCATEGORIZED}' ` +
                `(first SKUs: ${uncategorized.slice(0, 5).map((p) => p.sku).join(', ')})`,
            );
        }

        return byCategory;
    }


    private toProduct(marketProduct: ProductDetail): Product {
        const normalised: ProductDetail = {
            ...marketProduct,
            attributes: this.mapAttributes(marketProduct),
            weight: this.toKilograms(marketProduct.weight),
        };

        const product: Product = ProductDetail.toProduct(normalised);
        product.images = this.mapImages(marketProduct.imageUrls);

        return product;
    }

    private mapAttributes(
        marketProduct: ProductDetail,
    ): Record<string, string> {

        const ATTRIBUTE_MAPPING = {
            Materiaal: 'Main Material',
            Kleur: 'Main Color',
        } as const;

        const source = marketProduct.attributes;

        if (!source) {
            this.logger.warn(`Product ${marketProduct.sku} has no attributes`);
            return {};
        }

        const mapped: Record<string, string> = {};

        for (const [targetKey, sourceKey] of Object.entries(ATTRIBUTE_MAPPING)) {
            const value = source[sourceKey];

            if (value === undefined || value === null || value === '') {
                this.logger.warn(
                    `Product ${marketProduct.sku} is missing attribute '${sourceKey}'`,
                );
                continue;
            }

            mapped[targetKey] = value;
        }

        return mapped;
    }

    private toKilograms(weightInPounds: number | undefined): number {
        const LBS_TO_KG = 0.45359237;

        if (!weightInPounds || weightInPounds <= 0) {
            return 0;
        }

        return Number((weightInPounds * LBS_TO_KG).toFixed(2));
    }

    private mapImages(imageUrls: string[] | undefined): ProductImage[] {
        const MAX_PRODUCT_IMAGES = 10;

        if (!imageUrls?.length) {
            return [];
        }

        return imageUrls.slice(0, MAX_PRODUCT_IMAGES).map((src, index) => {
            const image: ProductImage = new ProductImage();
            image.src = src;
            image.position = index + 1;
            return image;
        });
    }
}