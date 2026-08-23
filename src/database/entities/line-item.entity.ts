import {OrderVariant} from './order-variant.entity';
import {BaseEntity} from './base.entity';

export class LineItem extends BaseEntity {
    quantity: number;

    sku: string;

    price: string;

    name: string;

    order: OrderVariant;
}
