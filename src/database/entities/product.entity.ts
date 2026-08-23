import {ProductVariant} from './product-variant.entity';
import {BaseEntity} from './base.entity';
import {ProductImage} from './product-image.entity';
import {ProductCategory} from './product-category.entity';
import {ProductState, RemoteDocProtocol} from './enums';
import {Expose} from "class-transformer";

export class Product extends BaseEntity {
    @Expose()
    sku: string;

    @Expose()
    description: string;

    productState: ProductState;

    files: { name: string; url: string }[];

    images: ProductImage[];

    @Expose()
    category: string;

    productCategory: ProductCategory;

    productCategoryId: string;

    variants: ProductVariant;

    externalStorageId: string;

    externalStorageType: RemoteDocProtocol;
}
