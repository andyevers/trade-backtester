import { PriceHistoryCreateParams, SymbolTimeframeKey, TimeframeType } from '../repository'
import { Candle, CandleBySymbol } from '../types'

interface CandlesBySymbolTimeframe {
	[key: SymbolTimeframeKey]: Candle[]
}

export interface NewCandleData {
	candle: Candle
	symbol: string
	timeframe: TimeframeType
}

interface SetTimeCallbacks {
	onNewCandle?: (data: NewCandleData) => void
	onNewCandleBuilt?: (data: NewCandleData) => void
}

/**
 * Manages current candles and time while broker is running.
 */
export default class Timeline {
	private time: number = 0
	private timelineIndex: number = 0
	private timeline: number[] = []

	private currentIndexes: {
		[stfKey: SymbolTimeframeKey]: number
	} = {}

	private candlesByStfKey: {
		[stfKey: SymbolTimeframeKey]: Candle[]
	} = {}

	private latestCandlesBuilt: {
		[symbol: string]: Candle
	} = {}

	private nextCandles: {
		[stfKey: SymbolTimeframeKey]: Candle[]
	} = {}

	private mainTimeframe: TimeframeType = 'day'

	private candleCallbacks: SetTimeCallbacks = {}

	public setCandleCallbacks(callbacks: SetTimeCallbacks) {
		this.candleCallbacks = callbacks
	}

	public initFromPriceHistory(
		symbol: string,
		timeframe: TimeframeType,
		callbacks: SetTimeCallbacks = {}
	): void {
		const candlesByStfKey = this.getAllCandlesClone()
		const stfKey = `${symbol}_${timeframe}` as SymbolTimeframeKey
		const candles = candlesByStfKey[stfKey]

		if (!candles) {
			throw new Error(`No candles found for symbol ${symbol} and timeframe ${timeframe}`)
		}

		this.setTimeline(candles.map((c) => c.time))
		this.setMainTimeframe(timeframe)
		this.setCandleCallbacks(callbacks)
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
	 * sets current index and time to time at the provided index from this.timeline.
	 */
	public setTimelineIndex(index: number): void {
		const timeAtIndex = this.timeline[index]
		if (this.timeline.length === 0) {
			throw new Error('You must set a timeline before using setTimelineIndex')
		}
		this.setTime(timeAtIndex)
		this.timelineIndex = index
	}

	/**
	 * Candles that appear multiple in one increment will be combined into a single candle.
	 * Note: These are not necessarily current candles, just the latest built candle for that symbol timeframe
	 */
	public getLatestCandleBuilt(symbol: string): Candle | null {
		return this.latestCandlesBuilt[symbol] || null
	}

	public getLatestCandlesBuilt(): CandleBySymbol {
		return this.latestCandlesBuilt
	}

	/**
	 * Past candles includes current candles
	 */
	public getAllCandles(symbol: string, timeframe: TimeframeType): Candle[] {
		const key = `${symbol}_${timeframe}` as SymbolTimeframeKey
		return this.candlesByStfKey[key] || []
	}

	public getCurrentCandles(symbol: string, timeframe: TimeframeType): Candle[] {
		return this.nextCandles[`${symbol}_${timeframe}` as SymbolTimeframeKey] || []
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
		for (const symbolTimeframe in this.nextCandles) {
			this.nextCandles[symbolTimeframe as SymbolTimeframeKey] = []
		}
	}

	public getTimelineIndex(): number {
		return this.timelineIndex
	}

	/**
	 * Moves all candles with datetime at or before this time to 'current' and 'past' candles
	 */
	public setTime(time: number, callbacks?: SetTimeCallbacks): void {
		const { onNewCandle = () => {}, onNewCandleBuilt = () => {} } = callbacks || this.candleCallbacks

		const timeTimelineEnd = this.timeline[this.timeline.length - 1]
		if (time > timeTimelineEnd) {
			throw new Error(
				`You cannot set the time past later than the final timeline value ${timeTimelineEnd}`
			)
		}

		if (time < this.time) {
			throw new Error(
				`You cannot go back in time from ${this.time} to ${time}. use reset() to start over.`
			)
		}

		const builtCandleSymbols: { [symbol: string]: boolean } = {}

		for (const symbolTimeframe in this.candlesByStfKey) {
			const stfKey = symbolTimeframe as SymbolTimeframeKey
			const candlesAll = this.candlesByStfKey[stfKey]

			const [symbol, timeframe] = stfKey.split('_') as [string, TimeframeType]
			const isMainTf = timeframe === this.mainTimeframe

			let nextIndex = this.currentIndexes[stfKey] + 1

			// if candles are done iterating, use last index for current index and continue
			if (nextIndex >= candlesAll.length) continue

			// if main timeframe and time, skip candleGenerator
			if (isMainTf && candlesAll[nextIndex]?.time === time) {
				// TODO: Reduce duplicated code.
				const candle = candlesAll[nextIndex]
				this.nextCandles[stfKey] = [candle]
				this.currentIndexes[stfKey] = nextIndex

				this.latestCandlesBuilt[symbol] = candle
				builtCandleSymbols[symbol] = true
				onNewCandle({ candle, symbol, timeframe })
				onNewCandleBuilt({ candle: candle, symbol, timeframe })
				continue
			}

			this.nextCandles[stfKey] = [] // reset next candles

			// the current candle or combined candle if sub-timeframe
			const candleGenerator = this.candleGenerator(candlesAll[nextIndex])
			while (candlesAll[nextIndex]?.time <= time) {
				const candle = candlesAll[nextIndex]
				candleGenerator.next(candle)
				this.nextCandles[stfKey].push(candle)

				this.currentIndexes[stfKey]++
				nextIndex++
				onNewCandle({ candle, symbol, timeframe })
			}

			const builtCandle = candleGenerator.return().value as Candle

			// no candles in current time
			if (!builtCandle) continue

			// TODO: This can cause issues with certain candles not being counted
			// if 2 non-main timeframes (like month and minute) month may be skipped
			// or vice-versa (depending which appears first in the object).
			const hasMainTf = this.candlesByStfKey[`${symbol}_${this.mainTimeframe}`]
			const didBuildCandle = builtCandleSymbols[symbol] === true

			if (isMainTf || !hasMainTf || !didBuildCandle) {
				this.latestCandlesBuilt[symbol] = builtCandle
				builtCandleSymbols[symbol] = true
				onNewCandleBuilt({ candle: builtCandle, symbol, timeframe })
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

		this.nextCandles = {}

		if (keepCandlesAndTimeline) {
			this.candlesByStfKey = this.getAllCandlesClone()
			for (const symbolTimeframe in this.currentIndexes) {
				this.currentIndexes[symbolTimeframe as SymbolTimeframeKey] = -1
			}
		} else {
			this.getAllCandlesClone = () => {
				return {}
			}
			this.candlesByStfKey = {}
			this.timeline = []
			this.currentIndexes = {}
		}
	}

	/**
	 * Sets time to time at next index on timeline.
	 */
	public next(): boolean {
		if (!this.timeline[this.timelineIndex + 1]) {
			return false
		}
		this.timelineIndex++
		this.setTimelineIndex(this.timelineIndex)
		return true
	}

	/**
	 * Sets price history that will be iterated through.
	 */
	public setPriceHistory(priceHistoryArr: PriceHistoryCreateParams[]): void {
		const previousTime = this.time
		this.reset(false)

		const candlesBySymbolTimeframe: CandlesBySymbolTimeframe = {}
		for (const priceHistory of priceHistoryArr) {
			const { symbol, timeframe, candles } = priceHistory
			const stfKey = `${symbol}_${timeframe}` as SymbolTimeframeKey
			candlesBySymbolTimeframe[stfKey] = candles

			this.nextCandles[stfKey] = []
			this.currentIndexes[stfKey] = -1
		}

		// prevents the original object from being manipulated.
		this.getAllCandlesClone = new Function(
			`return ${JSON.stringify(candlesBySymbolTimeframe)}`
		) as () => CandlesBySymbolTimeframe

		this.candlesByStfKey = this.getAllCandlesClone()

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
	 * TODO: This is only used to get current prices on additional priceHistory and it's pretty slow
	 * about 10ms - 15ms in 70,000 iterations
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
