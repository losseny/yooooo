import 'reflect-metadata';
import * as fs from "fs";
import * as path from "path";
import {GigaApi} from "./giga-b2b.api";
import {GigaB2bContext} from "./context/giga-b2b.context";
import {HttpRetryService} from "./infrastructure/http-retry/http-retry.service";
import {Market} from "./database/entities/market.entity";
import {MarketConfigEntry} from "./database/entities/market-config-entry.entity";
import {Marketplaces} from "./database/entities/enums";
import {Environment} from "./env";
import {PageInfo, ProductRecord, QueryResponse} from "./types";
import {DateTime} from "luxon";

// Records as much Giga data as possible into GIGA_RECORD_DIR (raw/ = every call, *.json = merged per entity).
// Usage: [GIGA_PROBES_ONLY=1] GIGA_RECORD_DIR=data/giga GIGA_SINCE=2000-01-01 GIGA_MAX_PAGES=0 GIGA_ORDER_NUMBERS=A1,A2 node dist/record.js
const OUT: string = process.env.GIGA_RECORD_DIR ??= 'data/giga';
const SINCE: string = process.env.GIGA_SINCE ?? '2000-01-01';
const MAX_PAGES: number = Number(process.env.GIGA_MAX_PAGES ?? 0); // 0 = all pages
const ORDER_NUMBERS: string[] = (process.env.GIGA_ORDER_NUMBERS ?? '').split(',').map(s => s.trim()).filter(Boolean);

const PAGE_SIZE = 200;
const SKU_BATCH = 200;
const ORDER_BATCH = 100;
const WAREHOUSE_BATCH = 200;
const RATE_LIMIT_CODE = '400001';
const PROBES_ONLY: boolean = process.env.GIGA_PROBES_ONLY === '1';
const NOW: string = DateTime.now().setZone('UTC-8').toFormat('yyyy-MM-dd HH:mm:ss');
const RECENT: string = DateTime.now().setZone('UTC-8').minus({days: 30}).toFormat('yyyy-MM-dd HH:mm:ss');

const API = '/b2b-overseas-api/v1/buyer';
const ENDPOINTS = {
    details: `${API}/product/detailInfo/v1`,
    inventory: `${API}/inventory/quantity/v2`,
    price: `${API}/product/price/v1`,
    orderStatus: `${API}/order/status/v1`,
    orderTrack: `${API}/order/track-no/v1`,
    warehouse: `${API}/warehouse/query-address/v1`,
};

function save(name: string, data: unknown): void {
    fs.mkdirSync(OUT, {recursive: true});
    fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(data, null, 2));
    console.log(`Saved ${name}.json`);
}

function chunk<T>(items: T[], size: number): T[][] {
    return Array.from({length: Math.ceil(items.length / size)}, (_, i) => items.slice(i * size, (i + 1) * size));
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Giga signals rate limiting in the body (code 400001), not only via HTTP 429.
async function call<T>(api: GigaApi, endpoint: string, body: unknown): Promise<QueryResponse<T> | undefined> {
    for (let attempt = 1; attempt <= 5; attempt++) {
        try {
            const response: QueryResponse<T> = await api.post<unknown, T>(endpoint, body);
            if (response.code !== RATE_LIMIT_CODE) {
                return response;
            }
        } catch (e) {
            console.error(`${endpoint} failed: ${e instanceof Error ? e.message : e}`);
            return undefined;
        }
        console.warn(`${endpoint} rate limited, waiting 10s (attempt ${attempt})`);
        await sleep(10_000);
    }
    return undefined;
}

async function batched<T>(api: GigaApi, endpoint: string, key: string, values: string[], size: number): Promise<T[]> {
    const results: T[] = [];
    const batches: string[][] = chunk(values, size);
    for (const [i, batch] of batches.entries()) {
        const response = await call<T[]>(api, endpoint, {[key]: batch});
        results.push(...(response?.data ?? []));
        console.log(`${endpoint}: batch ${i + 1}/${batches.length}, ${results.length} result(s) so far`);
    }
    return results;
}

(async () => {
    const market: Market = new Market();
    market.marketPlace = Marketplaces.GigaB2b;
    market.lastImportedProductsDate = new Date(SINCE);

    const marketConfigEntry: MarketConfigEntry = new MarketConfigEntry();
    marketConfigEntry.data = {
        apiHost: Environment.GetEnvironment("GIGA_B2B_BASE_URL"),
        clientId: Environment.GetEnvironment("GIGA_B2B_CLIENT_ID"),
        password: Environment.GetEnvironment("GIGA_B2B_PASSWORD")
    };

    const retry: HttpRetryService = new HttpRetryService(console);
    // Giga allows 20 requests per 10 seconds; stay just under it.
    retry.configure({reservoir: 18, reservoirRefreshAmount: 18, reservoirRefreshIntervalMs: 10_000, maxConcurrent: 1, context: 'GigaRecorder'});
    const api: GigaApi = new GigaApi(new GigaB2bContext({market, marketConfigEntry}), retry);

    console.log(`Recording into ${OUT}, products updated after ${SINCE}, max pages ${MAX_PAGES || 'all'}`);

    if (PROBES_ONLY) {
        const products: ProductRecord[] = JSON.parse(fs.readFileSync(path.join(OUT, 'products.json'), 'utf8'));
        await runProbes(api, products.map(p => p.sku));
        console.log('Recording complete');
        return;
    }

    // 1. Product list: every page.
    const products: ProductRecord[] = [];
    let pageInfo: PageInfo = {page: 0, pageSize: PAGE_SIZE, totalPage: 0, totalNum: 0};
    do {
        const response = await api.queryProducts(pageInfo);
        if (!response) {
            console.error(`Stopping product list after page ${pageInfo.page}`);
            break;
        }
        products.push(...response.data.records);
        pageInfo = response.data.pageInfo;
        console.log(`Product list page ${pageInfo.page}/${pageInfo.totalPage}: ${products.length}/${pageInfo.totalNum} record(s)`);
    } while (!pageInfo.end && !(MAX_PAGES && pageInfo.page >= MAX_PAGES));
    save('products', products);

    const skus: string[] = [...new Set(products.map(p => p.sku))];

    // 2. Per-SKU data.
    save('details', await batched(api, ENDPOINTS.details, 'skus', skus, SKU_BATCH));
    const inventory = await batched<any>(api, ENDPOINTS.inventory, 'skus', skus, SKU_BATCH);
    save('inventory', inventory);
    save('prices', await batched(api, ENDPOINTS.price, 'skus', skus, SKU_BATCH));

    // 3. Warehouses referenced by inventory.
    const warehouseCodes: string[] = [...new Set(inventory.flatMap(i => [
        ...(i.buyerInventoryInfo?.buyerInventoryDistribution ?? []),
        ...(i.sellerInventoryInfo?.sellerInventoryDistribution ?? []),
    ].map((d: { warehouseCode: string }) => d.warehouseCode)).filter(Boolean))];
    save('warehouses', await batched(api, ENDPOINTS.warehouse, 'warehouseCodes', warehouseCodes, WAREHOUSE_BATCH));

    // 4. Orders (only the ones you pass in; there is no list endpoint).
    if (ORDER_NUMBERS.length) {
        save('order-status', await batched(api, ENDPOINTS.orderStatus, 'orderNo', ORDER_NUMBERS, ORDER_BATCH));
        save('order-tracking', await batched(api, ENDPOINTS.orderTrack, 'orderNo', ORDER_NUMBERS, ORDER_BATCH));
    }

    await runProbes(api, skus);
    console.log('Recording complete');
})();

// Edge cases from docs/ocr, so the mock can reproduce Giga's validation and error behaviour. Results land in raw/ only.
async function runProbes(api: GigaApi, skus: string[]): Promise<void> {
    const list = `${API}/product/skus/v1`;
    const tooMany = (n: number) => Array.from({length: n}, (_, i) => skus[i] ?? `X${i}`);
    const probes: [string, unknown][] = [
        // product list: paging, sorting and time filters (recent window keeps them fast)
        [list, {page: 1, pageSize: 100, lastUpdatedAfter: RECENT, sort: 1}],
        [list, {page: 2, pageSize: 100, lastUpdatedAfter: RECENT, sort: 1}],
        [list, {page: 9999, pageSize: 100, lastUpdatedAfter: RECENT, sort: 1}],
        [list, {page: 1, pageSize: 100, lastUpdatedAfter: RECENT, sort: 2}],
        [list, {page: 1, pageSize: 100, lastUpdatedAfter: RECENT, sort: 3}],
        [list, {page: 1, pageSize: 100, lastUpdatedAfter: RECENT, sort: 4}],
        [list, {page: 1, pageSize: 100, firstArrivalDate: RECENT.slice(0, 10), sort: 1}],
        [list, {page: 1, pageSize: 100, queryTimeType: 1, startTime: RECENT, endTime: NOW, sort: 1}],
        [list, {page: 1, pageSize: 100, queryTimeType: 2, startTime: RECENT, endTime: NOW, sort: 1}],
        [list, {page: 1, pageSize: 100, queryTimeType: 3, startTime: RECENT, endTime: NOW}],
        [list, {page: 1, pageSize: 100, queryTimeType: 1}],
        [list, {page: 1, pageSize: 100, startTime: RECENT, endTime: NOW}],
        [list, {page: 1, pageSize: 100, lastUpdatedAfter: RECENT, queryTimeType: 1, startTime: RECENT, endTime: NOW}],
        [list, {page: 1, pageSize: 100, queryTimeType: 1, startTime: 'bad', endTime: NOW}],
        [list, {page: 0, pageSize: 100, lastUpdatedAfter: RECENT}],
        [list, {page: 1, pageSize: 99, lastUpdatedAfter: RECENT}],
        [list, {page: 1, pageSize: 10001, lastUpdatedAfter: RECENT}],
        [list, {page: 1, pageSize: 100, lastUpdatedAfter: 'not-a-date'}],
        [list, {page: 1, pageSize: 100, lastUpdatedAfter: RECENT, sort: 9}],
        [list, {page: 1, pageSize: 100, lastUpdatedAfter: NOW}],
        // details
        [ENDPOINTS.details, {skus: []}],
        [ENDPOINTS.details, {}],
        [ENDPOINTS.details, {skus: ['DOES-NOT-EXIST-123']}],
        [ENDPOINTS.details, {skus: [skus[0] ?? 'X', 'DOES-NOT-EXIST-123']}],
        [ENDPOINTS.details, {skus: [skus[0] ?? 'X', skus[0] ?? 'X']}],
        [ENDPOINTS.details, {skus: tooMany(SKU_BATCH + 1)}],
        [ENDPOINTS.details, {productNames: ['DOES-NOT-EXIST-123']}],
        [ENDPOINTS.details, {skus: [skus[0] ?? 'X'], productNames: ['X']}],
        // inventory
        [ENDPOINTS.inventory, {skus: []}],
        [ENDPOINTS.inventory, {skus: ['DOES-NOT-EXIST-123']}],
        [ENDPOINTS.inventory, {skus: [skus[0] ?? 'X', 'DOES-NOT-EXIST-123']}],
        [ENDPOINTS.inventory, {skus: tooMany(SKU_BATCH + 1)}],
        // price
        [ENDPOINTS.price, {skus: []}],
        [ENDPOINTS.price, {skus: ['DOES-NOT-EXIST-123']}],
        [ENDPOINTS.price, {skus: [skus[0] ?? 'X', 'DOES-NOT-EXIST-123']}],
        [ENDPOINTS.price, {skus: tooMany(SKU_BATCH + 1)}],
        // orders
        [ENDPOINTS.orderStatus, {orderNo: []}],
        [ENDPOINTS.orderStatus, {orderNo: ['DOES-NOT-EXIST-123']}],
        [ENDPOINTS.orderStatus, {orderNo: tooMany(ORDER_BATCH + 1)}],
        [ENDPOINTS.orderTrack, {orderNo: []}],
        [ENDPOINTS.orderTrack, {orderNo: ['DOES-NOT-EXIST-123']}],
        [ENDPOINTS.orderTrack, {orderNo: tooMany(ORDER_BATCH + 1)}],
        // warehouses
        [ENDPOINTS.warehouse, {warehouseCodes: []}],
        [ENDPOINTS.warehouse, {warehouseCodes: ['XX0']}],
        [ENDPOINTS.warehouse, {warehouseCodes: ['CA3', 'XX0']}],
        [ENDPOINTS.warehouse, {warehouseCodes: tooMany(WAREHOUSE_BATCH + 1)}],
        // malformed requests
        [`${API}/does-not-exist/v1`, {}],
        [ENDPOINTS.details, 'not-json'],
    ];
    for (const [endpoint, body] of probes) {
        const response = await call(api, endpoint, body);
        console.log(`Probe ${endpoint} ${JSON.stringify(body).slice(0, 80)} -> ${response?.code ?? 'HTTP error'} ${response?.msg ?? ''}`);
    }
}
