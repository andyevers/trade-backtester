import {
	SymbolTimeframeKey,
	EntityManager,
	TimeframeType,
	PriceHistory,
	GetIndexAtTimeParams
} from '../repository'
import { Candle } from '../types'

interface CandlesBySymbolTimeframe {
	[key: SymbolTimeframeKey]: Candle[]
}

type TimeTense = 'past' | 'present' | 'all'

interface TimelineArgs {
	entityManager: EntityManager
}

export interface NewCandleData {
	candle: Candle
	symbol: string
}

type NewCandleCallback = (data: NewCandleData) => void

// TODO: Move storing of candles to PriceHistoryRepository
export default class Timeline {
	private time: number = 0
	private timelineIndex: number = 0
	private timeline: number[] = []

	private currentIndexes: {
		[stfKey: SymbolTimeframeKey]: number
	} = {}

	private readonly candles: {
		[T in TimeTense]: CandlesBySymbolTimeframe
	} = {
		past: {},
		present: {},
		all: {}
	}

	private latestCandlesBuilt: {
		[symbol: string]: Candle
	} = {}

	private readonly entityManager: EntityManager
	private mainTimeframe: TimeframeType = 'day'

	constructor(args: TimelineArgs) {
		const { entityManager } = args
		this.entityManager = entityManager
	}

	/**
	 * The candle times of this priceHistory will be used to create the timeline, and it's timeframe
	 * will be used as the main timeframe that takes priority over others during iteration when
	 * using setTime. This will also set the current time to the first candle time. The priceHistory
	 * must be registered in the PriceHistoryRepository
	 *
	 * @param priceHistoryIdForTimeline id of price history that will be used for the timeline
	 */
	public initFromPriceHistoryId(priceHistoryIdForTimeline: number): void {
		const priceHistoryRepository = this.entityManager.getRepository('priceHistory')
		const priceHistory = priceHistoryRepository.get(priceHistoryIdForTimeline)
		if (!priceHistory) {
			throw new Error(`priceHistory with id ${priceHistoryIdForTimeline} not found`)
		}
		this.setPriceHistory(priceHistoryRepository.getAll())
		this.setTimeline(priceHistory.candles.map((c) => c.time))
		this.setMainTimeframe(priceHistory.timeframe)
		this.setStartTime(this.timeline[0])
	}

	/**
	 * When candles appear on multiple timeframes of the same symbol,
	 * this timeframe will take priority over other timeframes as the latest candle.
	 * This should be the timeframe of the candles used to create the timeline.
	 */
	public setMainTimeframe(timeframe: TimeframeType) {
		this.mainTimeframe = timeframe
	}

	/**
	 * Returns the timeframe type that takes priority over other timeframes during iteration in setTime.
	 */
	public getMainTimeframe(): TimeframeType {
		return this.mainTimeframe
	}

	/**
	 * Returns current timeline
	 */
	public getTimeline(): number[] {
		return this.timeline
	}

	/**
	 * sets timeline that will be iterated through using next().
	 */
	public setTimeline(timeline: number[]): void {
		this.timeline = timeline
	}

	/**
	 * Returns -1 if candles are all in future, and final index if all candles are in past. null if not indexed.
	 */
	public getIndexAtTime(params: GetIndexAtTimeParams): number | null {
		const { symbol, time, timeframe } = params
		if (time > this.time) return -1
		const priceHistoryRepository = this.entityManager.getRepository('priceHistory')
		return priceHistoryRepository.getIndexNearTime({ symbol, time, timeframe })
	}

	/**
	 * sets current index and time to time at the provided index from this.timeline.
	 */
	public setTimelineIndex(index: number, onNewCandle?: NewCandleCallback): void {
		const timeAtIndex = this.timeline[index]
		if (this.timeline.length === 0) {
			throw new Error('You must set a timeline before using setTimelineIndex')
		}
		this.setTime(timeAtIndex, onNewCandle)
		this.timelineIndex = index
	}

	/**
	 * Candles that appear multiple in one increment will be combined into a single candle
	 */
	public getLatestCandleBuilt(symbol: string): Candle | null {
		return this.latestCandlesBuilt[symbol] || null
	}

	/**
	 * Past candles includes current candles
	 */
	public getCandles(symbol: string, timeframe: TimeframeType, timeTense: TimeTense): Candle[] {
		const key = `${symbol}_${timeframe}` as SymbolTimeframeKey
		return this.candles[timeTense][key] || []
	}

	/**
	 * Returns time in milliseconds at current index
	 */
	public getTime(): number {
		return this.time
	}

	/**
	 * Same as setTime but removes present candles
	 */
	public setStartTime(time: number): void {
		this.setTime(time)
		for (const symbolTimeframe in this.candles.present) {
			this.candles.present[symbolTimeframe as SymbolTimeframeKey] = []
		}
	}

	/**
	 * Moves all candles with datetime at or before this time to 'current' and 'past' candles
	 */
	public setTime(time: number, onNewCandle?: NewCandleCallback): void {
		if (time < this.time) {
			throw new Error('You cannot go back in time. use reset() to start over')
		}

		const priceHistoryRepository = this.entityManager.getRepository('priceHistory')

		const bucketPast = this.candles.past
		const bucketPresent = this.candles.present
		const bucketAll = this.candles.all

		const builtCandleSymbols: { [symbol: string]: boolean } = {}

		for (const symbolTimeframe in bucketAll) {
			const stfKey = symbolTimeframe as SymbolTimeframeKey
			const candlesAll = bucketAll[stfKey]

			let nextIndex = this.currentIndexes[stfKey] + 1

			const candlesPast = bucketPast[stfKey]
			const candlesPresent = (bucketPresent[stfKey] = [] as Candle[])
			const [symbol, timeframe] = stfKey.split('_')

			// if canldes are done iterating, use last index for current index and continue
			if (nextIndex >= candlesAll.length) {
				priceHistoryRepository.setIndexAtTime({
					symbol,
					time: time,
					timeframe: timeframe as TimeframeType,
					index: this.currentIndexes[stfKey]
				})
				continue
			}

			// the current candle or combined candle if sub-timeframe
			const candleGenerator = this.candleGenerator(candlesAll[nextIndex])

			while (candlesAll[nextIndex]?.time <= time) {
				const candle = candlesAll[nextIndex]
				candleGenerator.next(candle)
				candlesPresent.push(candle)
				candlesPast.push(candle)

				this.currentIndexes[stfKey]++
				nextIndex = this.currentIndexes[stfKey] + 1
			}

			// used for getCandles startTime and endTime
			priceHistoryRepository.setIndexAtTime({
				symbol,
				time: time,
				timeframe: timeframe as TimeframeType,
				index: this.currentIndexes[stfKey]
			})

			const builtCandle = candleGenerator.return().value as Candle

			// no candles in current time
			if (!builtCandle) continue

			const hasMainTf = bucketAll[`${symbol}_${this.mainTimeframe}`]
			const isMainTf = timeframe === this.mainTimeframe
			const didBuildCandle = builtCandleSymbols[symbol] === true

			// TODO: This can cause issues with certain candles not being counted
			// if 2 non-main timeframes (like month and minute) month may be skipped
			// or vice-versa (depending which appears first in the object).
			if (isMainTf || !hasMainTf || !didBuildCandle) {
				this.latestCandlesBuilt[symbol] = builtCandle
				builtCandleSymbols[symbol] = true
				if (onNewCandle) onNewCandle({ candle: builtCandle, symbol })
			}
		}

		this.time = time
	}

	/**
	 * Sets time back to 0 and clears present and past candles and optional future and all candles.
	 *
	 * @param keepCandlesAndTimeline whether to remove candles set using setPriceHistory.
	 */
	public reset(keepCandlesAndTimeline: boolean = true): void {
		this.timelineIndex = 0
		this.time = 0

		this.candles.present = {}
		this.candles.past = {}

		if (keepCandlesAndTimeline) {
			this.candles.all = this.getAllCandlesClone()
			for (const symbolTimeframe in this.currentIndexes) {
				this.currentIndexes[symbolTimeframe as SymbolTimeframeKey] = -1
			}
		} else {
			this.candles.all = {}
			this.timeline = []
			this.currentIndexes = {}
		}
	}

	/**
	 * Sets time to time at next index on timeline.
	 */
	public next(onNewCandle?: NewCandleCallback): boolean {
		if (!this.timeline[this.timelineIndex + 1]) {
			return false
		}
		this.timelineIndex++
		this.setTimelineIndex(this.timelineIndex, onNewCandle)
		return true
	}

	/**
	 * Sets price history that will be iterated through.
	 */
	public setPriceHistory(priceHistoryArr: PriceHistory[]): void {
		const previousTime = this.time
		this.reset(false)

		const candlesBySymbolTimeframe: CandlesBySymbolTimeframe = {}
		for (const priceHistory of priceHistoryArr) {
			const { symbol, timeframe, candles } = priceHistory
			const symbolTimeframeKey = `${symbol}_${timeframe}` as SymbolTimeframeKey
			candlesBySymbolTimeframe[symbolTimeframeKey] = candles

			// 'all' will be set with this.getAllCandlesClone()
			this.candles.past[symbolTimeframeKey] = []
			this.candles.present[symbolTimeframeKey] = []

			this.currentIndexes[symbolTimeframeKey] = -1
		}

		// prevents the original object from being manipulated.
		this.getAllCandlesClone = new Function(
			`return ${JSON.stringify(candlesBySymbolTimeframe)}`
		) as () => CandlesBySymbolTimeframe

		this.candles.all = this.getAllCandlesClone()

		if (previousTime !== 0) this.setTime(previousTime)
	}

	/**
	 * Return value set inside this.setPriceHistory. Returns a copy of the priceHistory array.
	 */
	private getAllCandlesClone(): CandlesBySymbolTimeframe {
		return {}
	}

	/**
	 * Create a candle from smaller timeframe candles
	 */
	private *candleGenerator(startingCandle: Candle): Generator<Candle | undefined, void, Candle> {
		let builtCandle = { ...startingCandle }
		try {
			while (true) {
				const nextCandle: Candle = yield
				builtCandle.close = nextCandle.close
				builtCandle.volume += nextCandle.volume
				builtCandle.time = nextCandle.time > builtCandle.time ? nextCandle.time : builtCandle.time
				builtCandle.high = nextCandle.high > builtCandle.high ? nextCandle.high : builtCandle.high
				builtCandle.low = nextCandle.low < builtCandle.low ? nextCandle.low : builtCandle.low
			}
		} finally {
			yield builtCandle
		}
	}
}
