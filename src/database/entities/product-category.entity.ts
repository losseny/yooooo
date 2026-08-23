import {BaseEntity} from './base.entity';
import {Product} from './product.entity';
import {Market} from './market.entity';
import {CategoryStatus} from './enums';

export class ProductCategory extends BaseEntity {
    category: string;

    status: CategoryStatus;

    products: Product[];

    market: Market;

    marketId: string;
}
