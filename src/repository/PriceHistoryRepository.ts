import { Candle } from '../types'
import Repository, { Entity } from './Repository'

export type TimeframeType =
	| 'minute'
	| 'minute5'
	| 'minute10'
	| 'minute15'
	| 'minute30'
	| 'hour'
	| 'hour4'
	| 'day'
	| 'week'
	| 'month'

export interface PriceHistory extends Entity {
	timeframe: TimeframeType
	candles: Candle[]
	symbol: string
}

export type SymbolTimeframeKey = `${string}_${TimeframeType}`

export type PriceHistoryCreateParams = Omit<PriceHistory, 'id'>

export type PriceHistoryBySymbolTimeframe = {
	[key: SymbolTimeframeKey]: PriceHistory
}

export default class PriceHistoryRepository extends Repository<PriceHistory> {
	private readonly symbolTimeframes: {
		[key: SymbolTimeframeKey]: PriceHistory
	} = {}

	private readonly copyFunctions: {
		[key: SymbolTimeframeKey]: () => PriceHistory
	} = {}

	public getBySymbolTimeframe(symbol: string, timeframe: TimeframeType): PriceHistory {
		const priceHistory = this.symbolTimeframes[this.getKey(symbol, timeframe)]
		if (!priceHistory) {
			throw new Error(`${symbol} ${timeframe} is not a registered symbol timeframe`)
		}
		return priceHistory
	}

	private getKey(symbol: string, timeframe: TimeframeType): SymbolTimeframeKey {
		return `${symbol}_${timeframe}`
	}

	public override remove(priceHistoryId: number): void {
		const priceHistory = this.get(priceHistoryId)
		if (!priceHistory) return
		const key = this.getKey(priceHistory.symbol, priceHistory.timeframe)
		delete this.symbolTimeframes[key]
		delete this.copyFunctions[key]
		super.remove(priceHistoryId)
	}

	public override create(params: PriceHistoryCreateParams): PriceHistory {
		const priceHistory = super.create(params)
		const { symbol, timeframe } = priceHistory
		this.symbolTimeframes[this.getKey(symbol, timeframe)] = priceHistory
		return priceHistory
	}
}
