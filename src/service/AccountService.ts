import {
	EntityManager,
	PositionType,
	PositionOrderType,
	PositionOrderDuration,
	Position
} from '../repository'
import { Candle } from '../types'
import PositionService from './PositionService'

export interface AccountServiceArgs {
	entityManager: EntityManager
	positionService: PositionService
}

export interface PlaceOrderAccountParams {
	accountId: number
	orderQty: number
	symbol: string
	type: PositionType
	orderTime: number
	orderPrice?: number
	orderType?: PositionOrderType
	orderDuration?: PositionOrderDuration
	stopLoss?: number | null
	takeProfit?: number | null
	trailingStop?: number | null
	latestCandle?: Candle | null
}

export interface CloseOrderAccountParams {
	id: number
	orderExitTime: number
	orderExitPrice?: number
	latestCandle?: Candle | null
}

export default class AccountService {
	private readonly entityManager: EntityManager
	private readonly positionService: PositionService

	constructor(args: AccountServiceArgs) {
		const { entityManager, positionService } = args
		this.entityManager = entityManager
		this.positionService = positionService
	}

	public executeOpenOrder(
		position: Position,
		curCandle: Candle,
		openPrice: number | null = null
	): Position<'OPEN'> {
		const { accountId, orderQty, status } = position as Position<'PENDING'>

		if (status !== 'PENDING') {
			throw new Error(`Cannot open order with status ${status}`)
		}

		// remove entry triggers
		this.positionService.removeTriggers(position)

		const positionRepository = this.entityManager.getRepository('position')
		const accountRepository = this.entityManager.getRepository('account')

		const account = accountRepository.get(accountId)

		if (!account) {
			throw new Error('unknown account id')
		}

		const price = openPrice !== null ? openPrice : curCandle.close
		const marketValue = price * orderQty

		positionRepository.update(position.id, {
			status: 'OPEN',
			qty: orderQty,
			entryPrice: price,
			entryTime: curCandle.time,
			cost: marketValue
		})

		if (position.type === 'LONG') {
			accountRepository.update(account.id, {
				cash: account.cash - marketValue
			})
		} else {
			accountRepository.update(account.id, {
				marginDebt: account.marginDebt + marketValue
			})
		}

		// add trailingStop, stopLoss, takeProfit
		this.positionService.addExitTriggers(position)
		return position
	}

	public executeCloseOrder(
		position: Position,
		curCandle: Candle,
		closePrice: number | null = null
	): Position<'CLOSED' | 'CANCELED'> {
		const { accountId, qty, status, type } = position as Position<'OPEN' | 'PENDING'>

		if (status !== 'OPEN' && status !== 'PENDING') {
			throw new Error(`Cannot close order with status ${status}`)
		}

		// remove any remaining triggers stopLoss, takeProfit, etc...
		this.positionService.removeTriggers(position)

		const positionRepository = this.entityManager.getRepository('position')
		const accountRepository = this.entityManager.getRepository('account')

		const account = accountRepository.get(accountId)

		if (!account) {
			throw new Error('unknown account id')
		}

		const price = closePrice !== null ? closePrice : curCandle.close
		const marketValue = price * (qty || 0)
		const cost = position.cost as number
		const exitProfit = type === 'LONG' ? marketValue - cost : cost - marketValue

		// if position is open, set to closed, if pending, canceled.
		if (status === 'OPEN') {
			positionRepository.update(position.id, {
				status: 'CLOSED',
				exitPrice: price,
				exitTime: curCandle.time,
				exitProfit: exitProfit
			})
		} else {
			positionRepository.update(position.id, {
				status: 'CANCELED',
				cancelTime: curCandle.time
			})
		}

		if (position.type === 'LONG') {
			accountRepository.update(account.id, {
				cash: account.cash + marketValue
			})
		} else {
			accountRepository.update(account.id, {
				marginDebt: account.marginDebt - cost,
				cash: account.cash + exitProfit
			})
		}

		return position
	}

	private createPendingOrder(
		params: Omit<Required<PlaceOrderAccountParams>, 'latestCandle'>
	): Position<'PENDING'> {
		const positionRepository = this.entityManager.getRepository('position')
		const position = positionRepository.create({ ...params, status: 'PENDING' })
		return position
	}

	public placeOrder(params: PlaceOrderAccountParams): Position {
		const {
			accountId,
			orderQty,
			symbol,
			type,
			orderTime,
			orderDuration = 'GOOD_TILL_CANCEL',
			orderType = 'MARKET',
			latestCandle = null,
			orderPrice = orderType === 'MARKET' ? latestCandle?.close || null : null,
			stopLoss = null,
			takeProfit = null,
			trailingStop = null
		} = params

		const isMismatchTime = latestCandle !== null && latestCandle.time !== orderTime

		if (isMismatchTime && orderTime < latestCandle.time) {
			throw new Error('Cannot place orders in the past.')
		}

		if (orderPrice === null) {
			throw new Error('orderPrice must be provided when placing non-market orders')
		}

		const position = this.createPendingOrder({
			accountId,
			orderQty,
			orderTime,
			symbol,
			type,
			orderDuration,
			orderPrice,
			orderType,
			stopLoss,
			takeProfit,
			trailingStop
		})

		if (orderType === 'MARKET' && latestCandle && !isMismatchTime) {
			return this.executeOpenOrder(position, latestCandle)
		} else {
			this.positionService.addEntryTriggers(position)
		}

		return position
	}

	public closeOrder(params: CloseOrderAccountParams): Position {
		const { id, orderExitTime, latestCandle = null, orderExitPrice = latestCandle?.time || null } = params

		const isMismatchTime = latestCandle && latestCandle.time !== orderExitTime
		const position = this.entityManager.getRepository('position').get(id)

		// if it is pending, the order may not have encountered any candles yet, so a closeMarket trigger will be created.
		if (orderExitPrice === null && position?.status !== 'PENDING') {
			throw new Error('orderExitPrice must be provided when latestCandle candle is not provided')
		}

		if (!position) {
			throw new Error('unknown position id')
		}

		if (latestCandle && !isMismatchTime) {
			// triggers are removed in executeCloseOrder
			return this.executeCloseOrder(position, latestCandle)
		} else {
			this.positionService.removeTriggers(position)
			this.positionService.setPositionTrigger('closeMarket', {
				positionId: position.id,
				symbol: position.symbol,
				positionType: position.type,
				price: 0
			})
		}

		return position
	}
}
