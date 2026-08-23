import {Market} from './market.entity';
import {MarketConfigEntryStatus} from './enums';
import {BaseWithEncryptionEntity} from './base-with-encryption.entity';

export class MarketConfigEntry extends BaseWithEncryptionEntity {

    shopId: string;

    marketId: string;

    marketConfigEntryStatus: MarketConfigEntryStatus;

    market: Market;
}
