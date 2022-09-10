import {
	Account,
	AddCandleParams,
	EntityManager,
	GetCandlesParams,
	Position,
	PositionOrderDuration,
	PositionOrderType,
	PositionsById,
	PositionsByIdLookupFilters,
	PositionType,
	PriceHistory,
	RepositoriesByName
} from '@src/repository'
import { Candle } from '@src/types'
import { EventBus } from '@src/events'

export interface BaseClientArgs {
	entityManager?: EntityManager
	eventBus?: EventBus<ClientEvents>
	accountId?: number
}

export interface FetchPositionsParams extends Omit<PositionsByIdLookupFilters, 'accountId'> {}

type ClientResponseData<T extends Record<string, any>> =
	| {
			headers: Record<string, string | number>
			data: T
			status: 'success'
	  }
	| {
			headers: Record<string, string | number>
			data: {
				error: string
			}
			status: 'error'
	  }

export type ResponseFetchPositions = ClientResponseData<PositionsById>
export type ResponseFetchAccount = ClientResponseData<Account>
export type ResponseFetchPriceHistory = ClientResponseData<Omit<PriceHistory, 'id'>>
export type ResponsePlaceOrder = ClientResponseData<Position>
export type ResponseCloseOrders = ClientResponseData<Position[]>

export interface HasPositionsParams {
	symbol?: string
	type?: PositionType
	status?: 'OPEN' | 'PENDING' | 'OPEN_PENDING'
}

export interface PlaceOrderParams {
	orderQty: number
	symbol: string
	type: PositionType
	orderType?: PositionOrderType
	orderDuration?: PositionOrderDuration
	stopLoss?: number | null
	takeProfit?: number | null
	trailingStop?: number | null
}

export interface CloseOrdersParams {
	positionId?: number
	symbol?: string
	type?: PositionType
	status?: 'OPEN' | 'PENDING' | 'OPEN_PENDING'
}

export type ClientEvents = {
	responsePlaceOrder: ResponsePlaceOrder
	responseCloseOrder: ResponseCloseOrders
	responseFetchPriceHistory: ResponseFetchPriceHistory
	responseFetchAccount: ResponseFetchAccount
	responseFetchPositions: ResponseFetchPositions
}

// TODO: Add EventBus to capture response from async methods.

export default abstract class BaseClient {
	protected accountId: number
	protected readonly entityManager: EntityManager
	protected readonly eventBus: EventBus<ClientEvents>

	constructor(args: BaseClientArgs) {
		const { entityManager = new EntityManager(), eventBus = new EventBus(), accountId = 1 } = args
		this.entityManager = entityManager
		this.eventBus = eventBus
		this.accountId = accountId
	}

	/**
	 * Fetches account from the server and caches it.
	 * After cache, Response is to ResponseFetchAccount and calls EventBus
	 */
	public abstract fetchPositions(params: FetchPositionsParams): void

	/**
	 * Fetches account from the server and caches it.
	 * After cache, Response is to ResponseFetchAccount and calls EventBus
	 */
	public abstract fetchAccount(): void

	/**
	 * Fetches priceHistory from the server and caches it.
	 * After cache, Response is to ResponseFetchPriceHistory and calls EventBus
	 */
	public abstract fetchPriceHistory(params: GetCandlesParams): void

	/**
	 * Sends order to the server. Does not wait for response.
	 * After cache, Response is to ResponsePlaceOrder and calls EventBus
	 */
	public abstract placeOrder(params: PlaceOrderParams): void

	/**
	 * Sends close orders to the server. Does not wait for response.
	 * After cache, Response is to ResponseCloseOrders and calls EventBus
	 */
	public abstract closeOrders(params: CloseOrdersParams): void

	/**
	 * Stores an entity in a repository.
	 */
	private cacheEntity<T extends keyof RepositoriesByName>(
		repositoryName: T,
		entity: ReturnType<RepositoriesByName[T]['create']>
	) {
		const repository = this.entityManager.getRepository(repositoryName)
		const cachedEntity = repository.get(entity.id)
		if (cachedEntity) {
			repository.update(cachedEntity.id, entity as any)
		} else {
			repository.import(entity as any)
		}
	}

	protected cacheAccount(account: Account): void {
		this.cacheEntity('account', account)
	}

	protected cachePosition(position: Position): void {
		this.cacheEntity('position', position)
	}

	protected cachePriceHistory(priceHistory: PriceHistory): void {
		this.cacheEntity('priceHistory', priceHistory)
	}

	protected cachePriceHistoryAdd(priceHistory: Omit<PriceHistory, 'id'>): void {
		const { symbol, timeframe, candles } = priceHistory
		const priceHistoryRepository = this.entityManager.getRepository('priceHistory')
		priceHistoryRepository.addCandles({ symbol, timeframe, candles })
	}

	public getEventBus(): EventBus<ClientEvents> {
		return this.eventBus
	}

	/**
	 * Returns account from latest fetch.
	 */
	public getAccount(): Account {
		const accountRepository = this.entityManager.getRepository('account')
		const account = accountRepository.get(this.accountId)
		if (!account) {
			throw new Error('Account not found')
		}
		return account
	}

	public getPosition(positionId: number): Position {
		const positionRepository = this.entityManager.getRepository('position')
		const position = positionRepository.get(positionId)
		if (!position) {
			throw new Error('Position not found')
		}
		return position
	}

	public getPositions(filters: Omit<PositionsByIdLookupFilters, 'accountId'> = {}): PositionsById {
		const positionRepository = this.entityManager.getRepository('position')
		return positionRepository.getByIdLookup({ ...filters, accountId: this.accountId })
	}

	public hasPositions(params: HasPositionsParams): boolean {
		const { status, type, symbol } = params
		const positionRepository = this.entityManager.getRepository('position')
		const positionsById = positionRepository.getByIdLookup({
			accountId: this.accountId,
			status,
			type,
			symbol
		})

		for (const _ in positionsById) return true
		return false
	}

	/**
	 * Gets candles for given symbol and timeframe.
	 * Note that getting all candles is much faster than filtering by date. (doesn't require Array.slice)
	 *
	 * WARNING: Do not modify the returned array. It will alter the past candles stored in the broker timeline.
	 */
	public getCandles(params: GetCandlesParams): Candle[] {
		const { symbol, timeframe, startTime, endTime } = params
		const priceHistoryRepository = this.entityManager.getRepository('priceHistory')

		const candles = priceHistoryRepository.getBySymbolTimeframe(symbol, timeframe)?.candles
		if ((startTime === undefined && endTime === undefined) || !candles) return candles || []

		let indexFirstCandle = 0
		let indexLastCandle = candles.length - 1

		if (startTime) {
			indexFirstCandle = priceHistoryRepository.getIndexNearTime({
				symbol,
				timeframe,
				time: startTime
			}) as number
		}

		if (endTime) {
			indexLastCandle = priceHistoryRepository.getIndexNearTime({
				symbol,
				timeframe,
				time: endTime
			}) as number
		}

		return candles.slice(indexFirstCandle, indexLastCandle + 1)
	}

	public getPriceHistory(params: GetCandlesParams): PriceHistory | null {
		const { symbol, timeframe } = params
		const priceHistoryRepository = this.entityManager.getRepository('priceHistory')
		const priceHistory = priceHistoryRepository.getBySymbolTimeframe(symbol, timeframe)
		if (!priceHistory) return null
		return {
			id: priceHistory.id,
			symbol,
			timeframe,
			candles: this.getCandles(params)
		}
	}

	public cacheCandle(params: AddCandleParams): void {
		const { symbol, timeframe, candle } = params
		const priceHistoryRepository = this.entityManager.getRepository('priceHistory')
		const priceHistory = priceHistoryRepository.getBySymbolTimeframe(symbol, timeframe)
		if (!priceHistory) return
		priceHistoryRepository.addCandle({ symbol, timeframe, candle })
	}

	public setAccountId(accountId: number): void {
		this.accountId = accountId
	}
}
