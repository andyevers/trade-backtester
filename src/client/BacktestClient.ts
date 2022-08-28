import { Account, GetCandlesParams, PriceHistory } from '@src/repository'
import { PlaceOrderParams, CloseOrderParams } from '@src/service'
import BaseClient, { BaseClientArgs } from './BaseClient'

class BacktestClient extends BaseClient {
	constructor(args?: BaseClientArgs) {
		super(args)
	}

	public async fetchAccount(): Promise<Account> {
		return new Promise((resolve) => {
			resolve(this.getAccount())
		})
	}

	public async fetchPriceHistory(params: GetCandlesParams): Promise<PriceHistory> {
		return new Promise((resolve, reject) => {
			const priceHistory = this.getPriceHistory(params)
			if (priceHistory) resolve(priceHistory)
			else reject('Price history not found')
		})
	}

	public placeOrder(params: PlaceOrderParams): void {
		console.log('placeOrder', params)
	}
	public closeOrder(params: CloseOrderParams): void {
		console.log('closeOrder', params)
	}
}
