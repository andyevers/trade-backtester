import { Broker } from '@src/broker'
import { GetCandlesParams } from '@src/repository'
import { CloseOrdersParams, PlaceOrderParams } from '@src/service'
import BaseClient, { BaseClientArgs, FetchPositionsParams } from './BaseClient'
import EventBus from './EventBus'

export interface BacktestClientArgs extends BaseClientArgs {
	broker: Broker
}

/**
 * Data is automatically cached during backtesting, no fetching.
 */
export default class BacktestClient extends BaseClient {
	private readonly broker: Broker

	constructor(args: BacktestClientArgs) {
		const { broker, entityManager = broker.getEntityManager(), eventBus = new EventBus() } = args
		if (broker.getEntityManager() !== entityManager) {
			throw new Error('EntityManager mismatch')
		}

		super({ entityManager, eventBus })
		this.broker = broker
	}

	public fetchPositions(params: FetchPositionsParams): void {
		const positions = this.broker.getPositions({
			...params,
			accountId: this.accountId
		})

		this.eventBus.dispatch('responseFetchPositions', {
			headers: {},
			status: 'success',
			data: positions
		})
	}

	public fetchAccount(): void {
		const account = this.broker.getAccount(this.accountId)
		this.eventBus.dispatch('responseFetchAccount', {
			headers: {},
			status: 'success',
			data: account
		})
	}

	public fetchPriceHistory(params: GetCandlesParams): void {
		const priceHistory = this.broker.getPriceHistory(params)
		this.eventBus.dispatch('responseFetchPriceHistory', {
			headers: {},
			status: 'success',
			data: priceHistory
		})
	}

	public placeOrder(params: Omit<PlaceOrderParams, 'accountId'>): void {
		const position = this.broker.placeOrder({
			orderType: 'MARKET',
			...params,
			accountId: this.accountId
		})

		this.eventBus.dispatch('responsePlaceOrder', {
			headers: {},
			status: 'success',
			data: position
		})
	}

	public closeOrders(params: Omit<CloseOrdersParams, 'accountId'>): void {
		const positions = this.broker.closeOrders({
			...params,
			accountId: this.accountId
		})

		this.eventBus.dispatch('responseCloseOrder', {
			headers: {},
			status: 'success',
			data: positions
		})
	}
}
