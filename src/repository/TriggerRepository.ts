import { PositionTriggerLabel } from '../service'
import { Candle } from '../types'
import Repository, { Entity, RepositoryArgs } from './Repository'

export type TriggerType = 'crossAbove' | 'crossBelow' | 'touchFromAbove' | 'touchFromBelow' | 'immediate'
export type TriggerCategory = keyof TriggerCategoryLabel

// Leaving the door open for other trigger types (alerts, opportunities, etc...)
type TriggerCategoryLabel = {
	position: PositionTriggerLabel
	alert: never
}

export interface Trigger<T extends TriggerCategory = TriggerCategory> extends Entity {
	price: number
	symbol: string
	type: TriggerType
	lastTriggerCandle: Candle | null
	removeAfterTrigger: boolean
	positionId: T extends 'position' ? number : null
	category: T
	expirationTime: number | null
	label: TriggerCategoryLabel[T]
	lastExecutionPrice: number | null
	isActive: boolean
}

export interface TriggerCreateParams<T extends TriggerCategory = TriggerCategory>
	extends Omit<Partial<Trigger>, 'id'> {
	price: number
	symbol: string
	type: TriggerType
	category: T
	label: TriggerCategoryLabel[T]
}

type TriggersByPositionLabel = {
	[label in TriggerCategoryLabel['position']]?: Trigger
}

interface TriggersById {
	[triggerId: number]: Trigger
}

interface TriggersByIdFilters {
	type?: TriggerType
	symbol?: string
}

interface TriggerTypeBlock {
	crossAbove: TriggersById
	crossBelow: TriggersById
	touchFromAbove: TriggersById
	touchFromBelow: TriggersById
	immediate: TriggersById
	_all: TriggersById
}

interface TriggersByIdMap {
	_bySymbol: {
		[symbol: string]: TriggerTypeBlock
	}
	_all: TriggerTypeBlock
}

interface TriggersByLabelByPositionId {
	[positionId: number]: TriggersByPositionLabel
}

interface PositionTriggersByLabelMap {
	_bySymbol: {
		[symbol: string]: {
			isActive: TriggersByLabelByPositionId
			isInactive: TriggersByLabelByPositionId
			_all: TriggersByLabelByPositionId
		}
	}
	_all: {
		isActive: TriggersByLabelByPositionId
		isInactive: TriggersByLabelByPositionId
		_all: TriggersByLabelByPositionId
	}
}

interface TriggersByLabelByPositionIdFilters {
	symbol?: string
	isActive?: boolean
}

export default class TriggerRepository extends Repository<Trigger> {
	private readonly positionTriggersByLabelMap: PositionTriggersByLabelMap = {
		_bySymbol: {},
		_all: {
			isActive: {},
			isInactive: {},
			_all: {}
		}
	}

	private readonly triggersByIdMap: TriggersByIdMap = {
		_bySymbol: {},
		_all: {
			crossAbove: {},
			crossBelow: {},
			touchFromAbove: {},
			touchFromBelow: {},
			immediate: {},
			_all: {}
		}
	}

	private readonly inactiveTriggersById: TriggersById = {}

	private readonly triggerLine: (Set<Trigger> | undefined)[] = []

	private readonly triggerLineIncrement = 0.5

	constructor(args: RepositoryArgs) {
		const { eventBus } = args
		super({ eventBus, eventPrefix: 'triggerRepository' })
	}

	/**
	 * This is a lineup of triggers that are currently active.
	 * Prevents triggers from being checked when their price is not crossed
	 *
	 * ex:
	 * [undefined, undefined, TriggersA, undefined, undefined, TriggersB, undefined]
	 * previous price checked was at index 1, current price check
	 * is at index 4, only triggersA will be checked.
	 */
	public getTriggerLine(): (Set<Trigger> | undefined)[] {
		return this.triggerLine
	}

	/**
	 * The price increment until the triggers is placed in the next
	 * triggerLineArr index.
	 */
	public getTriggerLineIndex(price: number): number {
		return (price - (price % this.triggerLineIncrement)) / this.triggerLineIncrement
	}

	public deactivateForPosition(positionId: number): void {
		const triggersByLabel = this.positionTriggersByLabelMap._all.isActive[positionId] || {}
		for (const label in triggersByLabel) {
			const trigger = triggersByLabel[label as keyof typeof triggersByLabel] as Trigger
			this.deactivateTrigger(trigger.id)
		}
	}

	public deactivateTrigger(triggerId: number): void {
		const trigger = this.get(triggerId)
		if (!trigger) return
		this.unsetMapBlocks(trigger)
		trigger.isActive = false
		this.inactiveTriggersById[triggerId] = trigger
	}

	public override remove(triggerId: number): void {
		const trigger = this.get(triggerId)
		if (!trigger) return
		this.unsetMapBlocks(trigger)
		delete this.inactiveTriggersById[triggerId]
		super.remove(triggerId)
	}

	private setMapBlocks(trigger: Trigger): void {
		const { type, id, symbol, positionId, label, isActive } = trigger
		this.triggersByIdMap._all._all[id] = trigger
		this.triggersByIdMap._all[type][id] = trigger
		this.triggersByIdMap._bySymbol[symbol]._all[id] = trigger
		this.triggersByIdMap._bySymbol[symbol][type][id] = trigger

		if (positionId !== null) {
			const activeKey = isActive ? 'isActive' : 'isInactive'
			if (!this.positionTriggersByLabelMap._all._all[positionId][label]) {
				this.positionTriggersByLabelMap._all._all[positionId][label] = trigger
				this.positionTriggersByLabelMap._all[activeKey][positionId][label] = trigger
				this.positionTriggersByLabelMap._bySymbol[symbol]._all[positionId][label] = trigger
				this.positionTriggersByLabelMap._bySymbol[symbol][activeKey][positionId][label] = trigger
			} else {
				throw new Error('Cannot set 2 triggers with the same label and positionId')
			}
		}
	}

	public update(id: number, params: Omit<Partial<Trigger>, 'id'>): Trigger | null {
		const trigger = this.get(id)
		if (!trigger) return null
		if (params.price) {
			this.unsetTriggerBucket(trigger)
			trigger.price = params.price
			this.setTriggerBucket(trigger)
			delete params.price
		}

		return super.update(id, params)
	}

	private unsetMapBlocks(trigger: Trigger): void {
		const { type, id, symbol, positionId, label, isActive, price } = trigger
		delete this.triggersByIdMap._all._all[id]
		delete this.triggersByIdMap._all[type][id]
		delete this.triggersByIdMap._bySymbol[symbol]._all[id]
		delete this.triggersByIdMap._bySymbol[symbol][type][id]

		if (positionId !== null) {
			const activeKey = isActive ? 'isActive' : 'isInactive'
			delete this.positionTriggersByLabelMap._all._all[positionId][label]
			delete this.positionTriggersByLabelMap._all[activeKey][positionId][label]
			delete this.positionTriggersByLabelMap._bySymbol[symbol]._all[positionId][label]
			delete this.positionTriggersByLabelMap._bySymbol[symbol][activeKey][positionId][label]
		}

		this.unsetTriggerBucket(trigger)
	}

	private setTriggerBucket(trigger: Trigger): void {
		const { price } = trigger
		const incrementIndex = this.getTriggerLineIndex(price)
		if (!this.triggerLine[incrementIndex]) {
			this.triggerLine[incrementIndex] = new Set()
		}
		;(this.triggerLine[incrementIndex] as Set<Trigger>).add(trigger)
	}

	private unsetTriggerBucket(trigger: Trigger): void {
		const { price } = trigger
		const incrementIndex = this.getTriggerLineIndex(price)
		const triggerBucket = this.triggerLine[incrementIndex]
		if (triggerBucket) {
			triggerBucket.delete(trigger)
			if (triggerBucket.size === 0) delete this.triggerLine[incrementIndex]
		}
	}

	private ensureSymbolBlocks(trigger: Trigger): void {
		const { symbol, positionId, isActive, price } = trigger

		if (!this.triggersByIdMap._bySymbol[symbol]) {
			this.triggersByIdMap._bySymbol[symbol] = {
				_all: {},
				crossAbove: {},
				crossBelow: {},
				immediate: {},
				touchFromAbove: {},
				touchFromBelow: {}
			}
		}
		if (positionId !== null) {
			const activeKey = isActive ? 'isActive' : 'isInactive'
			if (!this.positionTriggersByLabelMap._bySymbol[symbol]) {
				this.positionTriggersByLabelMap._bySymbol[symbol] = {
					_all: {},
					isActive: {},
					isInactive: {}
				}
			}
			if (!this.positionTriggersByLabelMap._all._all[positionId]) {
				this.positionTriggersByLabelMap._all._all[positionId] = {}
				this.positionTriggersByLabelMap._all[activeKey][positionId] = {}
				this.positionTriggersByLabelMap._bySymbol[symbol]._all[positionId] = {}
				this.positionTriggersByLabelMap._bySymbol[symbol][activeKey][positionId] = {}
			}

			this.setTriggerBucket(trigger)
		}
	}

	public getByLabelByPositionId(
		filters: TriggersByLabelByPositionIdFilters = {}
	): TriggersByLabelByPositionId {
		const { isActive, symbol } = filters
		const activeKey = isActive ? 'isActive' : 'isInactive'
		const bucket = symbol
			? this.positionTriggersByLabelMap._bySymbol[symbol] || { _all: {}, isActive: {}, isInactive: {} }
			: this.positionTriggersByLabelMap._all

		return typeof isActive === 'undefined' ? bucket._all : bucket[activeKey] || {}
	}

	public getByIdLookup(filters: TriggersByIdFilters = {}): TriggersById {
		const { symbol, type } = filters
		if (!symbol && !type) return this.triggersByIdMap._all._all
		const triggerTypeBlock = symbol ? this.triggersByIdMap._bySymbol[symbol] : this.triggersByIdMap._all
		return type ? triggerTypeBlock[type] : triggerTypeBlock._all
	}

	public override create(params: TriggerCreateParams): Trigger {
		const {
			price,
			symbol,
			type,
			label,
			category,
			lastTriggerCandle = null,
			positionId = null,
			removeAfterTrigger = true,
			lastExecutionPrice = null,
			expirationTime = null
		} = params

		const trigger = super.create({
			price,
			symbol,
			type,
			label,
			lastTriggerCandle,
			positionId,
			removeAfterTrigger,
			category,
			expirationTime,
			lastExecutionPrice,
			isActive: true
		})

		this.ensureSymbolBlocks(trigger)
		this.setMapBlocks(trigger)

		return trigger
	}
}
