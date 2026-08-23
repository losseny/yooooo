import {Order} from './order.entity';
import {BaseWithEncryptionEntity} from './base-with-encryption.entity';

export interface ShippingAddressModel {
    email: string;
    name: string;
    phone: string;
    address1: string;
    address2: string;
    city: string;
    country: string;
    province: string;
    zip: string;
    country_code: string;
}

export class CustomerShippingAdress extends BaseWithEncryptionEntity<ShippingAddressModel> {
    order_id: string;

    order: Order;
}
