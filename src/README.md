# TradeShark Backtester

## Todo

-   DO NOT MODIFY RETURNED OBJECTS such as accounts, candles, positions, etc... this will alter the object stored in the broker. This is because returning references to already created objects is much faster than cloning every object.

## Additional Timeframes

-   Placing trades on additional timeframes will not be completely accurate. Unless the candle times are the same as the main candles, market orders will be placed on the next candle, or potentially expire if using orderDuration: DAY
-   StopLosses will always fire before takeProfit if both are hit in the same candle, providing sub-timeframes for the symbol will not change this.
-   Using multiple timeframes on the same symbol may cause accuracy issues. for example, if your main priceHistory is 'GM' 'day' and you provide AAPL 'month' and AAPL 'minute', the AAPL month and minute timeframes will fire in whatever order they were provided in the priceHistory array, activating triggers in unexpected orders.
-   When using sub-timeframes, candles will be combined to a single candle when activating triggers or getting price data. for example, if your main timeframe is 'day' and you also have 'hour4', 6 hour4 candles will be combined to activate triggers and get current price data for that symbol.
-   Triggers are activated while each new candle is being iterated, so when one trigger is activated (like a stopLoss or takeProfit), be aware that other candle data may not be updated yet.
-   Each trigger is only tested once per symbol. if you have AAPL 'day' and AAPL 'minute', triggers on symbol AAPL will be tested only using the timeframe if present, or the first combined candle for AAPL
