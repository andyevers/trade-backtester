import { Trigger, TriggerType } from '@src/repository/TriggerRepository'
import EntityManager from '../repository/EntityManager'
import { Position, PositionType } from '../repository/PositionRepository'

export interface PositionServiceArgs {
	entityManager: EntityManager
}

export interface PositionTriggerParams {
	positionId: number
	symbol: string
	price: number
	positionType: PositionType
	removeAfterTrigger?: boolean
	expirationTime?: number | null
}

export interface TrailStopParams extends PositionTriggerParams {
	trailAmount: number
}

export type PositionTriggerLabel =
	| 'stopLoss'
	| 'takeProfit'
	| 'pullTrailingStop'
	| 'trailingStop'
	| 'entryLimit'
	| 'entryStop'
	| 'entryMarket'
	| 'closeMarket'

export default class PositionService {
	private readonly entityManager: EntityManager

	constructor(args?: PositionServiceArgs) {
		const { entityManager = EntityManager.instance() } = args || {}
		this.entityManager = entityManager
	}

	private getTriggerType(
		positionType: PositionType,
		positionTriggerType: PositionTriggerLabel
	): TriggerType {
		const triggerTypeLib: {
			[K in PositionTriggerLabel]: TriggerType
		} = {
			closeMarket: 'immediate',
			entryMarket: 'immediate',
			entryLimit: positionType === 'LONG' ? 'touchFromAbove' : 'touchFromBelow',
			entryStop: positionType === 'LONG' ? 'touchFromBelow' : 'touchFromAbove',
			stopLoss: positionType === 'LONG' ? 'touchFromAbove' : 'touchFromBelow',
			takeProfit: positionType === 'LONG' ? 'touchFromBelow' : 'touchFromAbove',
			trailingStop: positionType === 'LONG' ? 'touchFromAbove' : 'touchFromBelow',
			pullTrailingStop: positionType === 'LONG' ? 'touchFromBelow' : 'touchFromAbove'
		}

		return triggerTypeLib[positionTriggerType]
	}

	public setPositionTrigger(
		label: PositionTriggerLabel,
		params: PositionTriggerParams
	): Trigger<'position'> {
		const {
			price,
			symbol,
			positionId,
			positionType,
			expirationTime = null,
			removeAfterTrigger = true
		} = params
		const triggerRepository = this.entityManager.getRepository('trigger')
		return triggerRepository.create({
			category: 'position',
			label: label,
			price: price,
			symbol: symbol,
			type: this.getTriggerType(positionType, label),
			positionId: positionId,
			removeAfterTrigger: removeAfterTrigger,
			expirationTime: expirationTime
		}) as Trigger<'position'>
	}

	public setTrailingStop(params: TrailStopParams): void {
		const { price, trailAmount, positionId } = params
		const positionRepository = this.entityManager.getRepository('position')
		const position = positionRepository.get(positionId) as Position
		const stopPrice = position.type === 'LONG' ? price - trailAmount : price + trailAmount

		this.setPositionTrigger('pullTrailingStop', { ...params, removeAfterTrigger: false })
		this.setPositionTrigger('trailingStop', { ...params, price: stopPrice, removeAfterTrigger: false })
	}

	private hasTrigger(position: Position, triggerType: PositionTriggerLabel): boolean {
		const { symbol, id } = position
		const triggerRepository = this.entityManager.getRepository('trigger')
		const triggersByLabelById = triggerRepository.getByLabelByPositionId({ symbol, isActive: true })

		const positionTriggers = triggersByLabelById[id] || {}
		return typeof positionTriggers[triggerType] !== 'undefined'
	}

	public addEntryTriggers(position: Position): void {
		const { id, type, symbol, orderPrice, orderType, orderDuration, orderTime } = position
		const MS_DAY = 86400000
		const triggerParams = {
			positionId: id,
			positionType: type,
			symbol: symbol,
			price: orderPrice,
			expirationTime: orderDuration === 'DAY' ? orderTime + MS_DAY : null
		}
		if (orderType === 'LIMIT' && !this.hasTrigger(position, 'entryLimit')) {
			this.setPositionTrigger('entryLimit', triggerParams)
		} else if (orderType === 'STOP' && !this.hasTrigger(position, 'entryLimit')) {
			this.setPositionTrigger('entryStop', triggerParams)
		} else if (orderType === 'MARKET' && !this.hasTrigger(position, 'entryMarket')) {
			this.setPositionTrigger('entryMarket', triggerParams)
		}
	}

	public addExitTriggers(position: Position, curPrice?: number): void {
		const { id, type, symbol, stopLoss, takeProfit, trailingStop, status } = position

		if (status !== 'OPEN') return
		curPrice = typeof curPrice === 'number' ? curPrice : (position.entryPrice as number)
		const baseTrigger = {
			positionId: id,
			positionType: type,
			symbol: symbol
		}

		if (stopLoss && !this.hasTrigger(position, 'stopLoss')) {
			this.setPositionTrigger('stopLoss', { ...baseTrigger, price: stopLoss })
		}
		if (takeProfit && !this.hasTrigger(position, 'takeProfit')) {
			this.setPositionTrigger('takeProfit', { ...baseTrigger, price: takeProfit })
		}
		if (trailingStop && !this.hasTrigger(position, 'trailingStop')) {
			this.setTrailingStop({
				...baseTrigger,
				trailAmount: trailingStop,
				price: curPrice
			})
		}
	}

	public removeTriggers(position: Position): void {
		const triggerRepository = this.entityManager.getRepository('trigger')
		triggerRepository.deactivateForPosition(position.id)
	}
}
