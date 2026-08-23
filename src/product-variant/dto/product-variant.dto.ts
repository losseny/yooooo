import {Expose} from 'class-transformer';

export class ProductVariantDto {
    @Expose()
    id: string;
    @Expose()
    title: string;
    @Expose()
    weight: string;
    @Expose()
    inventory_quantity: number = 0;
    @Expose()
    attributes: Record<string, string>;
}
