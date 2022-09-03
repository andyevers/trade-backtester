import { BaseClient } from '@src/client'
import { CandleBySymbol } from '@src/types'

/**
 * Both init and next should be syncrhonous to keep backtesting as fast as possible.
 * Init is called once when the strategy is first initialized. This should be used to
 * setup your strategy with a chart analyzer, add event listeners, etc...
 *
 * Any asyncrounous operations (such as fetching data using the client) should be done
 * in init or an event listener. Responses should also be handled in an event listener.
 * All fetched data should be stored in the EntityManager repos for usage in syncronous
 * calls (Client.getAccounts, Client.getCandles, etc...). Client fetch operations are
 * syncrounous in the backtest client only, so treat them as async operations.
 */
export interface Strategy {
	init(client: BaseClient): void
	next(candleBySymbol: CandleBySymbol): void
}

export default class DemoStrategy implements Strategy {
	private client!: BaseClient

	init(client: BaseClient): void {
		this.client = client
	}

	next(candleBySymbol: CandleBySymbol): void {
		for (const symbol in candleBySymbol) {
			const candle = candleBySymbol[symbol]
			if (candle.close < 4) {
				this.client.placeOrder({
					symbol,
					orderQty: 30,
					type: 'LONG',
					takeProfit: 5
				})
			}
		}
	}
}
