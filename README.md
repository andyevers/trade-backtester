# Trade Backtester

Create trading strategies and run backtests.

-   **DO NOT MODIFY RETURNED OBJECTS** such as accounts, candles, positions, etc... this will alter the object stored in the broker. This is because returning references to already created objects is much faster than cloning every object.

## Additional Timeframes

-   Placing trades on additional timeframes will not be completely accurate. Unless the candle times are the same as the main candles, market orders will be placed on the next candle, or potentially expire if using orderDuration: DAY
-   StopLosses will always fire before takeProfit if both are hit in the same candle, providing sub-timeframes for the symbol will not change this.
-   Using multiple timeframes on the same symbol may cause accuracy issues. for example, if your main priceHistory is 'GM' 'day' and you provide AAPL 'month' and AAPL 'minute', the AAPL month and minute timeframes will fire in whatever order they were provided in the priceHistory array, activating triggers in unexpected orders.
-   When using sub-timeframes, candles will be combined to a single candle when activating triggers or getting price data. for example, if your main timeframe is 'day' and you also have 'hour4', 6 hour4 candles will be combined to activate triggers and get current price data for that symbol.
-   Triggers are activated while each new candle is being iterated, so when one trigger is activated (like a stopLoss or takeProfit), be aware that other candle data may not be updated yet.
-   Each trigger is only tested once per symbol. if you have AAPL 'day' and AAPL 'minute', triggers on symbol AAPL will be tested only using the main timeframe if present, or the first combined candle for AAPL

## TODO

### Changes

-   Maybe: Make Broker.ts unaware of EntityManager used by BacktestClient. It should send the data to BacktestClient where it then gets stored in the EntityManager repos. This way it will function the same as live clients, where entity manager is used for caching local data and the broker acts as a live broker.

-   The term "Order" and "Position" are being used for the same thing (closeOrder returns Position etc...). Change to make terms uniform.
-   `TriggerService.processCandle` is SUPER slow. fix this.
-   Maybe: We can shave of a few ms by setting repositories and services in the contructor rather than using getService and getRepository every time. possibly update this?

-   Cleanup TriggerRepository after adding indexIncrement and

### Additions

-   Add `BacktestResultsAnalyzer.ts`. See https://kernc.github.io/backtesting.py/ for example output.

-   In `Backtester.ts`, add function to run a strategy (fires init and next).

-   In `Backtester.ts`, add function to analyze strategy results. (consider adding a Results)

### Performance Improvements

-   Creating a candle copy in Timeline.candleGenerator takes about 10ms - 15ms for 70,000 iterations. This is only used to deal with current prices on alternate timeframes. find a faster way of doing this.
