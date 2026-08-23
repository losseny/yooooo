import {Product} from './product.entity';
import {BaseEntity} from './base.entity';

export class ProductVariant extends BaseEntity {
    title: string;

    handle: string;

    cost: string;

    unit_of_cost: string;

    weight: string;

    temp_inventory_quantity: number; // TODO: Remove this field

    inventory_quantity: number;

    attributes: Record<string, string>;

    product: Product;

    product_id: string;
}
