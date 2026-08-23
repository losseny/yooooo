import {ProductVariantDto} from '../../product-variant/dto/product-variant.dto';

export class ProductDto {
    id: string;

    sku: string;

    category: string;

    description: string;

    variants: ProductVariantDto;
}
