import {GigaApiSignature} from "../types";
import * as crypto from 'crypto';
import {Market} from "../database/entities/market.entity";
import {ExternalMarketCommunicationConfig} from "../common.index";

class GigaConfig {
    clientId: string | undefined;
    apiHost: string | undefined;
    password: string | undefined;

    constructor(marketConfig: ExternalMarketCommunicationConfig) {
        Object.assign(this, marketConfig.marketConfigEntry.data);

        if (!this.clientId || !this.password || !this.apiHost) {
            throw new Error('Missing GigaB2B environment keys!');
        }
    }
}

export class GigaB2bContext {

    private readonly _marketConfig: ExternalMarketCommunicationConfig;
    private readonly gigaConfig: GigaConfig

    private static readonly ALGORITHM: string = "sha256";

    constructor(marketConfig: ExternalMarketCommunicationConfig) {
        this._marketConfig = marketConfig;
        this.gigaConfig = new GigaConfig(marketConfig);
    }

    public generateApiSign(uri: string): GigaApiSignature {
        const timestamp: number = Date.now();
        const nonce: string = this.secureRandomDigits10();

        const message: string = `${this.clientId}&${uri}&${timestamp}&${nonce}`;
        const key: string = `${this.clientId}&${this.password}&${nonce}`;

        return {
            signature: this.sign(message, key),
            nonce,
            timestamp,
            uri,
            clientId: this.clientId
        }
    }

    private sign(message: string, key: string): string {
        const digest = crypto.createHmac(GigaB2bContext.ALGORITHM, key)
            .update(message, 'utf8')
            .digest('hex');

        return Buffer.from(digest).toString('base64');
    }

    private secureRandomDigits10(): string {
        const arr = new Uint32Array(1);
        crypto.getRandomValues(arr);
        return String(arr[0] % 10000000000).padStart(10, '0');
    }

    get clientId(): string {
        return <string>this.gigaConfig.clientId;
    }

    get apiHost(): string {
        return <string>this.gigaConfig.apiHost;
    }

    get password(): string {
        return <string>this.gigaConfig.password;
    }

    get market(): Market {
        return this._marketConfig.market;
    }


}
