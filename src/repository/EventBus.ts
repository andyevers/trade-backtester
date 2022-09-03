import { Account } from './AccountRepository'
import { Position } from './PositionRepository'
import { PriceHistory } from './PriceHistoryRepository'
import { Entity } from './Repository'
import { Trigger } from './TriggerRepository'

export type EventBusNamespaces = {
	priceHistory: RepositoryEvents<PriceHistory>
	account: RepositoryEvents<Account>
	position: RepositoryEvents<Position>
	trigger: RepositoryEvents<Trigger>
}

type RepositoryEvents<T extends Entity> = {
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

type EventBusEventType = {
	[K in keyof EventBusNamespaces]: EventBusNamespaces[K] extends Object
		? `${Extract<K, string>}.${Extract<keyof EventBusNamespaces[K], string>}`
		: never
}[keyof EventBusNamespaces]

type EventBusCallback<T extends EventBusEventType> = (data: EventBusEvents[T]) => void

export type EventBusEvents = {
	[K in EventBusEventType]: K extends `${infer P}.${infer S}`
		? P extends keyof EventBusNamespaces
			? EventBusNamespaces[P][Extract<keyof EventBusNamespaces[P], S>]
			: never
		: never
}

export default class EventBus {
	private static _instance: EventBus | null = null

	private readonly events: {
		[K in keyof EventBusEvents]?: Set<EventBusCallback<K>>
	} = {}

	public dispatch = <T extends EventBusEventType>(eType: T, data: EventBusEvents[T]) => {
		this.events[eType]?.forEach((callback) => callback(data))
	}

	public on<T extends keyof EventBusEvents>(eType: T, callback: EventBusCallback<T>) {
		if (!this.events[eType]) {
			this.events[eType] = new Set<EventBusCallback<keyof typeof this.events>>()
		}
		this.events[eType]?.add(callback)
	}

	public off<T extends EventBusEventType>(eType: T, callback: EventBusCallback<T>) {
		this.events[eType]?.delete(callback)
	}

	public static instance(): EventBus {
		if (!this._instance) this._instance = new EventBus()
		return this._instance
	}
}
