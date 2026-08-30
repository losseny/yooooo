import {Product} from "./database/entities/product.entity";
import {Market} from "./database/entities/market.entity";
import {MarketConfigEntry} from "./database/entities/market-config-entry.entity";
import {Order} from "./database/entities/order.entity";
import {LineItem} from "./database/entities/line-item.entity";
import {LogisticsOverviewAvailability, OrderVariantStatus, RemoteDocType} from "./database/entities/enums";
import {ProductCategory} from "./database/entities/product-category.entity";
import {OrderVariant} from "./database/entities/order-variant.entity";
import {OrderVariantLogistic} from "./database/entities/order-variant-logistic.entity";

export interface ExternalMarketProductUpdate {
    product: Product;
    update: Logistics;
}

export interface Logistics {
    price: LogisticsOverview<string>;
    stock: LogisticsOverview<number>;
}

export class LogisticsAvailability {
    sku: string | undefined;
    available: boolean;
    market: Market;
    availability: LogisticsOverviewAvailability

    constructor(sku: string | undefined, available: boolean, market: Market, availability: LogisticsOverviewAvailability) {
        this.sku = sku;
        this.available = available;
        this.market = market;
        this.availability = availability;
    }
}

export class LogisticsOverview<T> extends LogisticsAvailability {
    total: T;

    constructor(
        sku: string | undefined,
        total: T,
        market: Market,
        available: boolean = false,
        overviewAvailability: LogisticsOverviewAvailability = LogisticsOverviewAvailability.UNKNOWN
    ) {
        super(sku, available, market, overviewAvailability);
        this.total = total;
    }
}

export class ExternalMarketProductVerification {
    productsConfig: {
        skus: string[];
        configurations: ExternalMarketCommunicationConfig;
    };
    options: {
        import: boolean;
    };
    stop: boolean = false; // TODO: remove this when tested if available check is working

    constructor(
        skus: string[],
        configurations: ExternalMarketCommunicationConfig,
        importOption: boolean = false,
    ) {
        this.productsConfig = {
            skus,
            configurations,
        };
        this.options = {
            import: importOption,
        };
    }
}

export interface ExternalMarketCommunicationConfig {
    market: Market;
    marketConfigEntry: MarketConfigEntry;
}

export interface ExternalCommunicationAttachment<T> {
    context: T;
    data: ExternalCommunicationAttachmentData[];
}

export interface ExternalCommunicationOrder<T = unknown> {
    detail: T;
    order: Order;
    lineItems: { marketConfig: MarketConfigEntry; item: LineItem }[];
    shippingAddress: {
        email: string;
        name: string;
        phone: string;
        address1: string;
        address2: string;
        city: string;
        country: string;
        province: string;
        zip: string;
        country_code: string;
    };
}

export interface ExternalCommunicationAttachmentData {
    name: string;
    attachment: Buffer;
    docType: RemoteDocType;
}

export interface ExternalCommunicationResponse {
    success: boolean;
    msg?: string;
}

export interface ExternalCommunicationDataResponse<T>
    extends ExternalCommunicationResponse {
    data?: T;
}

export type ExternalRequestPageMeta = {
    lastUpdatedAfter?: Date;
    limit: number;
    page: number;
    total?: number;
};

export class ProductCategoryBundle {
    productCategory: ProductCategory;
    products: Product[];

    constructor(category: ProductCategory, product: Product[]) {
        this.productCategory = category;
        this.products = product;
    }
}

export interface MarketProductsOptions
    extends ExternalMarketCommunicationConfig {
    products: Product[];
}

export interface MarketProductsUpdate
    extends ExternalMarketCommunicationConfig {
    products: Product[];
    lastUpdate: boolean;
}

export interface ExternalShopCategorySynchronized {
    shopId: string;
    categoryId: string;
}

export interface ExternalShopProductDetail<T = unknown> {
    missingDetails: boolean;
    sku: string;
    productEntryDetail: T;
    market: Market;
}


export interface ExternalOrderStatusDetails {
    orderVariant: OrderVariant;
    status: OrderVariantStatus;
}

export interface ExternalOrderLogisticsDetails {
    orderVariant: OrderVariant;
    logistics: OrderVariantLogistic[];
}

export function isEmptyOrWhitespace(str: string) {
    return !str || str.trim() === '';
}
