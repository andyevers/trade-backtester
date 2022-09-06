# Trade Backtester

Create trading strategies and run backtests.

## Development & Strategy Creation Rules

Speed is a top priority. Code can execute hundreds of thousands of times syncronously while testing hundreds of strategies, so every ms counts. Record performance checks after adding to code. generally, do 100,000 executions `performance.test.ts`

### Function Usage

-   Avoid `Array` functions that require reindexing (slice, shift, etc...) pretty much just allow pop()
-   Avoid `Math` functions, just manually do calculations
-   Avoid spread operator ({ ...variable })

### Loops

-   Never loop over all candles
-   If searching for an item, consider using binary search (see `PriceHistoryRepository.getIndexNearTime`)
-   Implement checks to skip unnecessary loops (see `TriggerRepository.getTriggerLine`)
-   If filtering items, consider indexing them to avoid iterating over all items (see `PositionRepository.getByIdLookup`)

### Misc

-   Avoid creating huge indexes... I tried indexing candles by time and it slowed things down a lot. binary search ended up being a lot faster.
-   **Do not modify returned objects** such as accounts, candles, positions, etc... this will alter the object stored in the repositories. This is because returning references to already created objects is much faster than cloning every object.

## Notes

### Additional Timeframes In Backtests

-   Placing trades on additional timeframes will not be completely accurate. Unless the candle times are the same as the main candles, market orders will be placed on the next candle, or potentially expire if using orderDuration: DAY
-   StopLosses will always fire before takeProfit if both are hit in the same candle, providing sub-timeframes for the symbol will not change this.
-   Using multiple timeframes on the same symbol may cause accuracy issues. for example, if your main priceHistory is 'GM' 'day' and you provide AAPL 'month' and AAPL 'minute', the AAPL month and minute timeframes will fire in whatever order they were provided in the priceHistory array, activating triggers in unexpected orders.
-   When using sub-timeframes, candles will be combined to a single candle when activating triggers or getting price data. for example, if your main timeframe is 'day' and you also have 'hour4', 6 hour4 candles will be combined to activate triggers and get current price data for that symbol.
-   Triggers are activated while each new candle is being iterated, so when one trigger is activated (like a stopLoss or takeProfit), be aware that other candle data may not be updated yet.
-   Each trigger is only tested once per symbol. if you have AAPL 'day' and AAPL 'minute', triggers on symbol AAPL will be tested only using the main timeframe if present, or the first combined candle for AAPL

## Todo

### Changes

-   [x] `TriggerService.processCandle` is SUPER slow. fix this.
-   [ ] The term "Order" and "Position" are being used for the same thing (closeOrder returns Position etc...). Change to make terms uniform.
-   [ ] Creating a candle copy in Timeline.candleGenerator takes about 10ms - 15ms for 70,000 iterations. This is only used to deal with current prices on alternate timeframes. find a faster way of doing this.
-   [ ] inactive triggers are currently not in use. Delete deactivate triggers and related methods in `TriggerRepository`
-   [ ] Remove event listeners from StrategyResultsAnalyzer and move to Backtester. Instead of using the addCandles event listener to watch each iteration, add a callback inside Backtester.runTest which should fire after strategy.next.

### Additions

-   [x] In `Backtester.ts`, add function to run a strategy (fires init and next).
-   [ ] Add `StrategyResultsAnalyzer.ts`. See https://kernc.github.io/backtesting.py/ for example output.
-   [ ] In `Timeline.ts`, make reset() change things back to original state after settings start time. Keep in mind this may run hundreds or thousands of times syncronously while testing multiple strategies.
