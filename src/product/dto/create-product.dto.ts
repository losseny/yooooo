import {ToEntity} from '../../infrastructure/dto/dto-to-entity.interface';
import {ProductDto} from './product.dto';
import {Product} from '../../database/entities/product.entity';
import {plainToClass} from 'class-transformer';

export class CreateProductDto extends ProductDto
    implements ToEntity<CreateProductDto, Product> {
    constructor(args?: Partial<ProductDto>) {
        super();
        Object.assign(this, args);
    }

    public toEntity(): Product {
        return plainToClass(Product, this);
    }
}
