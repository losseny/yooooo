import {OrderVariant} from './order-variant.entity';
import {BaseEntity} from './base.entity';
import {OrderStatus, ProductPublishers} from './enums';
import {CustomerShippingAdress} from './customer-shipping-address.entity';

export class Order extends BaseEntity {
    email: string; // TODO: Remove field

    cancelled_at: Date;

    hasAllRequiredInfo: boolean;

    orderStatus: OrderStatus;

    order_number: string;

    publisher: ProductPublishers;

    customerShippingAdress: CustomerShippingAdress;

    orderVariants: OrderVariant[];
}
