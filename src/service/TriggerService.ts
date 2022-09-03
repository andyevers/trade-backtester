import { EntityManager, Trigger, Position, PositionType } from '../repository'
import { Candle } from '../types'
import AccountService from './AccountService'

interface TriggerServiceArgs {
	entityManager: EntityManager
	accountService: AccountService
}

type OnTriggerCallback = (trigger: Trigger) => void

export default class TriggerService {
	private readonly entityManager: EntityManager
	private readonly accountService: AccountService

	constructor(args: TriggerServiceArgs) {
		const { entityManager, accountService } = args
		this.entityManager = entityManager
		this.accountService = accountService
	}

	private lastTriggerIndexBySymbol: { [symbol: string]: number } = {}

	/**
	 * Currently only processes position triggers. Must update if other trigger types are added.
	 */
	public processCandle(symbol: string, candle: Candle, onTrigger?: OnTriggerCallback): void {
		const triggerRepository = this.entityManager.getRepository('trigger')
		const positionRepository = this.entityManager.getRepository('position')
		const positionsTriggers = triggerRepository.getByLabelByPositionId({ symbol, isActive: true })

		const lastTriggerIndex = this.lastTriggerIndexBySymbol[symbol] || null
		const targetTriggerIndex = triggerRepository.getTriggerLineIndex(candle.close)
		const triggerLine = triggerRepository.getTriggerLine()

		if (lastTriggerIndex === targetTriggerIndex) return

		const processTrigger = (trigger: Trigger, position: Position) => {
			if (position.status === 'CLOSED' || position.status === 'CANCELED') return
			this.processTrigger(trigger as Trigger<'position'>, candle, onTrigger)
		}

		const processPositionId = (positionId: number) => {
			const triggers = positionsTriggers[positionId]
			const position = positionRepository.get(positionId) as Position

			// try entry
			if (triggers.entryMarket) processTrigger(triggers.entryMarket, position)
			else if (triggers.entryLimit) processTrigger(triggers.entryLimit, position)
			else if (triggers.entryStop) processTrigger(triggers.entryStop, position)

			// try pull trailing stop
			if (triggers.pullTrailingStop) processTrigger(triggers.pullTrailingStop, position)

			// get closer stoploss trigger (stopLoss or trailingStop)
			let slTrigger = triggers.stopLoss || null
			if (triggers.trailingStop) {
				const { type, stopLoss } = position
				const sl = this.getCloserStopLossPrice(type, stopLoss, triggers.trailingStop.price)
				const slKey = sl === stopLoss ? 'stopLoss' : 'trailingStop'
				slTrigger = sl !== null ? triggers[slKey] || null : null
			}

			// try exit. Don't use elseif because it could have all 3 and we want to test each.
			if (triggers.closeMarket) processTrigger(triggers.closeMarket, position)
			if (slTrigger) processTrigger(slTrigger, position)
			if (triggers.takeProfit) processTrigger(triggers.takeProfit, position)
		}

		if (!lastTriggerIndex) {
			for (const positionId in positionsTriggers) {
				// don't bother with parseInt, just looking up index.
				processPositionId(positionId as any)
			}
		} else {
			// only check triggers between previous checked price and new price
			const incrementor = lastTriggerIndex > targetTriggerIndex ? -1 : 1
			for (let i = lastTriggerIndex; i !== targetTriggerIndex; i += incrementor) {
				if (!triggerLine[i]) continue
				const positionIdSet = triggerLine[i] as Set<Trigger>
				positionIdSet.forEach((trigger) => {
					// only process triggers with positionIds
					if (trigger.positionId !== null) processPositionId(trigger.positionId)
				})
			}
		}

		this.lastTriggerIndexBySymbol[symbol] = targetTriggerIndex
	}

	public processTrigger(trigger: Trigger, candle: Candle, onTrigger?: OnTriggerCallback): void {
		const { expirationTime, id, removeAfterTrigger } = trigger
		const triggerRepository = this.entityManager.getRepository('trigger')
		const isExpired = expirationTime !== null && candle.time >= expirationTime

		if (isExpired) return this.handleTriggerExpire(trigger as Trigger<'position'>)
		if (!this.didHitTrigger(trigger, candle)) return

		trigger.lastTriggerCandle = candle
		trigger.lastExecutionPrice = this.getExecutionPrice(trigger)

		if (removeAfterTrigger) triggerRepository.remove(id)

		this.handleTrigger(trigger as Trigger<'position'>)
		if (onTrigger) onTrigger(trigger)
	}

	private didHitTrigger(trigger: Trigger, candle: Candle): boolean {
		switch (trigger.type) {
			case 'immediate':
				return true
			case 'touchFromAbove':
				return candle.low <= trigger.price
			case 'touchFromBelow':
				return candle.high >= trigger.price
			case 'crossAbove':
				return candle.close > trigger.price
			case 'crossBelow':
				return candle.close < trigger.price
			default:
				return false
		}
	}

	private handleTrigger(trigger: Trigger<'position'>): void {
		const { label } = trigger

		const handlerLib: {
			[K in Trigger['label']]: (trigger: Trigger<'position'>) => void
		} = {
			closeMarket: this.executeClose,
			entryMarket: this.executeOpen,
			entryLimit: this.executeOpen,
			entryStop: this.executeOpen,
			stopLoss: this.executeClose,
			takeProfit: this.executeClose,
			trailingStop: this.executeClose,
			pullTrailingStop: this.handlePullTrailingStop
		}

		handlerLib[label].bind(this)(trigger)
	}

	private handleTriggerExpire(trigger: Trigger<'position'>): void {
		const { positionId, id, label } = trigger

		const positionRepository = this.entityManager.getRepository('position')
		const triggerRepository = this.entityManager.getRepository('trigger')
		triggerRepository.deactivateTrigger(id)

		const isEntryTrigger = label === 'entryMarket' || label === 'entryLimit' || label === 'entryStop'
		if (positionId && isEntryTrigger) {
			positionRepository.updatePositionStatus(positionId, 'CANCELED')
			triggerRepository.deactivateForPosition(positionId)
		}
	}

	private getPosition(trigger: Trigger<'position'>): Position {
		const positionRepository = this.entityManager.getRepository('position')
		const position = positionRepository.get(trigger.positionId)
		if (!position) {
			throw new Error(`Cannot get position with id ${trigger.positionId}`)
		}
		return position
	}

	private getCandle(trigger: Trigger): Candle {
		const candle = trigger.lastTriggerCandle
		if (!candle) {
			throw new Error(`Cannot get candle from trigger ${trigger.id}`)
		}
		return candle
	}

	/**
	 * If trigger is immediate or price gaps above / below trigger, return open price, otherwise trigger price.
	 */
	private getExecutionPrice(trigger: Trigger): number {
		const { type, price, positionId } = trigger
		const { open, time, high, low } = this.getCandle(trigger)

		const position = positionId ? this.getPosition(trigger as Trigger<'position'>) : null
		const orderTime = position ? position.orderTime : null

		if (orderTime && orderTime > time) {
			throw new Error('Cannot execute trigger using a candle in the past.')
		}

		if (orderTime === time) {
			if (price > high || price < low) {
				throw new Error('Cannot execute trigger on order candle with out-of-range price.')
			}
			return price
		}

		if (type === 'immediate') return open

		const isUpperTrigger = type === 'touchFromBelow' || type === 'crossAbove'
		const isLowerTrigger = type === 'touchFromAbove' || type === 'crossBelow'

		const isGapUp = isUpperTrigger && open > price
		const isGapDown = isLowerTrigger && open < price

		return isGapUp || isGapDown ? open : price
	}

	private executeClose(trigger: Trigger<'position'>): void {
		const position = this.getPosition(trigger)
		const candle = this.getCandle(trigger)
		const { lastExecutionPrice } = trigger

		this.accountService.executeCloseOrder(position, candle, lastExecutionPrice)
	}

	private executeOpen(trigger: Trigger<'position'>): void {
		const position = this.getPosition(trigger)
		const candle = this.getCandle(trigger)
		const { lastExecutionPrice } = trigger

		this.accountService.executeOpenOrder(position, candle, lastExecutionPrice)
	}

	private handlePullTrailingStop(trigger: Trigger<'position'>): void {
		const position = this.getPosition(trigger)
		const { high, low } = this.getCandle(trigger)

		const triggerRepository = this.entityManager.getRepository('trigger')
		const triggers = triggerRepository.getByLabelByPositionId({
			symbol: position.symbol,
			isActive: true
		})[position.id]

		const { pullTrailingStop, trailingStop } = triggers || {}

		if (!trailingStop || !pullTrailingStop) return

		const { type } = position
		const trailingStopOffset = position.trailingStop as number
		const pullPrice = type === 'LONG' ? high : low

		// set stop price behind pull price by trail amount
		let stopPrice = type === 'LONG' ? high - trailingStopOffset : high + trailingStopOffset
		if (trailingStopOffset < high - low) {
			// if range of candle is larger than the trail amount, set to bottom / top of candle
			stopPrice = type === 'LONG' ? low : high
		}

		// if the previous stop price was closer than the new stop price, use the previous (stop price can't move backwards)
		stopPrice = stopPrice < trailingStop.price ? trailingStop.price : stopPrice

		triggerRepository.update(pullTrailingStop.id, { price: pullPrice })
		triggerRepository.update(trailingStop.id, { price: stopPrice })
	}

	/**
	 * Closer stoploss between stopLoss and trailingStop
	 */
	private getCloserStopLossPrice(type: PositionType, sl: number | null, tsl: number | null): number | null {
		if (!tsl) return sl || null
		if (!sl) return tsl || null
		if (type === 'LONG') return sl > tsl ? sl : tsl
		else return sl < tsl ? sl : tsl
	}
}
