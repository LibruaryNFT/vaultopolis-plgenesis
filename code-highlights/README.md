# Code Highlights

Selected frontend components demonstrating the Vaultopolis analytics architecture. These are representative samples from the full production codebase.

## Files

### EditionAnalytics.jsx
The core analytics table component. Renders 80+ metrics per edition with:
- Sortable columns with tooltip definitions for every metric
- Supply bar visualization (minted/burned/locked/held/listed)
- Buy/sell signal badges based on ask/EV ratios
- Configurable column presets (Pricing, Supply, Trading, Liquidity, Valuation)
- Multi-select filters for tier, series, team
- Pagination and search

### MarketOverview.jsx
Cross-collection market snapshot aggregating data from all three platforms:
- Top movers by price change
- Most valuable editions
- Volume trend area charts with time range selectors
- Real-time market pulse with recent sales

### Rankings.jsx
Player/character rankings page with cross-platform aggregation:
- Market cap, floor price, sales volume per player
- Platform badges (TS/AD/PIN)
- Team filtering and search
- Sortable columns with pagination

### extension-tooltip.js
Browser extension tooltip renderer using Shadow DOM for complete CSS isolation:
- Closed Shadow DOM prevents marketplace page interference
- HTML-escaped content for XSS prevention
- Positioned as overlay matching card dimensions
- Displays floor price, estimated value, supply, tier, and deal signals
