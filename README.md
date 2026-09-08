# T.I V1 - Deriv Martingale Trading Bot

## Overview

T.I V1 is a sophisticated Martingale trading bot for Deriv's Digit Over/Under contracts. It features:

- **Smart Entry Point Logic**: Analyzes recent digit patterns before entering trades
- **Proper Stake Management**: Stake 1 for first trade, Stake 2 as permanent base afterward
- **Martingale Progression**: Doubles stake on losses, returns to base on wins
- **Risk Management**: Built-in Take Profit and Stop Loss controls
- **XML Configuration**: Fully configurable via XML strategy files
- **Paper & Live Trading**: Test safely in paper mode before going live

## Requirements

- Node.js 14+
- npm or yarn
- Deriv Account (Paper trading enabled by default)
- Deriv API Token (for live trading)

## Installation

```bash
git clone <repo-url>
cd deriv-martingale-bot
npm install
cp .env.example .env
```

## Configuration

### Strategy XML File

Create `config/strategy.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<strategy name="T.I V1" version="1.0">
  <!-- Market Configuration -->
  <market>
    <symbol>R_100</symbol>
    <contract_type>DIGITOVER</contract_type>
  </market>

  <!-- Entry Point Configuration -->
  <entry_point>
    <sample_size>10</sample_size>
    <barrier>5</barrier>
    <min_frequency>60</min_frequency>
    <confirmation_type>frequency</confirmation_type>
    <recent_digit_confirmation>true</recent_digit_confirmation>
  </entry_point>

  <!-- Stake Configuration -->
  <stakes>
    <stake_1>1.0</stake_1>
    <stake_2>2.0</stake_2>
    <martingale_multiplier>2.0</martingale_multiplier>
    <max_martingale_steps>4</max_martingale_steps>
  </stakes>

  <!-- Risk Management -->
  <risk_management>
    <take_profit>100.0</take_profit>
    <stop_loss>50.0</stop_loss>
  </risk_management>

  <!-- Contract Settings -->
  <contract>
    <duration>1</duration>
    <duration_unit>t</duration_unit>
  </contract>
</strategy>
```

## Usage

### Paper Trading (Simulated)

```bash
npm run paper
```

### Live Trading

```bash
# Update .env with your Deriv API token
npm run live
```

### Generate XML from Config

```bash
npm run generate-xml
```

### Run Tests

```bash
npm test
```

## Architecture

### Block Structure

1. **START**: Initialize bot and load configuration
2. **ENTRY POINT**: Analyze recent digits and confirm entry conditions
3. **PURCHASE CONDITION**: Verify all pre-trade requirements
4. **STAKE 1**: Use initial stake for first trade only
5. **STAKE 2**: Permanent base stake after first trade
6. **MARTINGALE**: Double stake on losses
7. **TAKE PROFIT**: Stop trading when profit target reached
8. **STOP LOSS**: Halt all trading when loss limit exceeded
9. **TRADE AGAIN**: Loop back to entry point after contract result
10. **RESTART**: Reset all state for new trading cycle

### Stake Flow Example

```
Trade 1: Stake 1 ($1)        [FIRST_TRADE]
Trade 2: Stake 2 ($2)        [WIN - Back to base]
Trade 3: Stake 2 × 2 ($4)    [LOSS - Martingale]
Trade 4: Stake 2 × 4 ($8)    [LOSS - Martingale]
Trade 5: Stake 2 ($2)        [WIN - Back to base]
```

## Entry Point Logic

The Entry Point analyzes recent completed digits:

1. **Collect Digits**: Maintains rolling list of last completed digits
2. **Count Frequency**: Calculates how often digits meet barrier condition
3. **Verify Confirmation**: Ensures frequency meets configured minimum
4. **Check Recent**: Optionally verifies recent digit confirms pattern
5. **Return Decision**: TRUE (enter) or FALSE (wait)

### Example: Digit Under 5

```
Recent digits: [7, 2, 8, 5, 9, 1, 6, 4, 8, 3]
Barrier: 5
Under 5: [2, 1, 4, 3] = 4/10 = 40%
Over 5: [7, 8, 9, 6, 8] = 5/10 = 50%

If min_frequency = 60%: NO ENTRY (only 40%)
If min_frequency = 40%: ENTRY ALLOWED
```

## Files

```
deriv-martingale-bot/
├── src/
│   ├── bot.js                 # Main bot engine
│   ├── derivClient.js         # Deriv API wrapper
│   ├── stakeManager.js        # Stake/martingale logic
│   ├── entryPoint.js          # Entry point analyzer
│   ├── strategyParser.js      # XML parser
│   ├── paperExchange.js       # Paper trading simulator
│   └── xmlGenerator.js        # Generate XML from config
├── config/
│   └── strategy.xml           # Strategy configuration
├── state/
│   └── bot-state.json         # Persisted bot state
├── tests/
│   ├── test-bot.js            # Integration tests
│   ├── test-stakes.js         # Stake logic tests
│   └── test-entry-point.js    # Entry point tests
├── logs/
│   └── bot.log                # Trading logs
├── python/
│   ├── analysis.py            # Digit analysis tools
│   └── backtest.py            # Backtesting script
├── package.json
├── .env.example
└── README.md
```

## Testing

### Test Stake Management

```bash
node tests/test-stakes.js
```

Expected output:
```
✓ Stake 1 only on first trade
✓ Stake 2 becomes base after first trade
✓ Martingale doubles on loss
✓ Returns to Stake 2 on win after martingale
✓ Never returns to Stake 1 after first trade
```

### Test Entry Point

```bash
node tests/test-entry-point.js
```

## Safety Features

- ✅ Validates all contract parameters before purchase
- ✅ Checks sufficient balance before placing orders
- ✅ Respects Take Profit and Stop Loss limits
- ✅ Prevents invalid stake calculations
- ✅ Logs all trades and decisions
- ✅ Graceful shutdown on errors
- ✅ State persistence for recovery

## Troubleshooting

### Bot not entering trades

1. Check Entry Point configuration
2. Verify `min_frequency` is realistic
3. Ensure `sample_size` has enough data
4. Check logs for "Entry condition not met"

### Stake calculation errors

1. Verify `stake_1` and `stake_2` values in XML
2. Check `martingale_multiplier` is > 1
3. Ensure balance is sufficient
4. Review logs for stake calculation details

### Connection issues (Live Mode)

1. Verify Deriv API token is valid
2. Check internet connection
3. Ensure `DERIV_APP_ID` is correct
4. Check Deriv API status

## Support

For issues or questions, please refer to the detailed logs in `logs/bot.log`.

## License

MIT
