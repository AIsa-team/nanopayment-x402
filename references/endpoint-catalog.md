---
name: aisa-endpoints-catalog
description: Complete catalog of AIsa x402-paid /apis/v2/ endpoints with per-call USD prices. Use as the authoritative reference when selecting, pricing, or invoking AIsa endpoints via the Arc-x402 skill.
---

# AIsa x402 Endpoint Catalog — Complete Price List

All endpoints use base URL `https://api.aisa.one` with the `/apis/v2/` path prefix. Prices are per call, charged in USDC via the x402 payment flow (Arc testnet, Circle Gateway settlement). Do not confuse `/apis/v1/` (API-key) with `/apis/v2/` (x402-paid).

**Totals:** 102 endpoints across 7 categories. Source-of-truth: `https://console.aisa.one/category` (priceUsd = feePreCallRaw / 500000). Every price in this catalog has been validated against the server's signed 402 `payment-required` header and against end-to-end Circle Gateway settlement.

## Twitter (28 endpoints)

Category ID: 1 | Provider: Twitter / AISA_TWITTER

| # | Name | Path | Price (USD) |
|---|------|------|------------:|
| 1 | Batch Get User Info By UserIds | `/apis/v2/twitter/user/batch_info_by_ids` | $0.000440 |
| 2 | Get User Info | `/apis/v2/twitter/user/info` | $0.000440 |
| 3 | Get User Last Tweets | `/apis/v2/twitter/user/last_tweets` | $0.003600 |
| 4 | Get User Followers | `/apis/v2/twitter/user/followers` | $0.036000 |
| 5 | Get User Followings | `/apis/v2/twitter/user/followings` | $0.036000 |
| 6 | Get User Mentions | `/apis/v2/twitter/user/mentions` | $0.003600 |
| 7 | Check Follow Relationship | `/apis/v2/twitter/user/check_follow_relationship` | $0.001200 |
| 8 | Search user by keyword | `/apis/v2/twitter/user/search` | $0.001200 |
| 9 | Get User Verified Followers | `/apis/v2/twitter/user/verifiedFollowers` | $0.000440 |
| 10 | Get Tweets by IDs | `/apis/v2/twitter/tweets` | $0.002200 |
| 11 | Get Tweet Replies | `/apis/v2/twitter/tweet/replies` | $0.002200 |
| 12 | Get User Profile About | `/apis/v2/twitter/user_about` | $0.000440 |
| 13 | Get Tweet Quotations | `/apis/v2/twitter/tweet/quotes` | $0.002200 |
| 14 | Get Tweet Retweeters | `/apis/v2/twitter/tweet/retweeters` | $0.002200 |
| 15 | Get Tweet Thread Context | `/apis/v2/twitter/tweet/thread_context` | $0.007000 |
| 16 | Get Article | `/apis/v2/twitter/article` | $0.002200 |
| 17 | Advanced Search | `/apis/v2/twitter/tweet/advanced_search` | $0.002200 |
| 18 | Get List Followers | `/apis/v2/twitter/list/followers` | $0.002200 |
| 19 | Get List Members | `/apis/v2/twitter/list/members` | $0.002200 |
| 20 | Get Community Info By Id | `/apis/v2/twitter/community/info` | $0.002200 |
| 21 | Get Community Members | `/apis/v2/twitter/community/members` | $0.002200 |
| 22 | Get Community Moderators | `/apis/v2/twitter/community/moderators` | $0.002200 |
| 23 | Get Community Tweets | `/apis/v2/twitter/community/tweets` | $0.002200 |
| 24 | Search Tweets From All Community | `/apis/v2/twitter/community/get_tweets_from_all_community` | $0.002200 |
| 25 | Get trends by woeid | `/apis/v2/twitter/trends` | $0.002200 |
| 26 | Get Space Detail | `/apis/v2/twitter/spaces/detail` | $0.002200 |
| 27 | Post Twitter | `/apis/v2/twitter/post_twitter` | $0.010000 |
| 28 | OAuth Twitter | `/apis/v2/twitter/auth_twitter` | $0.001000 |

Notes: Twitter user endpoints require `userName` (not `screen_name`). The follower/following/verifiedFollowers endpoints require `user_id` (numeric, not username). Do not call `post_twitter` unless the user explicitly asks to publish.

## Search & Prediction Markets (20 endpoints)

Category ID: 2 | Provider: Tavily / Dome

| # | Name | Path | Price (USD) |
|---|------|------|------------:|
| 1 | Tavily Search | `/apis/v2/tavily/search` | $0.009600 |
| 2 | Tavily Extract | `/apis/v2/tavily/extract` | $0.009600 |
| 3 | Tavily Crawl | `/apis/v2/tavily/crawl` | $0.009600 |
| 4 | Tavily Map | `/apis/v2/tavily/map` | $0.009600 |
| 5 | Polymarket — Markets | `/apis/v2/polymarket/markets` | $0.010000 |
| 6 | Polymarket — Events | `/apis/v2/polymarket/events` | $0.010000 |
| 7 | Polymarket — Orders | `/apis/v2/polymarket/orders` | $0.010000 |
| 8 | Polymarket — Orderbooks | `/apis/v2/polymarket/orderbooks` | $0.010000 |
| 9 | Polymarket — Activity | `/apis/v2/polymarket/activity` | $0.010000 |
| 10 | Polymarket — Market Price | `/apis/v2/polymarket/market-price/{token_id}` | $0.010000 |
| 11 | Polymarket — Candlesticks | `/apis/v2/polymarket/candlesticks` | $0.010000 |
| 12 | Polymarket — Positions | `/apis/v2/polymarket/positions/wallet/{wallet_address}` | $0.010000 |
| 13 | Polymarket — Wallet | `/apis/v2/polymarket/wallet` | $0.010000 |
| 14 | Polymarket — Wallet PnL | `/apis/v2/polymarket/wallet/pnl` | $0.010000 |
| 15 | Kalshi — Markets | `/apis/v2/kalshi/markets` | $0.010000 |
| 16 | Kalshi — Trades | `/apis/v2/kalshi/trades` | $0.010000 |
| 17 | Kalshi — Market Price | `/apis/v2/kalshi/market-price/{market_ticker}` | $0.010000 |
| 18 | Kalshi — Orderbooks | `/apis/v2/kalshi/orderbooks` | $0.010000 |
| 19 | Matching Markets — Sports | `/apis/v2/matching-markets/sports` | $0.010000 |
| 20 | Matching Markets — Sport by Date | `/apis/v2/matching-markets/sports/{sport}` | $0.010000 |

Notes: Polymarket and Kalshi search require `status=open|closed`. `matching-markets/sports` requires `kalshi_ticker` or `polymarket_market_slug`.

## Financial (22 endpoints)

Category ID: 3 | Provider: Financial

| # | Name | Path | Price (USD) |
|---|------|------|------------:|
| 1 | Analyst Estimates | `/apis/v2/financial/analyst-estimates` | $0.120000 |
| 2 | Company Facts (by ticker) | `/apis/v2/financial/company/facts` | $0.024000 |
| 3 | Earnings | `/apis/v2/financial/earnings` | $0.012000 |
| 4 | Earnings Press Releases (by ticker) | `/apis/v2/financial/earnings/press-releases` | $0.048000 |
| 5 | Financial Metrics Historical | `/apis/v2/financial/financial-metrics` | $0.048000 |
| 6 | Financial Metrics Snapshot | `/apis/v2/financial/financial-metrics/snapshot` | $0.048000 |
| 7 | Income Statements | `/apis/v2/financial/financials/income-statements` | $0.048000 |
| 8 | Balance Sheets | `/apis/v2/financial/financials/balance-sheets` | $0.048000 |
| 9 | Cash Flow Statements | `/apis/v2/financial/financials/cash-flow-statements` | $0.048000 |
| 10 | All Financial Statements (by ticker) | `/apis/v2/financial/financials` | $0.120000 |
| 11 | Insider Trades (by ticker) | `/apis/v2/financial/insider-trades` | $0.048000 |
| 12 | Institutional Ownership | `/apis/v2/financial/institutional-ownership` | $0.048000 |
| 13 | Historical Interest Rates | `/apis/v2/financial/macro/interest-rates` | $0.024000 |
| 14 | Latest Interest Rates | `/apis/v2/financial/macro/interest-rates/snapshot` | $0.024000 |
| 15 | Company News | `/apis/v2/financial/news` | $0.048000 |
| 16 | Stock Screener | `/apis/v2/financial/financials/search/screener` | $0.012000 |
| 17 | Search Financials (line items) | `/apis/v2/financial/financials/search/line-items` | $0.012000 |
| 18 | SEC Filings (by company) | `/apis/v2/financial/filings` | $0.024000 |
| 19 | SEC Filing Raw Items | `/apis/v2/financial/filings/items` | $0.024000 |
| 20 | Segmented Revenue | `/apis/v2/financial/financials/segmented-revenues` | $0.048000 |
| 21 | Stock Prices Historical | `/apis/v2/financial/prices` | $0.024000 |
| 22 | Stock Prices Snapshot | `/apis/v2/financial/prices/snapshot` | $0.024000 |

Notes:
- **Earnings Press Releases** has limited ticker coverage (2776 tickers). Before calling this endpoint, check `references/earnings-press-releases-tickers.md` to confirm the ticker is supported. Passing an unsupported ticker returns `{"error":"Invalid ticker"}`. If the ticker is not in the list, use `/financial/analyst-estimates` or `/financial/financials/income-statements` instead.
- There are currently no free endpoints in the catalog. If the server ever returns `Invalid price: $0.000000`, treat it as an upstream pricing bug, not an auth-mode switch.

## Scholar & Search (4 endpoints)

Category ID: 6 | Provider: Scholar

| # | Name | Path | Price (USD) |
|---|------|------|------------:|
| 1 | Scholar Search | `/apis/v2/scholar/search/scholar` | $0.002400 |
| 2 | Web Search | `/apis/v2/scholar/search/web` | $0.002400 |
| 3 | Mixed Smart Search | `/apis/v2/scholar/search/mixed` | $0.002400 |
| 4 | Explain Search Results | `/apis/v2/scholar/search/explain` | $0.002400 |

Notes: `scholar/search/explain` is a follow-up call and requires `search_id` in the request body.

## Perplexity AI (4 endpoints)

Category ID: 8 | Provider: Perplexity

| # | Name | Path | Price (USD) |
|---|------|------|------------:|
| 1 | Sonar | `/apis/v2/perplexity/sonar` | $0.012000 |
| 2 | Sonar Pro | `/apis/v2/perplexity/sonar-pro` | $0.012000 |
| 3 | Sonar Reasoning Pro | `/apis/v2/perplexity/sonar-reasoning-pro` | $0.012000 |
| 4 | Sonar Deep Research | `/apis/v2/perplexity/sonar-deep-research` | $0.012000 |

Notes: All Perplexity endpoints require `model` in the JSON body.

## YouTube (1 endpoint)

Category ID: 5 | Provider: Youtube

| # | Name | Path | Price (USD) |
|---|------|------|------------:|
| 1 | YouTube Search | `/apis/v2/youtube/search` | $0.002400 |

Notes: Requires both `q` and `engine=youtube`.

## CoinGecko (23 endpoints)

Category ID: 9 | Provider: CoinGecko

| # | Name | Path | Price (USD) |
|---|------|------|------------:|
| 1 | Coins List (ID Map) | `/apis/v2/coingecko/api/v3/coins/list` | $0.008000 |
| 2 | Coins List with Market Data | `/apis/v2/coingecko/api/v3/coins/markets` | $0.008000 |
| 3 | Coin Data by ID | `/apis/v2/coingecko/api/v3/coins/{id}` | $0.008000 |
| 4 | Coin Tickers by ID | `/apis/v2/coingecko/api/v3/coins/{id}/tickers` | $0.008000 |
| 5 | Coin Historical Data by ID | `/apis/v2/coingecko/api/v3/coins/{id}/history` | $0.008000 |
| 6 | Coin Historical Chart Data by ID | `/apis/v2/coingecko/api/v3/coins/{id}/market_chart` | $0.008000 |
| 7 | Coin Historical Chart Data within Time Range by ID | `/apis/v2/coingecko/api/v3/coins/{id}/market_chart/range` | $0.008000 |
| 8 | Coin OHLC Chart by ID | `/apis/v2/coingecko/api/v3/coins/{id}/ohlc` | $0.008000 |
| 9 | Coin Data by Token Address | `/apis/v2/coingecko/api/v3/coins/{id}/contract/{contract_address}` | $0.008000 |
| 10 | Coin Historical Chart Data by Token Address | `/apis/v2/coingecko/api/v3/coins/{id}/contract/{contract_address}/market_chart` | $0.008000 |
| 11 | Coins Categories List (ID Map) | `/apis/v2/coingecko/api/v3/coins/categories/list` | $0.008000 |
| 12 | Coins Categories List with Market Data | `/apis/v2/coingecko/api/v3/coins/categories` | $0.008000 |
| 13 | Exchanges List with Data | `/apis/v2/coingecko/api/v3/exchanges` | $0.008000 |
| 14 | Exchanges List (ID Map) | `/apis/v2/coingecko/api/v3/exchanges/list` | $0.008000 |
| 15 | Exchange Data by ID | `/apis/v2/coingecko/api/v3/exchanges/{id}` | $0.008000 |
| 16 | Exchange Tickers by ID | `/apis/v2/coingecko/api/v3/exchanges/{id}/tickers` | $0.008000 |
| 17 | Exchange Volume Chart by ID | `/apis/v2/coingecko/api/v3/exchanges/{id}/volume_chart` | $0.008000 |
| 18 | Exchange Volume Chart within Time Range by ID | `/apis/v2/coingecko/api/v3/exchanges/{id}/volume_chart/range` | $0.008000 |
| 19 | Coin Price by IDs, Symbols, or Names | `/apis/v2/coingecko/api/v3/simple/price` | $0.008000 |
| 20 | Coin Price by Token Addresses | `/apis/v2/coingecko/api/v3/simple/token_price/{id}` | $0.008000 |
| 21 | Supported Currencies List | `/apis/v2/coingecko/api/v3/simple/supported_vs_currencies` | $0.008000 |
| 22 | Trending Search List | `/apis/v2/coingecko/api/v3/search/trending` | $0.008000 |
| 23 | Crypto News | `/apis/v2/coingecko/api/v3/news` | $0.008000 |

Notes: CoinGecko endpoints mirror the upstream CoinGecko v3 API paths under the `/apis/v2/coingecko/` prefix. Flat price of $0.008000 per call across the whole category.

---

## Price Tiers (fast reference)

| Tier | Price/call | Endpoint count |
|------|-----------:|---------------:|
| $0.000440 | $0.000440 | 4 |
| $0.001000 | $0.001000 | 1 |
| $0.001200 | $0.001200 | 2 |
| $0.002200 | $0.002200 | 15 |
| $0.002400 | $0.002400 | 5 |
| $0.003600 | $0.003600 | 2 |
| $0.007000 | $0.007000 | 1 |
| $0.008000 | $0.008000 | 23 |
| $0.009600 | $0.009600 | 4 |
| $0.010000 | $0.010000 | 17 |
| $0.012000 | $0.012000 | 7 |
| $0.024000 | $0.024000 | 7 |
| $0.036000 | $0.036000 | 2 |
| $0.048000 | $0.048000 | 10 |
| $0.120000 | $0.120000 | 2 |

**Cheapest:** `/apis/v2/twitter/user/batch_info_by_ids`, `/apis/v2/twitter/user/info`, `/apis/v2/twitter/user/verifiedFollowers`, `/apis/v2/twitter/user_about` — all at $0.000440. **Most expensive single call:** `/apis/v2/financial/analyst-estimates` and `/apis/v2/financial/financials` at $0.120000.

## Minimum Gateway Deposit Guidance

A 5 USDC Gateway deposit covers roughly:
- ~11,363 Twitter `user/info` calls, or
- ~625 CoinGecko calls (any endpoint), or
- ~500 Perplexity Sonar calls, or
- ~208 Stock Price Snapshot calls, or
- ~41 full `financial/financials` pulls.

Top-up threshold per the Arc-x402 skill: auto-deposit 5 USDC whenever Gateway balance falls below 0.5 USDC.
