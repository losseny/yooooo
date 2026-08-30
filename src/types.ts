import {IsString} from "class-validator";
import {Expose, instanceToPlain, plainToInstance} from "class-transformer";
import {DateTime} from "luxon";
import {CreateProductVariantDto} from "./product-variant/dto/create-product-variant.dto";
import {Product} from "./database/entities/product.entity";
import {CreateProductDto} from "./product/dto/create-product.dto";
import {isEmptyOrWhitespace} from "./common.index";
import {OrderVariant} from "./database/entities/order-variant.entity";
import {OrderVariantLogistic} from "./database/entities/order-variant-logistic.entity";
import {OrderVariantLogisticDto} from "./order-variant/dto/order-variant-logistics.dto";

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
    subMsg: string | null;
    recommend: string | null;
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
    @Expose()
    @IsString()
    sku: string;

    @Expose()
    mpn: string;

    @Expose()
    weightUnit: string;

    @Expose()
    lengthUnit: string;

    @Expose()
    weight: number | null;

    @Expose()
    length: number | null;

    @Expose()
    width: number | null;

    @Expose()
    height: number | null;

    @Expose()
    weightKg: number | null;

    @Expose()
    lengthCm: number | null;

    @Expose()
    widthCm: number | null;

    @Expose()
    heightCm: number | null;

    @Expose()
    productName: string;

    @Expose()
    description: string;

    @Expose()
    characteristics: string[];

    @Expose()
    imageUrls: string[];

    @Expose()
    mainImageUrl: string;

    @Expose()
    productVideoUrl: string;

    @Expose()
    categoryCode: number;

    @Expose()
    category: string;

    @Expose()
    comboFlag: boolean;

    @Expose()
    overSizeFlag: boolean;

    @Expose()
    isLGP: boolean;

    @Expose()
    partFlag: boolean;

    @Expose()
    upc: string;

    @Expose()
    customized: string;

    @Expose()
    placeOfOrigin: string;

    @Expose()
    lithiumBatteryContained: string;

    @Expose()
    assembledLength: string;

    @Expose()
    assembledWidth: string;

    @Expose()
    assembledHeight: string;

    @Expose()
    assembledWeight: string;

    @Expose()
    assembledLengthUnit: string;

    @Expose()
    assembledWeightUnit: string;

    @Expose()
    customList: unknown[];

    @Expose()
    associateProductList: unknown[];

    @Expose()
    certificationList: unknown[];

    @Expose()
    fileUrls: string[];

    @Expose()
    videoUrls: string[];

    @Expose()
    afterSalesPolicy: string;

    @Expose()
    attributes: Record<string, string>;

    @Expose()
    whiteLabel: string;

    @Expose()
    comboInfo: ComboInfo[];

    @Expose()
    firstArrivalDate: string;

    @Expose()
    returnRate: string;

    @Expose()
    sellerInfo: SellerInfo;

    @Expose()
    skuAvailable: boolean;

    @Expose()
    unAvailablePlatform: string[];

    @Expose()
    newArrivalFlag: boolean;

    static toProduct(marketProduct: ProductDetail): Product {
        const dto: CreateProductDto = plainToInstance(
            CreateProductDto,
            instanceToPlain(marketProduct),
            {
                excludeExtraneousValues: true,
            },
        );
        const entity: Product = dto.toEntity();

        const variant: CreateProductVariantDto = plainToInstance(
            CreateProductVariantDto,
            instanceToPlain(marketProduct),
            {
                excludeExtraneousValues: true,
            },
        );

        entity.variants = variant.toEntity();

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
    totalStorageFee: number | null;
    unpaidStorageFee: number | null;
    currency: string;
}

export interface SellerInventoryDistribution {
    warehouseCode: string;
    availableQtyMin: number;
    availableQtyMax: number;
}

export interface NextArrivalInventory {
    nextArrivalBegin: string | null;
    nextArrivalEnd: string | null;
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
    minAmount: number | null;
    maxAmount: number | null;
}

export interface InternationalFulfillmentFee {
    internationalFulfillmentFee: number | null;
    remoteIntlFulfillmentFee: number | null;
    countryName: string;
    countryCode: string;
}

export interface SpotPrice {
    minQuantity: number;
    maxQuantity: number;
    price: number | null;
    discountedSpotPrice: number | null;
    promotionFrom: string;
    promotionTo: string;
    limit: number;
}

export interface RebatesPrice {
    days: number;
    minQuantity: number;
    maxQuantity: number;
    price: number | null;
    rebateAmount: number | null;
    rebatePrice: number | null;
}

export interface MarginPrice {
    minQuantity: number;
    maxQuantity: number;
    price: number | null;
}

export interface Settlement {
    unitPrice: number | null;
    minEstimatedOceanFreight: number | null;
    maxEstimatedOceanFreight: number | null;
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
    price: number | null;
    shippingFee: number | null;
    remoteShippingFee: number | null;
    shippingFeeRange: ShippingFeeRange;
    internationalFulfillmentFees: InternationalFulfillmentFee[];
    exclusivePrice: number | null;
    exclusivePriceExpireTime: string;
    discountedPrice: number | null;
    promotionFrom: string;
    promotionTo: string;
    purchaseLimit: number;
    mapPrice: number | null;
    srpPrice: number | null;
    futureMapPrice: number | null;
    effectMapTime: string;
    sellerInfo: SellerInfo;
    spotPrice: SpotPrice[];
    rebatesPrice: RebatesPrice[];
    marginPrice: MarginPrice[];
    skuAvailable: boolean;
    futurePrice: FuturePrice[];
    sku: string;
}

export interface ShipFromInfo {
    country: string;
    warehouseCode: string;
    warehouseArea: string;
}

export interface ShipTrackInfo {
    sku: string;
    skuQty: number;
    isCombo: boolean;
    comboSku: string;
    trackingNum: string;
    carrierName: string;
    shipFromInfo: ShipFromInfo;
}

export interface ReturnTrackInfo {
    sku: string;
    skuQty: number;
    isCombo: boolean;
    comboSku: string;
    returnTrackingNumber: string;
    returnShipMethod: string;
    returnTrackStatus: number;
}

export interface OrderTrackInfo {
    orderNo: string;
    shipTrackInfo: ShipTrackInfo[];
    returnTrackInfo: ReturnTrackInfo[];
}

export interface OrderStatusInfo {
    orderNo: string;
    orderStatus: string;
    canCancel: string;
}

export interface OrderLine {
    itemPrice: number;
    qty: number;
    sku: string;
    productName: string;
    ebayItemCode: string;
    amazonOrderItemId: string;
    itemTax: string;
    currencyCode: string;
    itemUnitDiscount: string;
    brandLabelName: string;
    numberOfLabels: string;
}

export interface ValueAddedServices {
    returnLabelService: boolean;
    deliveryService: string;
}

export interface OrderInfo {
    orderDate: string;
    orderNo: string;
    shipName: string;
    shipPhone: string;
    shipEmail: string;
    shipAddress1: string;
    shipAddress2: string;
    shipCity: string;
    shipCountry: string;
    shipState: string;
    shipZipCode: string;
    hasOtherLabel: string;
    shippedDate: string;
    orderFrom: string;
    salesChannel: string;
    ebayTransactionID: string;
    orderLines: OrderLine[];
    orderTotal: string;
    sellManager: string;
    shipCompany: string;
    customerComments: string;
    valueAddedServices: ValueAddedServices;
}

export function toOrderVariantLogisticEntity(trackInfo: ShipTrackInfo): OrderVariantLogistic {
    const dto: OrderVariantLogisticDto = plainToInstance<OrderVariantLogisticDto, ShipTrackInfo>(
        OrderVariantLogisticDto,
        trackInfo,
        {
            excludeExtraneousValues: true,
        },
    );

    dto.trackingNumber = trackInfo.trackingNum;
    dto.carrierName = trackInfo.carrierName;

    return dto.toEntity();
}


export class ShipmentOrder {
    constructor(private _orderVariant: OrderVariant) {
    }

    @Expose({name: 'orderDate'})
    get orderDate(): string {
        return DateTime
            .fromJSDate(this._orderVariant.created_at)
            .toFormat("yyyy-MM-dd HH:mm:ss");
    }

    @Expose({name: 'orderNo'})
    get orderNo(): string {
        return this._orderVariant.order.order_number;
    }

    @Expose({name: 'shipName'})
    get shipName(): string {
        return (
            this._orderVariant.order.customerShippingAdress?.data.name ?? ''
        );
    }

    @Expose({name: 'shipPhone'})
    get shipPhone(): string {
        return (
            this._orderVariant.order.customerShippingAdress?.data.phone ?? ''
        );
    }

    @Expose({name: 'shipEmail'})
    get shipEmail(): string {
        return (
            this._orderVariant.order.customerShippingAdress?.data.email ?? ''
        );
    }

    @Expose({name: 'shipAddress1'})
    get shipAddress1(): string {
        return (
            this._orderVariant.order.customerShippingAdress?.data.address1 ?? ''
        );
    }

    @Expose({name: 'shipAddress2'})
    get shipAddress2(): string {
        return (
            this._orderVariant.order.customerShippingAdress?.data.address2 ?? ''
        );
    }

    @Expose({name: 'shipCity'})
    get shipCity(): string {
        return (
            this._orderVariant.order.customerShippingAdress?.data.city ?? ''
        );
    }

    @Expose({name: 'shipCountry'})
    get shipCountry(): string {
        return (
            this._orderVariant.order.customerShippingAdress?.data.country_code ?? ''
        );
    }

    @Expose({name: 'shipState'})
    get shipState(): string {
        return (
            this._orderVariant.order.customerShippingAdress?.data.province ?? ''
        );
    }

    @Expose({name: 'shipZipCode'})
    get shipZipCode(): string {
        return (
            this._orderVariant.order.customerShippingAdress?.data.zip ?? ''
        );
    }

    @Expose({name: 'orderLines'})
    get orderLines(): OrderLine[] {
        return this._orderVariant.line_items.map((item) => ({
            itemPrice: Number(item.price),
            qty: item.quantity,
            sku: item.sku,
            productName: item.name,

            ebayItemCode: '',
            amazonOrderItemId: '',
            itemTax: '',
            currencyCode: '',
            itemUnitDiscount: '',
            brandLabelName: '',
            numberOfLabels: '',
        }));
    }

    @Expose({name: 'hasOtherLabel'})
    get hasOtherLabel(): string {
        return '';
    }

    @Expose({name: 'shippedDate'})
    get shippedDate(): string {
        return '';
    }

    @Expose({name: 'orderFrom'})
    get orderFrom(): string {
        return '';
    }

    @Expose({name: 'salesChannel'})
    get salesChannel(): string {
        return '';
    }

    @Expose({name: 'ebayTransactionID'})
    get ebayTransactionID(): string {
        return '';
    }

    @Expose({name: 'orderTotal'})
    get orderTotal(): string {
        return '';
    }

    @Expose({name: 'sellManager'})
    get sellManager(): string {
        return '';
    }

    @Expose({name: 'shipCompany'})
    get shipCompany(): string {
        return '';
    }

    @Expose({name: 'customerComments'})
    get customerComments(): string {
        return '';
    }

    @Expose({name: 'valueAddedServices'})
    get valueAddedServices(): ValueAddedServices {
        return {
            returnLabelService: false,
            deliveryService: '',
        };
    }

    toPlain(): OrderInfo {
        return instanceToPlain(this, {
            excludePrefixes: ['_'],
        }) as OrderInfo;
    }
}

export enum GigaApiErrorCodes {
    B20003 = 'B20003'
}


