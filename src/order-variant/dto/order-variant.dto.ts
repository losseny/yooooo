import { Expose, plainToInstance } from 'class-transformer';
import { OrderVariant } from '../../database/entities/order-variant.entity';

export class OrderVariantDto {
  @Expose()
  id: bigint;
  @Expose()
  line_items: any[];
  @Expose()
  created_at: Date;

  static fromEntity(order: OrderVariant): OrderVariantDto {
    return plainToInstance(OrderVariantDto, order, {
      enableImplicitConversion: true,
    });
  }
}
