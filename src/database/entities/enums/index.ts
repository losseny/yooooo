export enum UserRole {
    Generic = 'generic',
    Director = 'director',
    Admin = 'admin',
}

export enum RemoteDocProtocol {
    Local = 'local',
    Minio = 'minio',
}

export enum ExternalPlatforms {
    Shopify = 'shopify',
}

export enum ExternalDetailEntryStatus {
    Active = 'active',
    Inactive = 'inactive',
    PendingSynchronization = 'pending-synchronization',
    Pending = 'pending',
}

export enum OrderStatus {
    Fulfilled = 'fulfilled',
    Complete = 'complete',
    Cancelled = 'cancelled',
    Pending = 'pending',
    Unknown = 'unknown',
    Failed = 'failed',
}

export enum OrderVariantStatus {
    Complete = `Complete`,
    Being_Processed = `Being_Processed`,
    Being_Fulfilled = `Being_Fulfilled`,
    Synchronized = `Synchronized`,
    On_hold = `On_hold`,
    Cancelled = `Cancelled`,
    Failed = `Failed`,
    Unknown = `Unknown`,
}

export enum MarketConfigEntryStatus {
    Valid = 'valid',
    Invalid = 'invalid',
    PendingValidation = 'pending-validation',
}

export enum ExternalAccountState {
    Valid = 'valid',
    Invalid = 'invalid',
    Locked = 'locked',
}

export enum CategoryStatus {
    unknown,
    active,
    inactive,
}

export enum RemoteDocType {
    Pdf = 'pdf',
    ProductImage = 'productImage',
}

export enum Marketplaces {
    GigaB2b = 'GigaB2b',
}

export enum ExternalProductEntryStatus {
    /** Product is newly created and in draft state. */
    Draft = 'draft',
    /** Product is active and ready for synchronization to external platforms. */
    Active = 'active',
    /** Product is synchronized to external platforms, but details are not yet provided to the external platform. */
    PendingSynchronization = 'pendingSynchronization',
    /** Product has been successfully synchronized to external platforms. */
    Synchronized = 'synchronized',
    /** Product got deleted from external platform */
    Deleted = 'deleted',
}

export enum ProductState {
    /** Product is newly created and in draft state. */
    Draft = 'draft',
    /** Product is active and ready for synchronization to external platforms. */
    Active = 'active',
    Archived = 'archived',
}

export enum ProductPublishers {
    Bol = 'bol',
    Amazon = 'amazon',
    LocalDevelopment = 'local-development',
}

export class MarketPlaceUtil {
    static collectMarketplaces(): Marketplaces[] {
        return Object.values(Marketplaces).filter(
            (value: Marketplaces) =>
                typeof value === 'number' || typeof value === 'string',
        ) as Marketplaces[];
    }
}

export enum LogisticsOverviewAvailability {
    AVAILABLE = 'AVAILABLE',
    UNAVAILABLE = 'UNAVAILABLE',
    UNKNOWN = 'UNKNOWN',
}