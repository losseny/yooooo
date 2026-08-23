import {ToEntity} from '../../infrastructure/dto/dto-to-entity.interface';
import {plainToInstance} from 'class-transformer';
import {ProductVariantDto} from './product-variant.dto';
import {ProductVariant} from '../../database/entities/product-variant.entity';

export class CreateProductVariantDto
    implements ToEntity<CreateProductVariantDto, ProductVariant> {
    constructor(args?: Partial<ProductVariantDto>) {
        Object.assign(this, args);
    }

    public toEntity(): ProductVariant {
        return plainToInstance(ProductVariant, this);
    }
}
