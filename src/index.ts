import 'reflect-metadata';
import {GigaB2bService} from "./giga-b2b.service";
import {GigaB2bContext} from "./context/giga-b2b.context";
import {ExternalMarketCommunicationConfig, LogisticsAvailability} from "./common.index";
import {Market} from "./database/entities/market.entity";
import {MarketConfigEntry} from "./database/entities/market-config-entry.entity";
import {HttpRetryService} from "./infrastructure/http-retry/http-retry.service";
import {Marketplaces} from "./database/entities/enums";
import {Environment} from "./env";
import {DateTime} from "luxon";
import {Order} from "./database/entities/order.entity";
import {OrderVariant} from "./database/entities/order-variant.entity";
import {Product} from "./database/entities/product.entity";
import {LineItem} from "./database/entities/line-item.entity";
import {CustomerShippingAdress} from "./database/entities/customer-shipping-address.entity";

DateTime.local();

function createOrderVariant(orderNumber: string): OrderVariant {
    const order: Order = new Order();
    order.order_number = orderNumber;

    const orderVariant: OrderVariant = new OrderVariant();
    orderVariant.id = orderNumber;
    orderVariant.order = order;
    orderVariant.line_items = [];
    orderVariant.created_at = new Date();

    return orderVariant;
}

function createOrderVariantForExport(orderNumber: string, sku: string): OrderVariant {
    const order: Order = new Order();
    order.order_number = orderNumber;

    const shippingAddress: CustomerShippingAdress = new CustomerShippingAdress();
    shippingAddress.data = {
        email: 'test@example.com',
        name: 'Test Customer',
        phone: '+31612345678',
        address1: 'Teststraat 1',
        address2: '',
        city: 'Amsterdam',
        country: 'Netherlands',
        province: 'Noord-Holland',
        zip: '1000 AA',
        country_code: 'NL',
    };
    order.customerShippingAdress = shippingAddress;

    const lineItem: LineItem = new LineItem();
    lineItem.sku = sku;
    lineItem.quantity = 1;
    lineItem.price = '99.99';
    lineItem.name = 'Test Product';

    const orderVariant: OrderVariant = new OrderVariant();
    orderVariant.id = orderNumber;
    orderVariant.order = order;
    orderVariant.line_items = [lineItem];
    orderVariant.created_at = new Date();

    return orderVariant;
}

function createProduct(sku: string): Product {
    const product: Product = new Product();
    product.sku = sku;
    return product;
}

function logSection(title: string): void {
    console.log("");
    console.log("=================================================================================");
    console.log(title);
    console.log("=================================================================================");
}

(async () => {
    const orderNumbers: string[] = [
        // 'A000AA6T06',
        // 'A000A8LL7J',
        // 'A000AA7NXR',
        // 'A000AA3CJL',
        // 'A000AA6NJT',
        // 'A000AAAW2A',
        // 'A000AACP7A',
    ]

    const testSkus: string[] = [
        'T3323P364949',
        'LDB00195AAK',
        // 'T3323P312515',
        // 'OT2801A'
    ]

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

    logSection("TEST: productAvailableOnMarket");
    const availability: LogisticsAvailability[] = await gigaService.productAvailableOnMarket(testSkus);
    console.log(JSON.stringify(availability, null, 2));

    logSection("TEST: importExternalMarketProducts");
    let pageCount = 0;
    for await (const bundles of gigaService.importExternalMarketProducts()) {
        pageCount++;
        console.log(`Page ${pageCount}: received ${bundles.length} category bundle(s)`);
        for (const bundle of bundles) {
            console.log(`  Category: ${bundle.productCategory.category}, Products: ${bundle.products.map(p => p.sku).join(', ')}`);
        }
        if (pageCount >= 1) {
            break;
        }
    }

    logSection("TEST: importGivenMarketSkus");
    const importedBundles = await gigaService.importGivenMarketSkus(testSkus);
    console.log(`Imported ${importedBundles.length} bundle(s)`);
    for (const bundle of importedBundles) {
        console.log(`  Category: ${bundle.productCategory.category}, Products: ${bundle.products.map(p => p.sku).join(', ')}`);
    }

    logSection("TEST: updateProductsFromExternalMarket");
    const productsToUpdate: Product[] = testSkus.map(createProduct);
    const updates = await gigaService.updateProductsFromExternalMarket(productsToUpdate);
    console.log(`Computed ${updates.length} product update(s)`);
    for (const update of updates) {
        console.log(`  SKU: ${update.product.sku}`);
        console.log(`    Price: ${JSON.stringify(update.update.price)}`);
        console.log(`    Stock: ${JSON.stringify(update.update.stock)}`);
    }

    logSection("TEST: downloadMarketProductsAttachments");
    const productsToDownload: Product[] = testSkus.map(createProduct);
    const attachments = await gigaService.downloadMarketProductsAttachments(productsToDownload, 1);
    console.log(`Downloaded attachments for ${attachments.length} product(s)`);
    for (const attachment of attachments) {
        console.log(`  SKU: ${attachment.context.sku}, Files: ${attachment.data.length}`);
        for (const file of attachment.data) {
            console.log(`    Name: ${file.name}, Type: ${file.docType}, Size: ${file.attachment.length} bytes`);
        }
    }

    logSection("TEST: ordersStatusValidation");
    const orderVariantsForStatus: OrderVariant[] = orderNumbers.map(createOrderVariant);
    const statusResults = await gigaService.ordersStatusValidation(orderVariantsForStatus);
    console.log(`Validated status for ${statusResults.length} order variant(s)`);
    for (const result of statusResults) {
        console.log(`  Order: ${result.data?.orderVariant.order.order_number}, Status: ${result.data?.status}, Success: ${result.success}`);
    }

    logSection("TEST: queryOrderLogistics");
    const orderVariantsForLogistics: OrderVariant[] = orderNumbers.map(createOrderVariant);
    const logisticsResults = await gigaService.queryOrderLogistics(orderVariantsForLogistics);
    console.log(`Queried logistics for ${logisticsResults.length} order variant(s)`);
    for (const result of logisticsResults) {
        console.log(`  Order: ${result.data?.orderVariant.order.order_number}, Tracks: ${result.data?.logistics.length ?? 0}`);
        for (const track of result.data?.logistics ?? []) {
            console.log(`    Carrier: ${track.carrierName}, Tracking: ${track.trackingNumber}`);
        }
    }

    logSection("TEST: exportOrders");
    const orderVariantsToExport: OrderVariant[] = [
        createOrderVariantForExport('A000AA6T06', 'OT2801A')
    ];
    const exportResults = await gigaService.exportOrders(orderVariantsToExport);
    console.log(`Exported ${exportResults.length} order variant(s)`);
    for (const result of exportResults) {
        console.log(`  Order variant ${result.data?.id}: Success: ${result.success}, Message: ${result.msg}`);
    }

    logSection("All tests completed");
})()
