import { Expose } from 'class-transformer';
import { OrderVariantLogistic } from '../../database/entities/order-variant-logistic.entity';

export class OrderVariantLogisticDto {
  @Expose()
  carrierName: string;
  @Expose()
  trackingNumber: string;

  toEntity(): OrderVariantLogistic {
    const orderVariantLogistic: OrderVariantLogistic =
      new OrderVariantLogistic();
    orderVariantLogistic.carrierName = this.carrierName;
    orderVariantLogistic.trackingNumber = this.trackingNumber;
    return orderVariantLogistic;
  }
}
