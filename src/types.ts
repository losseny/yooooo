import {plainToInstance} from "class-transformer";
import {Product} from "./database/entities/product.entity";
import {ProductVariant} from "./database/entities/product-variant.entity";

export interface GigaApiSignature {
    signature: string;
    nonce: string;
    timestamp: string | number;
    uri: string;
    clientId: string;
}

export interface queryLogisticsBody {
    skus: string[]
}

export interface QueryProductsBody {
    lastUpdatedAfter: string;
    firstArrivalDate?: string;
    sort: number;
    page: number;
    pageSize: number;
}

export interface QueryResponse<T> {
    success: boolean;
    code: string;
    data: T;
    requestId: string;
    msg?: string;
    subMsg: string | null | undefined;
    recommend: string | null | undefined;
}

export interface QueryDataResponse<T> {
    pageInfo: PageInfo;
    records: T[];
}

export interface PageInfo {
    page: number;
    totalPage: number;
    pageSize: number;
    totalNum: number;
    end?: boolean
}

export interface ProductRecord {
    sku: string;
    productName: string;
    updateTime: string;
    firstArrivalDate: string;
    addedTime: string;
}

export class ProductDetail {
    sku: string;
    mpn: string;
    weightUnit: string;
    lengthUnit: string;
    weight: number | null;
    length: number | null;
    width: number | null;
    height: number | null;
    weightKg: number | null;
    lengthCm: number | null;
    widthCm: number | null;
    heightCm: number | null;
    productName: string;
    description: string;
    characteristics: string[];
    imageUrls: string[];
    mainImageUrl: string;
    productVideoUrl: string;
    categoryCode: number;
    category: string;
    comboFlag: boolean;
    overSizeFlag: boolean;
    isLGP: boolean;
    partFlag: boolean;
    upc: string;
    customized: string;
    placeOfOrigin: string;
    lithiumBatteryContained: string;
    assembledLength: string;
    assembledWidth: string;
    assembledHeight: string;
    assembledWeight: string;
    assembledLengthUnit: string;
    assembledWeightUnit: string;
    customList: unknown[];
    associateProductList: unknown[];
    certificationList: unknown[];
    fileUrls: string[];
    videoUrls: string[];
    afterSalesPolicy: string;
    attributes: Record<string, string>;
    whiteLabel: string;
    comboInfo: ComboInfo[];
    firstArrivalDate: string;
    returnRate: string;
    sellerInfo: SellerInfo;
    skuAvailable: boolean;
    unAvailablePlatform: string[];
    newArrivalFlag: boolean;

    static toProduct(marketProduct: ProductDetail): Product {
        const dto: Product = plainToInstance(
            Product,
            marketProduct,
            {
                excludeExtraneousValues: true,
            },
        );
        const entity: Product = dto

        const variant: ProductVariant = plainToInstance(
            ProductVariant,
            marketProduct,
            {
                excludeExtraneousValues: true,
            },
        );

        entity.variants = variant

        // TODO: think of a better way to handle this
        entity.variants.title =
            isEmptyOrWhitespace(marketProduct.description) ||
            marketProduct.weight === 0 ||
            !marketProduct.weight
                ? `[Product niet compleet] - ${marketProduct.productName}`
                : marketProduct.productName;

        return entity;
    }

}

export function isEmptyOrWhitespace(str: string) {
    return !str || str.trim() === '';
}

export interface ComboInfo {
    weight: number;
    length: number;
    width: number;
    height: number;
    weightKg: number;
    lengthCm: number;
    widthCm: number;
    heightCm: number;
    sku: string;
    qty: number;
}

export interface SellerInfo {
    sellerStore: string;
    sellerType: string;
    gigaIndex: string;
    sellerCode: string;
    sellerReturnRate: string;
    sellerReturnApprovalRate: string;
    sellerMessageResponseRate: string;
}

export interface BuyerInventoryDistribution {
    warehouseCode: string;
    buyerAvailableInventory: number;
    marginInventory: number;
    systemLockedInventory: number;
    buyerLockedInventory: number;
}

export interface BuyerInventoryInfo {
    totalBuyerAvailableInventory: number;
    totalMarginInventory: number;
    totalFutureInventory: number;
    totalSystemLockedInventory: number;
    totalBuyerLockedInventory: number;
    buyerInventoryDistribution: BuyerInventoryDistribution[];
    totalStorageFee: number | null | undefined;
    unpaidStorageFee: number | null | undefined;
    currency: string;
}

export interface SellerInventoryDistribution {
    warehouseCode: string;
    availableQtyMin: number;
    availableQtyMax: number;
}

export interface NextArrivalInventory {
    nextArrivalBegin: string | null | undefined;
    nextArrivalEnd: string | null | undefined;
    nextArrivalQtyMin: number;
    nextArrivalQtyMax: number;
}

export interface SellerInventoryInfo {
    sellerAvailableInventory: number;
    discountAvailableInventory: number;
    sellerInventoryDistribution: SellerInventoryDistribution[];
    nextArrivalInventory: NextArrivalInventory;
}

export interface ProductInventory {
    sku: string;
    buyerInventoryInfo: BuyerInventoryInfo;
    sellerInventoryInfo: SellerInventoryInfo;
}

export interface ShippingFeeRange {
    minAmount: number | null | undefined;
    maxAmount: number | null | undefined;
}

export interface InternationalFulfillmentFee {
    internationalFulfillmentFee: number | null | undefined;
    remoteIntlFulfillmentFee: number | null | undefined;
    countryName: string;
    countryCode: string;
}

export interface SpotPrice {
    minQuantity: number;
    maxQuantity: number;
    price: number | null | undefined;
    discountedSpotPrice: number | null | undefined;
    promotionFrom: string;
    promotionTo: string;
    limit: number;
}

export interface RebatesPrice {
    days: number;
    minQuantity: number;
    maxQuantity: number;
    price: number | null | undefined;
    rebateAmount: number | null | undefined;
    rebatePrice: number | null | undefined;
}

export interface MarginPrice {
    minQuantity: number;
    maxQuantity: number;
    price: number | null | undefined;
}

export interface Settlement {
    unitPrice: number | null | undefined;
    minEstimatedOceanFreight: number | null | undefined;
    maxEstimatedOceanFreight: number | null | undefined;
}

export interface FuturePrice {
    deliveryDate: string;
    totalQuantityAvailable: number;
    depositPercentage: string;
    directSettlement: Settlement;
    marginTransaction: Settlement;
}

export interface ProductPrice {
    currency: string;
    price: number | null | undefined;
    shippingFee: number | null | undefined;
    remoteShippingFee: number | null | undefined;
    shippingFeeRange: ShippingFeeRange;
    internationalFulfillmentFees: InternationalFulfillmentFee[];
    exclusivePrice: number | null | undefined;
    exclusivePriceExpireTime: string;
    discountedPrice: number | null | undefined;
    promotionFrom: string;
    promotionTo: string;
    purchaseLimit: number;
    mapPrice: number | null | undefined;
    srpPrice: number | null | undefined;
    futureMapPrice: number | null | undefined;
    effectMapTime: string;
    sellerInfo: SellerInfo;
    spotPrice: SpotPrice[];
    rebatesPrice: RebatesPrice[];
    marginPrice: MarginPrice[];
    skuAvailable: boolean;
    futurePrice: FuturePrice[];
    sku: string;
}

export enum GigaApiErrorCodes {
    B20003 = 'B20003'
}
