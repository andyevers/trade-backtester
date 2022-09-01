import { Candle } from '@src/types'
import {
	ResponseCloseOrders,
	ResponseFetchAccount,
	ResponseFetchPositions,
	ResponseFetchPriceHistory,
	ResponsePlaceOrder
} from './BaseClient'

export type EventBusEvents = {
	responsePlaceOrder: ResponsePlaceOrder
	responseCloseOrder: ResponseCloseOrders
	responseFetchPriceHistory: ResponseFetchPriceHistory
	responseFetchAccount: ResponseFetchAccount
	responseFetchPositions: ResponseFetchPositions
	newCandles: {
		candleBySymbol: {
			[symbol: string]: Candle
		}
	}
}

export type EventBusCallback<T extends keyof EventBusEvents> = (data: EventBusEvents[T]) => void

export default class EventBus {
	private readonly events: {
		[K in keyof EventBusEvents]: {
			[eventId: string]: EventBusCallback<K>
		}
	} = {
		responsePlaceOrder: {},
		responseCloseOrder: {},
		responseFetchAccount: {},
		responseFetchPriceHistory: {},
		responseFetchPositions: {},
		newCandles: {}
	}

	public dispatch<T extends keyof EventBusEvents>(eType: T, data: EventBusEvents[T]) {
		for (const eventId in this.events[eType]) {
			this.events[eType][eventId](data)
		}
	}

	public on<T extends keyof EventBusEvents>(eType: T, id: string, callback: EventBusCallback<T>) {
		const eventsById = this.events[eType]
		eventsById[id as keyof typeof eventsById] = callback as any
	}

	public off<T extends keyof EventBusEvents>(eType: T, id: string) {
		delete this.events[eType][id]
	}
}
