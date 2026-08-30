import {GigaApi} from "./giga-b2b.api";
import {
    GigaApiErrorCodes,
    OrderStatusInfo,
    OrderTrackInfo,
    ProductDetail,
    ProductInventory,
    ProductPrice,
    ProductRecord,
    QueryDataResponse,
    QueryResponse,
    ShipmentOrder,
    ShipTrackInfo,
    toOrderVariantLogisticEntity
} from "./types";
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
import {
    LogisticsOverviewAvailability,
    MarketConfigEntryStatus,
    OrderVariantStatus,
    RemoteDocType
} from "./database/entities/enums";
import axios from "axios";
import {ProductCategory} from "./database/entities/product-category.entity";
import {ProductImage} from "./database/entities/product-image.entity";
import {OrderVariantLogistic} from "./database/entities/order-variant-logistic.entity";

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
        const marketPlace: string = this.context.market.marketPlace;
        let availableProducts: QueryResponse<QueryDataResponse<ProductRecord>> | undefined = undefined;
        let page: number = 0;

        this.logger.log(`Starting product import for market ${marketPlace}`);

        while (true) {
            try {
                availableProducts = await this.api.queryProducts(availableProducts?.data.pageInfo);
                page++;

                if (!availableProducts) {
                    this.logger.warn(`No product data returned for page ${page}; stopping import for market ${marketPlace}`);
                    yield [];
                    break;
                }

                const records: ProductRecord[] = availableProducts.data.records ?? [];
                this.logger.log(`Fetched page ${page} with ${records.length} product records from market ${marketPlace}`);

                const productDetails: QueryResponse<ProductDetail[]> | undefined = await this.api.queryProductsDetails(records.slice(0, 3));
                if (!productDetails) {
                    this.logger.warn(`No product details returned for page ${page} on market ${marketPlace}`);
                    yield [];
                } else {
                    this.logger.log(`Fetched details for ${productDetails.data?.length ?? 0} products on page ${page} of market ${marketPlace}`);
                    yield this.mapMarketProductsToBundles(productDetails.data);
                }

                if (availableProducts.data.pageInfo.end) {
                    this.logger.log(`Reached last page (${page}) for market ${marketPlace}; import complete`);
                    break;
                }

            } catch (e) {
                this.logger.error(`Failed to import products on page ${page} for market ${marketPlace}: ${this.formatError(e)}`);
                yield [];
                if (!availableProducts) {
                    break;
                }
            }
        }

        this.logger.log(`Product import finished for market ${marketPlace} after ${page} page(s)`);
    }

    async downloadMarketProductsAttachments(products: Product[], pictureLimit: number = 1): Promise<ExternalCommunicationAttachment<Product>[]> {
        if (!products || !products.length) {
            this.logger.log('No products to download attachments');
            return [];
        }

        this.logger.log(
            `Downloading attachments for ${products.length} product(s) on market ${this.context.market.marketPlace}`,
        );

        const skus: string[] = this.extractSkus(products)
        const productDetails: QueryResponse<ProductDetail[]> | undefined = await this.api.queryProductsDetails(skus);

        if (!productDetails || productDetails.data.length === 0) {
            this.logger.warn('No product details returned; no attachments downloaded');
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
            } catch (e) {
                this.logger.error(
                    `Failed to download attachments for product ${product.sku}: ${this.formatError(e)}`,
                );
                result.push({
                    context: product,
                    data: [...images, ...manuals],
                });
            }
        }

        this.logger.log(
            `Downloaded attachments for ${result.length} product(s) on market ${this.context.market.marketPlace}`,
        );

        return result;
    }


    async importGivenMarketSkus(skus: string[]): Promise<ProductCategoryBundle[]> {
        this.logger.log(`Importing ${skus.length} specific SKUs from market ${this.context.market.marketPlace}`);

        // TODO: Maybe pagination??
        const result: ProductCategoryBundle[] = [];
        const totalPages: number = skus.length / 200;
        let page: number = 1;

        while (page < totalPages) {
            const productDetails: QueryResponse<ProductDetail[]> | undefined = await this.api.queryProductsDetails(skus);
            if (!productDetails || productDetails.data.length === 0) {
                this.logger.warn(`No product details returned for the ${skus.length} requested SKUs`);
                return [];
            }

            this.logger.log(`Mapped ${productDetails.data.length} product(s) for the requested SKUs (page ${page}/${Math.ceil(totalPages)})`);
            result.push(...this.mapMarketProductsToBundles(productDetails.data))
            page++;
        }

        this.logger.log(`Imported ${result.length} bundle(s) for ${skus.length} requested SKU(s)`);
        return result;
    }

    async updateProductsFromExternalMarket(products: Product[]): Promise<ExternalMarketProductUpdate[]> {
        const updates: ExternalMarketProductUpdate[] = [];
        const skus: string[] = this.extractSkus(products);

        this.logger.log(`Updating ${skus.length} product(s) from market ${this.context.market.marketPlace}`);

        const prices: LogisticsOverview<string>[] = await this.processProductPrice(skus);
        const inventories: LogisticsOverview<number>[] = await this.processProductInventory(skus)


        if (!prices || !inventories) {
            this.logger.warn('No price or inventory data available; aborting product update');
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

        this.logger.log(`Computed ${updates.length} product update(s) from market ${this.context.market.marketPlace}`);
        return updates;
    }

    async validateExternalMarketInstance(): Promise<ExternalCommunicationDataResponse<MarketConfigEntryStatus>> {
        this.logger.log(`Validating market instance for ${this.context.market.marketPlace}`);

        const result: ExternalCommunicationDataResponse<MarketConfigEntryStatus> = await this.api.validateMarketInstance();

        this.logger.log(
            `Market instance validation for ${this.context.market.marketPlace}: ` +
            `${result.success ? 'valid' : 'invalid'} (${result.data})`,
        );

        return result;
    }

    async productAvailableOnMarket(skus: string[]): Promise<LogisticsAvailability[]> {
        this.logger.log(`Checking availability for ${skus.length} SKU(s) on market ${this.context.market.marketPlace}`);

        try {
            let availability: LogisticsAvailability[] = [];
            const details: QueryResponse<ProductDetail[]> | undefined = await this.api.queryProductsDetails(skus)
            if (!details || !details.data.length) {
                this.logger.warn('No product details returned; falling back to price lookup');

                const prices: QueryResponse<ProductPrice[]> = await this.api.queryProductPrices(skus);
                if (!prices || !prices.success || prices.code === GigaApiErrorCodes.B20003) {
                    this.logger.warn(`Availability could not be determined for ${skus.length} SKU(s); marking UNKNOWN`);
                    return skus.map(
                        (sku: string): LogisticsAvailability =>
                            new LogisticsAvailability(
                                sku,
                                false,
                                this.context.market,
                                LogisticsOverviewAvailability.UNKNOWN
                            )
                    )
                }
            }

            availability = details.data.map(
                (detail: ProductDetail): LogisticsAvailability =>
                    new LogisticsAvailability(
                        detail.sku,
                        detail.skuAvailable,
                        this.context.market,
                        detail.skuAvailable ? LogisticsOverviewAvailability.AVAILABLE : LogisticsOverviewAvailability.UNAVAILABLE
                    )
            )

            this.logger.log(`Determined availability for ${availability.length} product(s) on market ${this.context.market.marketPlace}`);
            return availability;
        } catch (e) {
            this.logger.error(`Failed to determine availability: ${this.formatError(e)}`);
            return skus.map(
                (sku: string) =>
                    new LogisticsAvailability(
                        sku,
                        false,
                        this.context.market,
                        LogisticsOverviewAvailability.UNKNOWN
                    )
            )
        }
    }


    async exportOrders(orderVariants: OrderVariant[]): Promise<ExternalCommunicationDataResponse<OrderVariant>[]> {
        const results: ExternalCommunicationDataResponse<OrderVariant>[] = [];

        this.logger.log(`Exporting ${orderVariants.length} order variant(s) to market ${this.context.market.marketPlace}`);

        for (const orderVariant of orderVariants) {
            try {
                const shipmentOrder: ShipmentOrder = new ShipmentOrder(orderVariant);

                let response: QueryResponse<void> = await this.api.exportShipmentOrder(shipmentOrder,);

                const result: ExternalCommunicationDataResponse<OrderVariant> =
                    this.processOrderSyncResponse(response, orderVariant);
                results.push(result);

                this.logger.log(
                    `Exported order variant ${orderVariant.id}: ${result.success ? 'success' : 'failed'} (${result.msg})`,
                );
            } catch (e) {
                this.logger.error(
                    `Failed to export order variant ${orderVariant.id}: ${this.formatError(e)}`,
                );
                results.push({
                    success: false,
                    data: orderVariant,
                    msg: this.formatError(e),
                });
            }
        }

        this.logger.log(`Exported ${results.length} order variant(s) to market ${this.context.market.marketPlace}`);
        return results;
    }


    async ordersStatusValidation(orderVariants: OrderVariant[]): Promise<ExternalCommunicationDataResponse<ExternalOrderStatusDetails>[]> {
        this.logger.log(`Validating status for ${orderVariants.length} order variant(s) on market ${this.context.market.marketPlace}`);

        try {
            const results: ExternalCommunicationDataResponse<ExternalOrderStatusDetails>[] = [];

            const statuses: QueryResponse<OrderStatusInfo[]> | undefined = await this.api.queryOrderStatus(orderVariants.map((orderVariant: OrderVariant): string => orderVariant.order.order_number));

            if (!statuses || statuses.data.length === 0) {
                this.logger.warn('No order status data returned; no statuses validated');
                return []
            }
            for (const status of statuses.data) {
                try {
                    const orderVariant: OrderVariant = orderVariants.find((variant: OrderVariant): boolean => variant.order.order_number === status.orderNo);
                    if (!orderVariant) {
                        this.logger.warn(`No matching order variant found for order number ${status.orderNo}`);
                        continue
                    }

                    let orderStatusNumber: number = Number(status.orderStatus);

                    switch (orderStatusNumber) {
                        case 1: {
                            const orderStatusDetails: ExternalOrderStatusDetails = {
                                orderVariant: orderVariant,
                                status: OrderVariantStatus.Synchronized,
                            };
                            results.push({
                                success: true,
                                data: orderStatusDetails,
                                msg: OrderVariantStatus.Synchronized,
                            });
                            break;
                        }
                        case 2: {
                            const orderStatusDetails: ExternalOrderStatusDetails = {
                                orderVariant: orderVariant,
                                status: OrderVariantStatus.Being_Processed,
                            };
                            results.push({
                                success: true,
                                data: orderStatusDetails,
                                msg: OrderVariantStatus.Being_Processed,
                            });
                            break;
                        }
                        case 32: {
                            const orderStatusDetails: ExternalOrderStatusDetails = {
                                orderVariant: orderVariant,
                                status: OrderVariantStatus.Complete,
                            };
                            results.push({
                                success: true,
                                data: orderStatusDetails,
                                msg: OrderVariantStatus.Complete,
                            });
                            break;
                        }
                        case 16: {
                            const orderStatusDetails: ExternalOrderStatusDetails = {
                                orderVariant: orderVariant,
                                status: OrderVariantStatus.Cancelled,
                            };
                            results.push({
                                success: true,
                                data: orderStatusDetails,
                                msg: OrderVariantStatus.Cancelled,
                            });
                            break;
                        }
                        case 4: {
                            const orderStatusDetails: ExternalOrderStatusDetails = {
                                orderVariant: orderVariant,
                                status: OrderVariantStatus.On_hold,
                            };
                            results.push({
                                success: true,
                                data: orderStatusDetails,
                                msg: OrderVariantStatus.On_hold,
                            });
                            break;
                        }
                        default: {
                            const orderStatusDetails: ExternalOrderStatusDetails = {
                                orderVariant: orderVariant,
                                status: OrderVariantStatus.Unknown,
                            };
                            results.push({
                                success: true,
                                data: orderStatusDetails,
                                msg: OrderVariantStatus.Unknown,
                            });
                            break;
                        }
                    }
                } catch (error) {
                    this.logger.error(`Failed to validate status for order ${status.orderNo}: ${this.formatError(error)}`);
                }
            }
            this.logger.log(`Validated status for ${results.length} order variant(s)`);
            return results;
        } catch (e) {
            this.logger.error(`Failed to query order statuses: ${this.formatError(e)}`);
            return []
        }
    }

    async queryOrderLogistics(orderVariants: OrderVariant[]): Promise<ExternalCommunicationDataResponse<ExternalOrderLogisticsDetails>[]> {
        this.logger.log(`Querying logistics for ${orderVariants.length} order variant(s) on market ${this.context.market.marketPlace}`);

        try {
            const results: ExternalCommunicationDataResponse<ExternalOrderLogisticsDetails>[] = [];

            const orderTrackers: QueryResponse<OrderTrackInfo[]> | undefined = await this.api.queryOrderLogistics(orderVariants.map((orderVariant: OrderVariant): string => orderVariant.order.order_number));
            if (!orderTrackers || orderTrackers.data.length === 0) {
                this.logger.warn('No order tracking data returned; no logistics queried');
                return []
            }

            for (const tracker of orderTrackers.data) {
                try {
                    const orderVariant: OrderVariant = orderVariants.find((variant: OrderVariant): boolean => variant.order.order_number === tracker.orderNo);

                    if (!orderVariant) {
                        this.logger.warn(`No matching order variant found for order number ${tracker.orderNo}`);
                        continue
                    }

                    results.push({
                        success: true,
                        data: {
                            orderVariant: orderVariant,
                            logistics: tracker.shipTrackInfo
                                .map(
                                    (trackInfo: ShipTrackInfo): OrderVariantLogistic =>
                                        toOrderVariantLogisticEntity(trackInfo)
                                )
                        },
                        msg: orderTrackers.msg ?? 'Logistics queried successfully',
                    });
                } catch (e) {
                    this.logger.error(`Failed to query logistics for order ${tracker.orderNo}: ${this.formatError(e)}`);
                }
            }

            this.logger.log(`Queried logistics for ${results.length} order variant(s)`);
            return results;
        } catch (error) {
            this.logger.error(`Failed to query order logistics: ${this.formatError(error)}`);
            return []
        }
    }

    private processOrderSyncResponse(
        response: QueryResponse<void>,
        orderVariant: OrderVariant,
    ): ExternalCommunicationDataResponse<OrderVariant> {
        if (response.success) {
            const msg: string = response?.msg
                ? `${response?.msg}: ${response.subMsg}`
                : 'Order exported successfully';

            this.logger.log(`Order variant ${orderVariant.id} exported successfully: ${msg}`);

            return {
                success: true,
                data: orderVariant,
                msg,
            };
        }

        const msg: string = response?.msg
            ? `${response?.msg}: ${response.subMsg}`
            : `Unknown error while exporting order variant: ${orderVariant.id}`;

        this.logger.warn(`Failed to export order variant ${orderVariant.id}: ${msg}`);

        return {
            success: false,
            data: orderVariant,
            msg,
        };
    }

    private findProductLogistics<T extends string | number>(sku: string, overview: LogisticsOverview<T>[], defaultValue: T) {
        const logistic: LogisticsOverview<T> | undefined = overview.find((price: LogisticsOverview<T>): boolean => price.sku === sku);
        if (!logistic) {
            this.logger.warn(`No logistics data found for SKU ${sku}; using default value '${defaultValue}'`);
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
                this.logger.warn(`No inventory data returned for ${skus.length} SKU(s)`);
                return skus.map(
                    (sku: string): LogisticsOverview<number> =>
                        new LogisticsOverview<number>(
                            sku,
                            0,
                            this.context.market,
                            true,
                            LogisticsOverviewAvailability.AVAILABLE
                        ),
                );
            }

            return inventories.data.map(
                (inventory: ProductInventory) =>
                    new LogisticsOverview<number>(
                        inventory.sku,
                        inventory.sellerInventoryInfo.sellerAvailableInventory,
                        this.context.market,
                        true, // TODO: figure out when stock is not available. Maybe nextArrivalInventory again or error code B50004??
                        LogisticsOverviewAvailability.AVAILABLE
                    )
            )
        } catch (error) {
            this.logger.error(`Failed to query product inventory: ${this.formatError(error)}`);
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
                this.logger.warn(`No price available for ${skus.length} SKU(s)`);
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
                            LogisticsOverviewAvailability.UNAVAILABLE
                        );
                    }
                    if (!result.skuAvailable) {
                        return new LogisticsOverview<string>(
                            result.sku,
                            '0',
                            this.context.market,
                            false,
                            LogisticsOverviewAvailability.UNAVAILABLE
                        );
                    }

                    if (Number(result.price) === 0) {
                        if (result.skuAvailable) {
                            return new LogisticsOverview<string>(
                                result.sku,
                                '0',
                                this.context.market,
                                result.skuAvailable,
                                LogisticsOverviewAvailability.AVAILABLE
                            );
                        }
                        return new LogisticsOverview<string>(
                            result.sku,
                            '0',
                            this.context.market,
                            false,
                            LogisticsOverviewAvailability.UNAVAILABLE
                        );
                    }

                    if (Number(result.price) > 10000) {
                        return new LogisticsOverview<string>(
                            result.sku,
                            '0',
                            this.context.market,
                            false,
                            LogisticsOverviewAvailability.UNAVAILABLE
                        );
                    }

                    const calculatedPrice: number = result.price + result.shippingFee;

                    return new LogisticsOverview<string>(
                        result.sku,
                        (calculatedPrice * 1.07).toFixed(2), // TODO: research! What does this 1.07 mean?
                        this.context.market,
                        result.skuAvailable,
                        result.skuAvailable ? LogisticsOverviewAvailability.AVAILABLE : LogisticsOverviewAvailability.UNAVAILABLE
                    );
                },
            );
        } catch (error) {
            this.logger.error(`Failed to query product price: ${this.formatError(error)}`);
            return skus.map(
                (sku: string): LogisticsOverview<string> =>
                    new LogisticsOverview<string>(
                        sku,
                        '0',
                        this.context.market,
                        false,
                    ),
            );
        }
    }

    private formatError(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
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
            (attachment): attachment is ExternalCommunicationAttachmentData => attachment !== undefined,
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