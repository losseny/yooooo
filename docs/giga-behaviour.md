# Giga Open API 2.0: observed behaviour

Source material for a Giga mock. Specs: `docs/ocr/*.txt` (OCR of the PDFs, may contain OCR typos).
Recorded data: `data/giga/` (gitignored, produced by `make record` / `src/record.ts`).
Observed against production (`https://openapi.gigab2b.com`, DE drop-shipping buyer account) on 2026-10-28.

## Recorded data (`data/giga/`)

| File | Content |
|---|---|
| `products.json` | 5007 product list records (all pages, `lastUpdatedAfter` 2000-01-01) |
| `details.json` | detailInfo for all 5007 SKUs (~77 MB) |
| `inventory.json` | inventory for all 5007 SKUs (3238 with stock) |
| `prices.json` | prices for all 5007 SKUs (all EUR, all `skuAvailable: true`) |
| `raw/<endpoint>/*.json` | every call: `method, uri, requestedAt, durationMs, request, status, headers, response` |

Not recorded: real orders (no known Giga order numbers yet), warehouses (DE drop-ship account gets no
per-warehouse inventory distribution, so no warehouse codes), `dropShip-sync` (would create real orders;
sandbox `https://openapi-sandbox.gigab2b.com` exists for that).

## General

- Every endpoint is `POST /b2b-overseas-api/v1/buyer/...` with a JSON body.
- Envelope: `{success, code, data, requestId, msg, subMsg, recommend}`. `code` is `"200"` on success, `msg` is `"success"`.
- **Business errors return HTTP 200** with `success: false`, `data: null`, a `B*` code, generic `msg`, specific `subMsg`.
- Unknown path: **HTTP 500** with body `code: "404"`, `msg: "The path does not exist."`.
- Non-JSON body: HTTP 200, code `400003`.
- Signature: `sign = base64(hex(HMAC-SHA256(key = clientId&secret&nonce, msg = clientId&path&timestamp&nonce)))`,
  headers `client-id, timestamp (ms), nonce (10 digits), sign`. Timestamp valid 20 min. Codes 400004–4000010.
- Rate limits (code `400001`): product list, inventory, price 10 req/10 s; details, orders, tracking, warehouse 20 req/10 s; dropShip-sync none.
- Response headers carry nothing useful (date, content-type, content-length, connection, server).
- Latency: errors ~0.5 s; small queries 0.5–1 s; product list 3 s (recent window) to 25–30 s (`lastUpdatedAfter` far back, any pageSize).

## Error-code families

| Endpoint | empty input | invalid / too many | not found |
|---|---|---|---|
| product list `product/skus/v1` | | B20002 | |
| details `product/detailInfo/v1` | B20002 | B20002 | B20004 (productNames only) |
| price `product/price/v1` | B20001 | B20002 | (B20003 per docs: not in Saved Items) |
| inventory `inventory/quantity/v2` | B50001 | B50002 | B50004 (B50003 per docs) |
| order status `order/status/v1` | B10001 | B10002 | B10004 |
| tracking `order/track-no/v1` | B40001 | B40002 | B40004 |
| warehouse `warehouse/query-address/v1` | B52001 | B52002 | B52004 |
| dropShip-sync `order/dropShip-sync/v1` | | B11002 | B11004 (duplicate orderNo / unknown SKU), B11003 business rules |

## Product list (`product/skus/v1`)

- `pageSize` 100–10000 (99 and 10001 → B20002 "The pageSize format is incorrect.").
- `page` < 1 → B20002 "The page format is incorrect.". Page past the end → success with `data: {pageInfo: null, records: null}`.
- No match (e.g. `lastUpdatedAfter` = now) → also `{pageInfo: null, records: null}`.
- `sort`: 1 updateTime asc, 2 updateTime desc, 3 datePosted asc, 4 datePosted desc. Invalid sort (9) is ignored, no error.
- `lastUpdatedAfter` bad format → B20002 "The lastUpdatedAfter format is incorrect.".
- `queryTimeType` (1 = updateTime, 2 = addedTime) needs `startTime` + `endTime` (`yyyy-MM-dd HH:mm:ss`, UTC-8):
  - only queryTimeType → B20002 "Both startTime and endTime fields are required when the queryTimeType field is provided."
  - only start/end → B20002 "queryTimeType is required when both startTime and endTime fields are provided."
  - queryTimeType 3 → B20002 "Only 1 or 2 can be filled in the queryTimeType field."
  - combined with lastUpdatedAfter → B20002 "...two mutually exclusive modes..."
  - bad startTime → B20002 "The startTime format is incorrect. It must be in yyyy-MM-dd HH:mm:ss."
- `firstArrivalDate` (`yyyy-MM-dd`) filters on first arrival ≥ date.
- Times in records are UTC-8.

## SKU endpoints (details, price, inventory)

- Max 200 per request (201 → B20002 / B50002).
- **Unknown SKUs mixed with known ones → success, unknown SKU returns a placeholder object** with only `sku`
  set and everything else null/empty (details additionally has `weightUnit: "lb", lengthUnit: "in"`, flags false).
- Only unknown SKUs: details and price → success with placeholder; inventory → B50004 "SKU unavailable on GIGAB2B.".
- Duplicate SKUs in one request are de-duplicated (details returned 1 record for `[A, A]`).
- Details: exactly one of `skus` / `productNames` (both or neither → B20002 "Exactly one of the skus and productNames
  fields must be provided as the request parameter."); unknown productNames → B20004.
- Price empty list → B20001 "the list of sku can not be empty".

## Orders

- Max 100 order numbers (101 → B10002 / B40002).
- **One unknown orderNo fails the whole batch** (B10004 "There is no such orderNo on b2b platform" / B40004 "orderNo not found.").
- `orderStatus` is a string like `"2:Being Processed"`. Values: 1 Unpaid, 2 Being Processed, 4 On Hold, 16 Canceled,
  32 Completed, 129 Check Shipping Label, 130 Package Label Pending, 257 Awaiting Pickup, 258 Bol Pending, 512 Canceled(time out).
  `canCancel` "0"/"1".

## Warehouses

- Max 200 codes. Unknown code mixed with known → placeholder with nulls. Only unknown → B52004
  "Warehouse code error,data not found.". `CA3` = 10850 Business Dr, Fontana, CA 92337, US.

## Bugs found in our client while recording (fixed)

- `GigaApi.queryProducts`: `pageInfo.page++` was a post-increment, so it re-sent the same page number, and
  `page >= response.page` then always marked the first page as `end`. The import only ever read page 1.
- `queryProducts` read `response.data.pageInfo.page`; for an empty result Giga returns `pageInfo: null` → TypeError.
- `GigaApi` timeout was 15 s; product list queries far back take 25–30 s. Now configurable via `GIGA_TIMEOUT_MS`.
