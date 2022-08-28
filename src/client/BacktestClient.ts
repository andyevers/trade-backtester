import { Account, GetCandlesParams, PriceHistory } from '@src/repository'
import { PlaceOrderParams, CloseOrderParams } from '@src/service'
import BaseClient, { BaseClientArgs } from './BaseClient'

class BacktestClient extends BaseClient {
	constructor(args: BaseClientArgs) {
		super(args)
	}

	public fetchAccount(): void {
		//TODO: Make this get account and fire EventBus event.
	}

	public fetchPriceHistory(params: GetCandlesParams): void {
		//TODO: Make this get price history and fire EventBus event.
	}

	public placeOrder(params: PlaceOrderParams): void {
		console.log('placeOrder', params)
	}
	public closeOrder(params: CloseOrderParams): void {
		console.log('closeOrder', params)
	}
}
