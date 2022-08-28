import { Broker } from '@src/broker'
import { GetCandlesParams } from '@src/repository'
import { CloseOrderParams, PlaceOrderParams } from '@src/service'
import BaseClient, { BaseClientArgs } from './BaseClient'

export interface BacktestClientArgs extends BaseClientArgs {
	broker: Broker
}

/**
 * Data is automatically cached during backtesting, no fetching.
 */
export default class BacktestClient extends BaseClient {
	private readonly broker: Broker

	constructor(args: BacktestClientArgs) {
		const { broker, entityManager = broker.getEntityManager() } = args
		if (broker.getEntityManager() !== entityManager) {
			throw new Error('EntityManager mismatch')
		}
		super({ entityManager })
		this.broker = broker
	}

	//TODO: Make this get account and fire EventBus event.
	public fetchAccount(): void {}

	//TODO: Make this get price history and fire EventBus event.
	public fetchPriceHistory(params: GetCandlesParams): void {}

	public placeOrder(params: Omit<PlaceOrderParams, 'accountId'>): void {
		this.broker.placeOrder({
			orderType: 'MARKET',
			...params,
			accountId: this.accountId
		})
	}
	public closeOrder(params: Omit<CloseOrderParams, 'accountId'>): void {
		this.broker.closeOrder({
			...params,
			accountId: this.accountId
		})
	}
}
