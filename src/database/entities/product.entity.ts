import {ProductVariant} from './product-variant.entity';
import {BaseEntity} from './base.entity';
import {ProductImage} from './product-image.entity';
import {ProductCategory} from './product-category.entity';
import {ProductState, RemoteDocProtocol} from './enums';

export class Product extends BaseEntity {
    sku: string;

    description: string;

    productState: ProductState;

    files: { name: string; url: string }[];

    images: ProductImage[];

    category: string;

    productCategory: ProductCategory;

    productCategoryId: string;

    variants: ProductVariant;

    externalStorageId: string;

    externalStorageType: RemoteDocProtocol;
}
