import { LineItem } from './line-item.entity';
import { Order } from './order.entity';
import { Market } from './market.entity';
import { BaseEntity } from './base.entity';
import { OrderVariantLogistic } from './order-variant-logistic.entity';
import { OrderVariantStatus } from './enums';
import { MarketConfigEntry } from './market-config-entry.entity';

export class OrderVariant extends BaseEntity {
  order_processed_succes: boolean;

  orderVariantStatus: OrderVariantStatus;

  orderStatusMessage: string;

  order_processed_message: string;

  line_items: LineItem[];

  order: Order;

  order_id: string;

  created_at: Date;

  market: Market;

  market_id: string;

  marketConfigEntry: MarketConfigEntry;

  market_config_entry_id: string;

  orderVariantLogistics: OrderVariantLogistic[];
}
