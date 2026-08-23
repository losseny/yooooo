import {OrderVariant} from './order-variant.entity';
import {BaseEntity} from './base.entity';
import {MarketConfigEntry} from './market-config-entry.entity';
import {ProductCategory} from './product-category.entity';
import {Marketplaces} from './enums';

export class Market extends BaseEntity {
    marketPlace: Marketplaces;

    lastImportedProductsDate: Date;

    active: boolean;

    productCategories: ProductCategory[];

    marketConfigEntries: MarketConfigEntry[];

    orderVariant: OrderVariant[];
}
