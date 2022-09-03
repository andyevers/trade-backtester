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

export interface AddCandleParams {
	candle: Candle
	timeframe: TimeframeType
	symbol: string
}

export type SymbolTimeframeKey = `${string}_${TimeframeType}`

export type PriceHistoryCreateParams = Omit<PriceHistory, 'id'>

export interface GetIndexAtTimeParams {
	time: number
	symbol: string
	timeframe: TimeframeType
}

export interface SetIndexAtTimeParams {
	time: number
	symbol: string
	timeframe: TimeframeType
	index: number
}

export type PriceHistoryBySymbolTimeframe = {
	[key: SymbolTimeframeKey]: PriceHistory
}

export interface GetCandlesParams {
	startTime?: number
	endTime?: number
	symbol: string
	timeframe: TimeframeType
}

export default class PriceHistoryRepository extends Repository<PriceHistory> {
	private readonly symbolTimeframes: {
		[key: SymbolTimeframeKey]: PriceHistory
	} = {}

	// this only works for times that have been iterated using setTime
	private indexByTimeByStfKey: {
		[stfKey: SymbolTimeframeKey]: {
			[time: number]: number
		}
	} = {}

	/**
	 * Note that getting candles by time is less efficient than getting all candles.
	 */
	public getCandles(params: GetCandlesParams): Candle[] {
		const { symbol, timeframe, startTime, endTime } = params
		const key = this.getKey(symbol, timeframe)
		const candles = this.symbolTimeframes[key]?.candles || []

		if (typeof startTime !== 'number' && typeof endTime !== 'number') {
			return candles
		}

		const startIndex = startTime ? this.getIndexNearTime({ symbol, timeframe, time: startTime }) : 0
		const endIndex = endTime
			? this.getIndexNearTime({ symbol, timeframe, time: endTime })
			: candles.length - 1

		return candles.slice(startIndex as number, (endIndex as number) + 1)
	}

	/**
	 * Returns the index at a time or null if not found.
	 */
	public getIndexAtTime(params: GetIndexAtTimeParams): number | null {
		const { symbol, time, timeframe } = params
		const key = this.getKey(symbol, timeframe)
		const symbolTimeframeTimes = this.indexByTimeByStfKey[key]

		return symbolTimeframeTimes ? symbolTimeframeTimes[time] : null
	}

	/**
	 * Returns index with time closest to provided time. null if no results for that symbol timeframe.
	 */
	public getIndexNearTime(params: GetIndexAtTimeParams): number | null {
		const { symbol, timeframe, time } = params
		const key = this.getKey(symbol, timeframe)

		// try getting keyed result first.
		// const symbolTimeframeTimes = this.indexByTimeByStfKey[key] || {}
		// const keyedResult = symbolTimeframeTimes[time]
		// if (keyedResult) {
		// 	return keyedResult
		// }

		// if no results, iterate candles and find closest.
		const candles = this.symbolTimeframes[key]?.candles
		if (!candles) return null
		if (time < candles[0].time) return 0
		if (time > candles[candles.length - 1].time) return candles.length - 1

		// limit amount of iterations to prevent infinite loop.
		const maxIterations = 200
		let totalIterations = 0

		let leftIndexBound = 0
		let rightIndexBound = candles.length - 1

		// narrow index bounds until we find the closest candle index. (Usually finishes in 10 - 20 iterations)
		do {
			let range = rightIndexBound - leftIndexBound
			let isEven = range % 2 === 0
			let midIndex = isEven ? range / 2 + leftIndexBound : (range - 1) / 2 + leftIndexBound
			if (range === 1) {
				const differenceLeft = time - candles[midIndex].time
				const differenceRight = candles[midIndex + 1].time - time
				return differenceLeft > differenceRight ? rightIndexBound : leftIndexBound
			}
			if (candles[midIndex].time > time) rightIndexBound = midIndex
			else if (candles[midIndex].time < time) leftIndexBound = midIndex
			else return midIndex

			totalIterations++
		} while (totalIterations < maxIterations)

		throw new Error(`Could not find nearest index for time ${time} in ${maxIterations} iterations.`)
	}

	public setIndexAtTime(params: SetIndexAtTimeParams) {
		const { symbol, timeframe, time, index } = params
		const key = this.getKey(symbol, timeframe)
		const symbolTimeframeTimes = this.indexByTimeByStfKey[key] || {}
		symbolTimeframeTimes[time] = index
		this.indexByTimeByStfKey[key] = symbolTimeframeTimes
	}

	public getBySymbolTimeframe(symbol: string, timeframe: TimeframeType): PriceHistory | null {
		const priceHistory = this.symbolTimeframes[this.getKey(symbol, timeframe)]
		return priceHistory || null
	}

	private getKey(symbol: string, timeframe: TimeframeType): SymbolTimeframeKey {
		return `${symbol}_${timeframe}`
	}

	/**
	 * Adds candles to existing priceHistory. creates new priceHistory if none exists.
	 */
	public addCandles(params: PriceHistoryCreateParams) {
		const { symbol, timeframe, candles } = params
		const key = this.getKey(symbol, timeframe)
		const priceHistory = this.symbolTimeframes[key]
		if (priceHistory) {
			for (let i = 0; i < candles.length; i++) {
				priceHistory.candles.push(candles[i])
			}
		} else {
			this.create(params)
		}
	}

	/**
	 * TODO: About 30ms in 70,000 iterations
	 */
	public addCandle(params: AddCandleParams) {
		const { candle, symbol, timeframe } = params
		const key = this.getKey(symbol, timeframe)
		const priceHistory = this.symbolTimeframes[key]
		if (priceHistory) {
			priceHistory.candles.push(candle)
			// this.indexByTimeByStfKey[key][candle.time] = priceHistory.candles.length - 1
		} else {
			this.create({ symbol, timeframe, candles: [candle] })
		}
	}

	public override remove(priceHistoryId: number): void {
		const priceHistory = this.get(priceHistoryId)
		if (!priceHistory) return
		const key = this.getKey(priceHistory.symbol, priceHistory.timeframe)
		delete this.symbolTimeframes[key]
		// delete this.indexByTimeByStfKey[key]
		super.remove(priceHistoryId)
	}

	public override create(params: PriceHistoryCreateParams): PriceHistory {
		const priceHistory = super.create(params)
		const { symbol, timeframe } = priceHistory
		const key = this.getKey(symbol, timeframe)
		if (this.symbolTimeframes[key]) {
			throw new Error(`PriceHistory already exists for ${symbol} ${timeframe}`)
		}
		this.symbolTimeframes[key] = priceHistory
		// this.indexByTimeByStfKey[key] = {}
		// for (let i = 0; i < priceHistory.candles.length; i++) {
		// 	this.indexByTimeByStfKey[key][priceHistory.candles[i].time] = i
		// }
		return priceHistory
	}
}
