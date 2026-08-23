import { BaseEntity } from './base.entity';
import { Product } from './product.entity';

export class ProductImage extends BaseEntity {
  position: number;

  src: string;

  width: string;

  height: string;

  product: Product;
}
