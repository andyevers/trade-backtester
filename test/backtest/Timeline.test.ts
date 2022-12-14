import Timeline from '@src/backtest/Timeline'
import EntityManager from '@src/repository/EntityManager'
import { PriceHistoryCreateParams } from '@src/repository/PriceHistoryRepository'
import { Candle } from '@src/types'

describe('Timeline', () => {
	let entityManager: EntityManager
	let timeline: Timeline

	let priceHistoryDay: PriceHistoryCreateParams
	let priceHistoryHour4: PriceHistoryCreateParams
	let priceHistoryHour4GM: PriceHistoryCreateParams
	let priceHistoryPast: PriceHistoryCreateParams
	let priceHistoryFuture: PriceHistoryCreateParams

	// 2022-08-20
	const MS_TIME_START_AAPL = 1661002943915
	const MS_TIME_START_GM = 1661024543915
	const MS_TIMES = {
		day: 86400000,
		hour4: 14400000
	}

	const candles = (
		tf: 'hour4' | 'day',
		startTime: number,
		prices: { low: number; open: number; high: number; close: number }[]
	): Candle[] => {
		const interval = MS_TIMES[tf]
		return prices.map((priceData, i) => {
			const { close, high, low, open } = priceData
			const time = interval * i + startTime
			return { close, high, low, open, time, volume: 100 }
		})
	}

	beforeEach(() => {
		entityManager = new EntityManager()
		timeline = new Timeline()

		const priceHistoryArr: PriceHistoryCreateParams[] = []

		priceHistoryDay = {
			symbol: 'AAPL',
			timeframe: 'day',
			candles: candles('day', MS_TIME_START_AAPL, [
				{ open: 2, high: 4, low: 1, close: 3 },
				{ open: 3, high: 5, low: 2, close: 4 },
				{ open: 4, high: 6, low: 3, close: 5 },
				{ open: 5, high: 7, low: 4, close: 6 },
				{ open: 4, high: 6, low: 3, close: 5 },
				{ open: 3, high: 5, low: 2, close: 4 },
				{ open: 2, high: 4, low: 1, close: 3 }
			])
		}

		priceHistoryHour4 = {
			symbol: 'AAPL',
			timeframe: 'hour4',
			candles: candles('hour4', MS_TIME_START_AAPL, [
				{ open: 2.0, high: 4.0, low: 1.0, close: 3.0 },
				{ open: 2.25, high: 4.25, low: 1.25, close: 3.25 },
				{ open: 2.5, high: 4.5, low: 1.5, close: 3.5 },
				{ open: 2.75, high: 4.75, low: 1.75, close: 3.75 },
				{ open: 3.0, high: 5.1, low: 2.0, close: 4.0 },
				{ open: 3.25, high: 5.25, low: 2.25, close: 4.25 },
				{ open: 3.5, high: 5.5, low: 2.5, close: 4.5 },
				{ open: 3.75, high: 5.75, low: 2.75, close: 4.75 },
				{ open: 4.0, high: 6.0, low: 3.0, close: 5.0 },
				{ open: 4.25, high: 6.25, low: 3.25, close: 5.25 },
				{ open: 4.5, high: 6.5, low: 2.5, close: 4.5 },
				{ open: 4.75, high: 6.75, low: 2.75, close: 4.75 },
				{ open: 5.0, high: 7.0, low: 3.0, close: 5.0 },
				{ open: 4.75, high: 6.75, low: 2.75, close: 4.75 }
			])
		}

		priceHistoryHour4GM = {
			symbol: 'GM',
			timeframe: 'hour4',
			candles: candles('hour4', MS_TIME_START_GM, [
				{ open: 2.25, high: 4.25, low: 1.25, close: 3.25 },
				{ open: 2.5, high: 4.5, low: 1.5, close: 3.5 },
				{ open: 2.75, high: 4.75, low: 1.75, close: 3.75 },
				{ open: 3.0, high: 5.9, low: 2.0, close: 4.0 },
				{ open: 3.25, high: 5.25, low: 2.25, close: 4.25 },
				{ open: 3.5, high: 5.5, low: 2.5, close: 4.5 },
				{ open: 3.75, high: 5.75, low: 2.75, close: 4.75 },
				{ open: 4.0, high: 6.0, low: 3.0, close: 5.0 }
			])
		}

		priceHistoryPast = {
			symbol: 'AAL',
			timeframe: 'day',
			candles: candles('day', 0, [
				{ open: 2.25, high: 4.25, low: 1.25, close: 3.25 },
				{ open: 2.5, high: 4.5, low: 1.5, close: 3.5 },
				{ open: 2.75, high: 4.75, low: 1.75, close: 3.75 },
				{ open: 3.0, high: 5.0, low: 2.0, close: 4.0 },
				{ open: 3.25, high: 5.25, low: 2.25, close: 4.25 },
				{ open: 3.5, high: 5.5, low: 2.5, close: 4.5 },
				{ open: 3.75, high: 5.75, low: 2.75, close: 4.75 },
				{ open: 4.0, high: 6.0, low: 3.0, close: 5.0 }
			])
		}

		priceHistoryFuture = {
			symbol: 'AAL',
			timeframe: 'hour4',
			candles: candles('day', 9999999999999, [
				{ open: 2.25, high: 4.25, low: 1.25, close: 3.25 },
				{ open: 2.5, high: 4.5, low: 1.5, close: 3.5 },
				{ open: 2.75, high: 4.75, low: 1.75, close: 3.75 },
				{ open: 3.0, high: 5.0, low: 2.0, close: 4.0 },
				{ open: 3.25, high: 5.25, low: 2.25, close: 4.25 },
				{ open: 3.5, high: 5.5, low: 2.5, close: 4.5 },
				{ open: 3.75, high: 5.75, low: 2.75, close: 4.75 },
				{ open: 4.0, high: 6.0, low: 3.0, close: 5.0 }
			])
		}
		priceHistoryArr.push(
			priceHistoryDay,
			priceHistoryHour4,
			priceHistoryHour4GM,
			priceHistoryPast,
			priceHistoryFuture
		)

		timeline.setPriceHistory(priceHistoryArr)
		timeline.initFromPriceHistory('AAPL', 'day', {
			onNewCandle(data) {
				const { candle, symbol, timeframe } = data
				const priceHistoryRepository = entityManager.getRepository('priceHistory')
				priceHistoryRepository.addCandle({ candle, symbol, timeframe })
			}
		})
	})

	test('getCurrentCandles, next, setTime', () => {
		const candlesDay = priceHistoryDay.candles
		const candlesHour4 = priceHistoryHour4.candles

		const getCurrentCandlesDay = () => timeline.getCurrentCandles('AAPL', 'day')
		const getCurrentCandlesHour4 = () => timeline.getCurrentCandles('AAPL', 'hour4')

		// assert current candles at start time are empty
		expect(getCurrentCandlesDay()).toEqual([])
		expect(getCurrentCandlesHour4()).toEqual([])

		timeline.next()

		// candles at index 1
		expect(getCurrentCandlesDay()).toEqual([candlesDay[1]])
		// 6 candles because 6 hour4 candles is 1 day candle.
		expect(getCurrentCandlesHour4()).toEqual([
			candlesHour4[1],
			candlesHour4[2],
			candlesHour4[3],
			candlesHour4[4],
			candlesHour4[5],
			candlesHour4[6]
		])

		timeline.next()

		// assert contains present candles, not past
		expect(getCurrentCandlesDay()).toEqual([candlesDay[2]])
		expect(getCurrentCandlesHour4()).toEqual([
			candlesHour4[7],
			candlesHour4[8],
			candlesHour4[9],
			candlesHour4[10],
			candlesHour4[11],
			candlesHour4[12]
		])
	})

	test('getLatestCandleBuilt', () => {
		const candlesDay = priceHistoryDay.candles

		timeline.next()

		const candlesPresentH4 = timeline.getCurrentCandles('GM', 'hour4')
		const candleBuiltH4: Candle = {
			close: candlesPresentH4[candlesPresentH4.length - 1].close,
			high: candlesPresentH4.reduce((high, c) => Math.max(c.high, high), candlesPresentH4[0].high),
			low: candlesPresentH4.reduce((high, c) => Math.min(c.high, high), candlesPresentH4[0].low),
			open: candlesPresentH4[0].open,
			time: candlesPresentH4[candlesPresentH4.length - 1].time,
			volume: candlesPresentH4.reduce((vol, c) => (vol += c.volume), 0)
		}

		expect(timeline.getLatestCandleBuilt('GM')).toEqual(candleBuiltH4)
		expect(timeline.getLatestCandleBuilt('AAPL')).toEqual(candlesDay[1])
	})

	test('getMainTimeframe, getTime, getTimeline', () => {
		expect(timeline.getMainTimeframe()).toBe(priceHistoryDay.timeframe)
		expect(timeline.getTime()).toBe(priceHistoryDay.candles[0].time)
		expect(timeline.getTimeline()).toEqual(priceHistoryDay.candles.map((c) => c.time))
	})

	test('reset', () => {
		// reset and keep candles
		timeline.reset(true)
		expect(timeline.getAllCandles('AAPL', 'day')).toEqual(priceHistoryDay.candles)

		// reset and clear candles
		timeline.reset(false)
		expect(timeline.getAllCandles('AAPL', 'day')).toEqual([])
	})
})
