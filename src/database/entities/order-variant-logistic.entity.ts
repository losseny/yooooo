import { BaseEntity } from './base.entity';
import { OrderVariant } from './order-variant.entity';

export class OrderVariantLogistic extends BaseEntity {
  carrierName: string;

  trackingNumber: string;

  order_variant_id: string;

  orderVariant: OrderVariant;
}
