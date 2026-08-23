import {Expose, Type} from 'class-transformer';
import {IsNotEmpty} from 'class-validator';
import {ProductVariantDto} from '../../product-variant/dto/product-variant.dto';

export class ProductDto {
    @Expose()
    id: string;

    @Expose()
    @IsNotEmpty()
    sku: string;

    @Expose()
    @IsNotEmpty()
    category: string;

    @IsNotEmpty()
    @Expose()
    description: string;

    @Expose()
    @Type(() => ProductVariantDto)
    variants: ProductVariantDto;
}
