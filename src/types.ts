export interface GigaApiSignature {
    signature: string;
    nonce: string;
    timestamp: string | number;
    uri: string;
    clientId: string;
}

export interface QueryProductsBody {
    lastUpdatedAfter: string;
    firstArrivalDate: string;
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
}

export interface ProductRecord {
    sku: string;
    productName: string;
    updateTime: string;
    firstArrivalDate: string;
    addedTime: string;
}

export interface ProductDetails {
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