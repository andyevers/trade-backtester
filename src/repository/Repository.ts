import { EventBus } from '../events'
import { Account } from './AccountRepository'
import { Position } from './PositionRepository'
import { PriceHistory } from './PriceHistoryRepository'
import { Trigger } from './TriggerRepository'

export interface Entity {
	id: number
}

export interface RepositoryAbstractArgs {
	eventBus: EventBus<RepositoryEvents>
	eventPrefix: keyof RepositoryEventNamespaces
}

export interface RepositoryArgs {
	eventBus: EventBus<RepositoryEvents>
}

type RepositoryEventNamespaces = {
	priceHistoryRepository: RepositoryEvent<PriceHistory>
	accountRepository: RepositoryEvent<Account>
	positionRepository: RepositoryEvent<Position>
	triggerRepository: RepositoryEvent<Trigger>
}

type RepositoryEvent<T extends Entity> = {
	create: {
		entity: T
	}
	update: {
		entity: T
	}
	remove: {
		entity: T
	}
	import: {
		entity: T
	}
}

type RepositoryEventType = {
	[K in keyof RepositoryEventNamespaces]: RepositoryEventNamespaces[K] extends Object
		? `${Extract<K, string>}.${Extract<keyof RepositoryEventNamespaces[K], string>}`
		: never
}[keyof RepositoryEventNamespaces]

export type RepositoryEvents = {
	[K in RepositoryEventType]: K extends `${infer P}.${infer S}`
		? P extends keyof RepositoryEventNamespaces
			? RepositoryEventNamespaces[P][Extract<keyof RepositoryEventNamespaces[P], S>]
			: never
		: never
}

export default abstract class Repository<T extends Entity> {
	protected readonly entities: Set<T> = new Set()
	protected readonly entitiesById: { [id: number]: T } = {}

	private readonly eventBus: EventBus<RepositoryEvents>

	private readonly eTypeUpdate: keyof RepositoryEvents
	private readonly eTypeCreate: keyof RepositoryEvents
	private readonly eTypeRemove: keyof RepositoryEvents
	private readonly eTypeImport: keyof RepositoryEvents

	constructor(args: RepositoryAbstractArgs) {
		const { eventBus, eventPrefix } = args
		this.eventBus = eventBus

		this.eTypeUpdate = `${eventPrefix}.update`
		this.eTypeCreate = `${eventPrefix}.create`
		this.eTypeRemove = `${eventPrefix}.remove`
		this.eTypeImport = `${eventPrefix}.import`
	}

	private index = 0

	private getNextIndex(): number {
		this.index++
		return this.index
	}

	public getAll(): T[] {
		return Array.from(this.entities)
	}

	public getAllAsSet(): Set<T> {
		return this.entities
	}

	public get(id: number): T | null {
		return this.entitiesById[id] || null
	}

	public create(entity: Omit<T, 'id'>): T {
		const id = this.getNextIndex()
		;(entity as T).id = id
		this.entities.add(entity as T)
		this.entitiesById[id] = entity as T
		this.eventBus.dispatch(this.eTypeCreate, { entity: entity as any })
		return entity as T
	}

	public import(entity: T): T {
		if (this.entitiesById[entity.id]) {
			throw new Error(
				`Entity with id ${entity.id} already exists in repository ${this.constructor.name}`
			)
		}
		const id = entity.id + 1
		this.entities.add(entity as T)
		this.entitiesById[id] = entity as T
		this.eventBus.dispatch(this.eTypeImport, { entity: entity as any })
		return entity
	}

	public remove(id: number): void {
		const entity = this.entitiesById[id]
		if (!entity) return
		this.entities.delete(entity)
		delete this.entitiesById[id]
		this.eventBus.dispatch(this.eTypeRemove, { entity: entity as any })
	}

	public update(id: number, params: Omit<Partial<T> | T, 'id'>): T | null {
		const entity = this.entitiesById[id] || null
		if (!entity) return null
		for (const key in params) {
			if (key === 'id') continue
			entity[key as keyof T] = params[key as keyof typeof params] as any
		}

		this.eventBus.dispatch(this.eTypeUpdate, { entity: entity as any })
		return entity
	}
}
