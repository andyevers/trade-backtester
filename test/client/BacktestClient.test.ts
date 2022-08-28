import { Broker } from '@src/broker'
import Timeline from '@src/broker/Timeline'
import BacktestClient from '@src/client/BacktestClient'
import { PriceHistoryCreateParams } from '@src/repository'
import EntityManager from '@src/repository/EntityManager'
import { AccountService, PositionService, TriggerService } from '@src/service'
import { Candle } from '@src/types'

describe('BacktestClient', () => {
	let backtestClient: BacktestClient
	let entityManager: EntityManager
	let broker: Broker
	let timeline: Timeline
	let accountService: AccountService
	let positionService: PositionService
	let triggerService: TriggerService

	let priceHistoryDay: PriceHistoryCreateParams
	let priceHistoryDayTSLA: PriceHistoryCreateParams
	let priceHistoryHour4GM: PriceHistoryCreateParams

	// 2022-08-20
	const MS_TIME_START_AAPL_TSLA = 1661002943915
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
		positionService = new PositionService({ entityManager })
		accountService = new AccountService({ entityManager, positionService })
		triggerService = new TriggerService({ entityManager, accountService })
		broker = new Broker({ entityManager, timeline, accountService, positionService, triggerService })
		backtestClient = new BacktestClient({ entityManager, broker })

		priceHistoryDay = {
			symbol: 'AAPL',
			timeframe: 'day',
			candles: candles('day', MS_TIME_START_AAPL_TSLA, [
				{ open: 2, high: 4, low: 1, close: 3 },
				{ open: 3, high: 5, low: 2, close: 4 },
				{ open: 4, high: 6, low: 3, close: 5 },
				{ open: 5, high: 7, low: 4, close: 6 },
				{ open: 4, high: 6, low: 3, close: 5 },
				{ open: 3, high: 5, low: 2, close: 4 },
				{ open: 2, high: 4, low: 1, close: 3 }
			])
		}

		priceHistoryDayTSLA = {
			symbol: 'TSLA',
			timeframe: 'day',
			candles: candles('day', MS_TIME_START_AAPL_TSLA, [
				{ open: 20, high: 40, low: 10, close: 30 },
				{ open: 30, high: 50, low: 20, close: 40 },
				{ open: 40, high: 60, low: 30, close: 50 },
				{ open: 50, high: 70, low: 40, close: 60 },
				{ open: 40, high: 60, low: 30, close: 50 },
				{ open: 30, high: 50, low: 20, close: 40 },
				{ open: 20, high: 40, low: 10, close: 30 }
			])
		}

		priceHistoryHour4GM = {
			symbol: 'GM',
			timeframe: 'hour4',
			candles: candles('hour4', MS_TIME_START_GM, [
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

		broker.init({
			accounts: [{ startingCash: 20000 }, { startingCash: 10000 }],
			priceHistory: priceHistoryDay,
			priceHistoryAddional: [priceHistoryDayTSLA, priceHistoryHour4GM],
			startTime: MS_TIME_START_AAPL_TSLA
		})
	})

	test('getCandles', () => {
		const candles = backtestClient.getCandles({ symbol: 'AAPL', timeframe: 'day' })
		// expect(candles).toEqual([])
		// expect(candles).toEqual(candles('hour4', MS_TIME_START_AAPL, prices))
	})
})
