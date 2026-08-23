export class ProductVariantDto {
    id: string;
    title: string;
    weight: string;
    inventory_quantity: number = 0;
    attributes: Record<string, string>;
}
