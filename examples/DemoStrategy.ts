import { BaseClient } from '@src/client'
import { CandleBySymbol, Strategy } from '@src/types'

// TODO: complete this example
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
