import {GigaB2bService} from "./giga-b2b.service";
import 'reflect-metadata';
import {GigaB2bContext} from "./context/giga-b2b.context";
import {ExternalMarketCommunicationConfig, LogisticsAvailability} from "./common.index";
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

    const validation = await gigaService.validateExternalMarketInstance();
    if (!validation || !validation.success) {
        throw new Error("Validation invalid")
    }

    const availability: LogisticsAvailability[] = await gigaService.productAvailableOnMarket([
        'OT2801A'
    ]);


    // for await (const details of gigaService.importExternalMarketProducts()) {
    //     const products: Product[] = details.slice(0, 2).map((detail) => detail.products).flat();
    //
    //     const updates: ExternalMarketProductUpdate[] = await gigaService.updateProductsFromExternalMarket(products);
    //
    //
    //     console.log()
    //     console.log()
    //
    //     console.log(JSON.stringify(updates, null, 2));
    //     console.log(JSON.stringify(updates[0].update.price.available, null, 2));
    //     console.log()
    //     console.log()
    //     console.log("=================================================================================")
    // }
})()