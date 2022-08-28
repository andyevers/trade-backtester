import { HasPositionsParams } from '../broker'
import {
	Account,
	Entity,
	EntityManager,
	GetCandlesParams,
	Position,
	PositionsById,
	PositionsByIdLookupFilters,
	PriceHistory,
	RepositoriesByName,
	TimeframeType
} from '../repository'
import { CloseOrderParams, PlaceOrderParams } from '../service'
import { Candle } from '../types'

export interface BaseClientArgs {
	entityManager?: EntityManager
}
export default abstract class BaseClient {
	private readonly entityManager: EntityManager
	private readonly accountId: number

	constructor(args?: BaseClientArgs) {
		this.entityManager = args?.entityManager || new EntityManager()
		// TODO: get accountId from entityManager
		this.accountId = 1
	}

	/**
	 * Fetches account from the server and caches it.
	 */
	public abstract fetchAccount(): Promise<Account>

	/**
	 * Fetches priceHistory from the server and caches it.
	 */
	public abstract fetchPriceHistory(params: GetCandlesParams): Promise<PriceHistory>

	/**
	 * Sends order to the server. Does not wait for response.
	 */
	public abstract placeOrder(params: PlaceOrderParams): void

	/**
	 * Sends close order to the server. Does not wait for response.
	 */
	public abstract closeOrder(params: CloseOrderParams): void

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

	public getPositions(filters: PositionsByIdLookupFilters): PositionsById {
		const positionRepository = this.entityManager.getRepository('position')
		return positionRepository.getByIdLookup(filters)
	}

	public hasPositions(params: HasPositionsParams): boolean {
		const { accountId, status, type, symbol } = params
		const positionRepository = this.entityManager.getRepository('position')
		const positionsById = positionRepository.getByIdLookup({ accountId, status, type, symbol })

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

	// TODO: make this push candles to priceHistoryRepository
	public addCandles(params: any): void {
		const { symbol, timeframe, candles } = params
		const priceHistoryRepository = this.entityManager.getRepository('priceHistory')
		const priceHistory = priceHistoryRepository.getBySymbolTimeframe(symbol, timeframe)
		if (!priceHistory) return
		priceHistoryRepository.addCandles({ symbol, timeframe, candles })
	}
}