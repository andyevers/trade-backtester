import TriggerService from '@src/service/TriggerService'
import { Candle } from '@src/types'
import { Account } from '../repository/AccountRepository'
import EntityManager from '../repository/EntityManager'
import { Position, PositionCreateParams, PositionsById, PositionType } from '../repository/PositionRepository'
import { TimeframeType } from '../repository/PriceHistoryRepository'
import AccountService from '../service/AccountService'
import PositionService from '../service/PositionService'
import Timeline, { NewCandleData } from './Timeline'

interface BrokerArgs {
	entityManager: EntityManager
	timeline: Timeline
	positionService: PositionService
	accountService: AccountService
	triggerService: TriggerService
}

interface GetCandlesParams {
	startTime?: number
	endTime?: number
	symbol: string
	timeframe: TimeframeType
}

interface AccountWithPositions extends Account {
	positionsById: PositionsById
}

interface CloseOrderRequestParams {
	accountId: number
	positionId?: number
	symbol?: string
	type?: PositionType
	status?: 'OPEN' | 'PENDING' | 'OPEN_PENDING'
}

interface HasPositionsParams {
	accountId: number
	symbol?: string
	type?: PositionType
	status?: 'OPEN' | 'PENDING' | 'OPEN_PENDING'
}

interface PlaceOrderBrokerParams extends Omit<PositionCreateParams, 'orderTime' | 'orderPrice' | 'status'> {
	orderPrice?: number
}

interface Quote {
	bid: number
	ask: number
	time: number
}

export default class Broker {
	private readonly entityManager: EntityManager
	private readonly accountService: AccountService
	private readonly timeline: Timeline
	private readonly triggerService: TriggerService

	constructor(args?: BrokerArgs) {
		const {
			entityManager = EntityManager.instance(),
			timeline = Timeline.instance(),
			accountService = new AccountService(),
			triggerService = new TriggerService()
		} = args || {}
		this.entityManager = entityManager
		this.accountService = accountService
		this.timeline = timeline
		this.triggerService = triggerService
	}

	// must be arrow function to pass to next()
	private onNewCandle = (data: NewCandleData): void => {
		const { candle, symbol } = data
		this.triggerService.processCandle(symbol, candle)
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

	/**
	 * Gets past candles for given symbol and timeframe.
	 * Note that getting all candles is much faster than filtering by date. (doesn't require Array.slice)
	 *
	 * WARNING: Do not modify the returned array. It will alter the past candles stored in the broker timeline.
	 */
	public getCandles(params: GetCandlesParams): Candle[] {
		const { symbol, timeframe, startTime, endTime } = params
		const candles = this.timeline.getCandles(symbol, timeframe, 'past')

		const currentTime = this.timeline.getTime()
		const hasPastStartTime = typeof startTime === 'number' && startTime < currentTime
		const hasPastEndTime = typeof endTime === 'number' && endTime < currentTime

		if (!hasPastStartTime && !hasPastEndTime) return candles

		const indexStart = hasPastStartTime
			? this.timeline.getIndexAtTime({ time: startTime, symbol, timeframe }) || 0
			: 0

		const indexEnd = hasPastEndTime
			? (this.timeline.getIndexAtTime({ time: endTime, symbol, timeframe }) || candles.length - 1) + 1
			: candles.length

		return indexStart === 0 && indexEnd === candles.length ? candles : candles.slice(indexStart, indexEnd)
	}

	public placeOrder(params: PlaceOrderBrokerParams): Position {
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

	public hasPositions(params: HasPositionsParams): boolean {
		const { accountId, status, type, symbol } = params
		const positionRepository = this.entityManager.getRepository('position')
		const positionsById = positionRepository.getByIdLookup({ accountId, status, type, symbol })

		for (const _ in positionsById) return true
		return false
	}

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
		if (!this.timeline.next(this.onNewCandle)) return false
		return true
	}
}
