import { CandleBySymbol } from '@src/types'
import {
	Account,
	EntityManager,
	Position,
	PositionCreateParams,
	PositionsById,
	PositionsByIdLookupFilters,
	PositionType,
	PriceHistory,
	PriceHistoryCreateParams,
	TimeframeType
} from '../repository'
import { ServiceManager } from '../service'
import Timeline, { NewCandleData } from './Timeline'

export interface BrokerArgs {
	entityManager: EntityManager
	serviceManager?: ServiceManager
	timeline?: Timeline
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
	priceHistoryAdditional?: PriceHistoryCreateParams[]
	startTime: number
}

/**
 * Mock broker for backtesting. Used with BacktestClient.
 */
export default class Broker {
	private readonly entityManager: EntityManager
	private readonly timeline: Timeline
	private readonly serviceManager: ServiceManager

	constructor(args: BrokerArgs) {
		const {
			entityManager,
			timeline = new Timeline(),
			serviceManager = new ServiceManager({ entityManager })
		} = args
		this.entityManager = entityManager
		this.timeline = timeline
		this.serviceManager = serviceManager
	}

	public getServiceManager(): ServiceManager {
		return this.serviceManager
	}

	public getTimeline(): Timeline {
		return this.timeline
	}

	public getEntityManager(): EntityManager {
		return this.entityManager
	}

	public init(params: BrokerInitParams): void {
		const { priceHistory, priceHistoryAdditional = [], startTime } = params

		if (startTime < priceHistory.candles[0].time) {
			throw new Error('Start time cannot be before the first candle time in price history')
		}

		this.timeline.setPriceHistory([priceHistory, ...priceHistoryAdditional])
		this.timeline.initFromPriceHistory(priceHistory.symbol, priceHistory.timeframe, {
			onNewCandle: this.onNewCandle,
			onNewCandleBuilt: this.onNewCandleBuilt
		})

		this.timeline.setStartTime(startTime)
	}

	private onNewCandleBuilt = (data: NewCandleData): void => {
		const { candle, symbol } = data
		const triggerService = this.serviceManager.getService('trigger')
		triggerService.processCandle(symbol, candle)
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
		const accountService = this.serviceManager.getService('account')
		const latestCandle = this.timeline.getLatestCandleBuilt(params.symbol)
		const orderTime = this.timeline.getTime()
		const order = accountService.placeOrder({ ...params, latestCandle, orderTime })
		return order
	}

	public getPriceHistory(params: GetCandlesParams): Omit<PriceHistory, 'id'> {
		const { symbol, timeframe } = params
		const priceHistoryRepository = this.entityManager.getRepository('priceHistory')
		const candles = priceHistoryRepository.getCandles(params)
		return { symbol, timeframe, candles }
	}

	public closeOrders(params: CloseOrderRequestParams): Position[] {
		const { positionId, accountId, status = 'OPEN_PENDING', type, symbol } = params
		const accountService = this.serviceManager.getService('account')
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
				accountService.closeOrder({ id: position.id, orderExitTime })
				closedOrders.push(position)
				continue
			}
			const orderExitPrice = position.type === 'LONG' ? quote.bid : quote.ask
			const latestCandle = this.timeline.getLatestCandleBuilt(position.symbol)
			accountService.closeOrder({ id: position.id, orderExitTime, orderExitPrice, latestCandle })
			closedOrders.push(position)
		}

		return closedOrders
	}

	public getPositions(params: PositionsByIdLookupFilters): PositionsById {
		const { accountId, status, type, symbol } = params
		const positionRepository = this.entityManager.getRepository('position')
		const positionsById = positionRepository.getByIdLookup({ accountId, status, type, symbol })

		return positionsById
	}

	/**
	 * TODO: remove this method. moved to BaseClient
	 */
	public getAccount(accountId: number): Account {
		const accountRepository = this.entityManager.getRepository('account')
		const account = accountRepository.get(accountId)

		if (!account) {
			throw new Error('Could not get account')
		}
		return account
	}

	public next(): CandleBySymbol | null {
		const hasMoreCandles = this.timeline.next()
		if (!hasMoreCandles) return null
		return this.timeline.getLatestCandlesBuilt()
	}
}
