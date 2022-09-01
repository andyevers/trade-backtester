import {
	EntityManager,
	TimeframeType,
	Account,
	PositionsById,
	PositionType,
	PositionCreateParams,
	Position,
	PriceHistoryCreateParams,
	AccountCreateParams
} from '../repository'
import { PositionService, AccountService, TriggerService } from '../service'
import { Candle } from '../types'
import Timeline, { NewCandleData } from './Timeline'

export interface BrokerArgs {
	entityManager: EntityManager
	timeline: Timeline
	positionService: PositionService
	accountService: AccountService
	triggerService: TriggerService
}

export interface GetCandlesParams {
	startTime?: number
	endTime?: number
	symbol: string
	timeframe: TimeframeType
}

export interface AccountWithPositions extends Account {
	positionsById: PositionsById
}

export interface CloseOrderRequestParams {
	accountId: number
	positionId?: number
	symbol?: string
	type?: PositionType
	status?: 'OPEN' | 'PENDING' | 'OPEN_PENDING'
}

export interface HasPositionsParams {
	accountId: number
	symbol?: string
	type?: PositionType
	status?: 'OPEN' | 'PENDING' | 'OPEN_PENDING'
}

export interface PlaceOrderRequestParams
	extends Omit<PositionCreateParams, 'orderTime' | 'orderPrice' | 'status'> {
	orderPrice?: number
}

export interface Quote {
	bid: number
	ask: number
	time: number
}

export interface BrokerInitParams {
	priceHistory: PriceHistoryCreateParams
	priceHistoryAddional?: PriceHistoryCreateParams[]
	accountIds: number[]
	startTime: number
}

/**
 * Mock broker for backtesting. Used with BacktestClient.
 */
export default class Broker {
	private readonly entityManager: EntityManager
	private readonly accountService: AccountService
	private readonly timeline: Timeline
	private readonly triggerService: TriggerService

	constructor(args: BrokerArgs) {
		const { entityManager, timeline, accountService, triggerService } = args
		this.entityManager = entityManager
		this.accountService = accountService
		this.timeline = timeline
		this.triggerService = triggerService
	}

	public getEntityManager(): EntityManager {
		return this.entityManager
	}

	public init(params: BrokerInitParams): void {
		const { priceHistory, priceHistoryAddional = [], accountIds, startTime } = params

		if (startTime < priceHistory.candles[0].time) {
			throw new Error('Start time cannot be before the first candle time in price history')
		}

		const accountRepository = this.entityManager.getRepository('account')

		const accounts: Account[] = []
		for (const accountId of accountIds) {
			const account = accountRepository.get(accountId)
			if (account) accounts.push(account)
		}

		this.timeline.setPriceHistory([...priceHistoryAddional, priceHistory])
		this.timeline.initFromPriceHistory(priceHistory.symbol, priceHistory.timeframe, {
			onNewCandle: this.onNewCandle,
			onNewCandleBuilt: this.onNewCandleBuilt
		})

		this.timeline.setStartTime(startTime)
	}

	// must be arrow function to pass to next()
	private onNewCandleBuilt = (data: NewCandleData): void => {
		const { candle, symbol } = data
		this.triggerService.processCandle(symbol, candle)
	}

	private onNewCandle = (data: NewCandleData): void => {
		const { candle, symbol, timeframe } = data
		const priceHistoryRepository = this.entityManager.getRepository('priceHistory')
		priceHistoryRepository.addCandle({ symbol, timeframe, candle })
	}

	/**
	 * TODO: Currently, does not support spread.
	 * will need to update functions using candle close price as current price
	 */
	public getQuote(symbol: string): Quote | null {
		const latestCandle = this.timeline.getLatestCandleBuilt(symbol)
		if (!latestCandle) return null
		const { close, time } = latestCandle
		return { ask: close, bid: close, time: time }
	}

	public placeOrder(params: PlaceOrderRequestParams): Position {
		const latestCandle = this.timeline.getLatestCandleBuilt(params.symbol)
		const orderTime = this.timeline.getTime()
		const order = this.accountService.placeOrder({ ...params, latestCandle, orderTime })
		return order
	}

	public closeOrder(params: CloseOrderRequestParams): Position[] {
		const { positionId, accountId, status = 'OPEN_PENDING', type, symbol } = params
		const positionRepository = this.entityManager.getRepository('position')

		const orderExitTime = this.timeline.getTime()
		const positionFromId = typeof positionId === 'number' ? positionRepository.get(positionId) : null
		const positionsById = positionFromId
			? { [positionFromId.id]: positionFromId }
			: positionRepository.getByIdLookup({ accountId, status, type, symbol })

		const closedOrders = []
		for (const id in positionsById) {
			const position = positionsById[id]
			const quote = this.getQuote(position.symbol)
			if (!quote) {
				// no quote when there are no past candles found for that symbol. places a market close order that will be triggered
				// when a candle appears.
				this.accountService.closeOrder({ id: position.id, orderExitTime })
				closedOrders.push(position)
				continue
			}
			const orderExitPrice = position.type === 'LONG' ? quote.bid : quote.ask
			const latestCandle = this.timeline.getLatestCandleBuilt(position.symbol)
			this.accountService.closeOrder({ id: position.id, orderExitTime, orderExitPrice, latestCandle })
			closedOrders.push(position)
		}

		return closedOrders
	}

	/**
	 * TODO: remove this method. moved to BaseClient
	 */
	public hasPositions(params: HasPositionsParams): boolean {
		const { accountId, status, type, symbol } = params
		const positionRepository = this.entityManager.getRepository('position')
		const positionsById = positionRepository.getByIdLookup({ accountId, status, type, symbol })

		for (const _ in positionsById) return true
		return false
	}

	/**
	 * TODO: remove this method. moved to BaseClient
	 */
	public getAccount(accountId: number): AccountWithPositions {
		const accountRepository = this.entityManager.getRepository('account')
		const positionRepository = this.entityManager.getRepository('position')

		const account = accountRepository.get(accountId)
		const positionsById = positionRepository.getByIdLookup({ accountId })

		if (!account) {
			throw new Error('Could not get account')
		}
		return { ...account, positionsById }
	}

	public next(): boolean {
		const hasMoreCandles = this.timeline.next()
		if (!hasMoreCandles) return false
		return true
	}
}
