import {GigaB2bService} from "./giga-b2b.service";
import 'reflect-metadata';
import {GigaB2bContext} from "./context/giga-b2b.context";
import {ExternalMarketCommunicationConfig} from "./common.index";
import {Market} from "./database/entities/market.entity";
import {MarketConfigEntry} from "./database/entities/market-config-entry.entity";
import {HttpRetryService} from "./infrastructure/http-retry/http-retry.service";
import {Marketplaces} from "./database/entities/enums";
import {Environment} from "./env";
import {DateTime} from "luxon";

DateTime.local();

(async () => {
    const market: Market = new Market();
    market.marketPlace = Marketplaces.GigaB2b
    // market.lastImportedProductsDate = new Date(DateTime.now().toFormat("yyyy-MM-dd"))
    market.lastImportedProductsDate = new Date('2026-07-01')
    const marketConfigEntry: MarketConfigEntry = new MarketConfigEntry();
    marketConfigEntry.data = {
        apiHost: Environment.GetEnvironment("GIGA_B2B_BASE_URL"),
        clientId: Environment.GetEnvironment("GIGA_B2B_CLIENT_ID"),
        password: Environment.GetEnvironment("GIGA_B2B_PASSWORD")
    }

    const config: ExternalMarketCommunicationConfig = {
        market,
        marketConfigEntry
    }
    const context: GigaB2bContext = new GigaB2bContext(config)
    const retry: HttpRetryService = new HttpRetryService(console);
    const gigaService: GigaB2bService = new GigaB2bService(context, retry);

    for await (const details of gigaService.importExternalMarketProducts()) {
        console.log()
        console.log()

        console.log(JSON.stringify(details, null, 2));
        console.log()
        console.log()
        console.log("=================================================================================")
    }

})()