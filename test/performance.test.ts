import Test from '@src/../unused/Test'
import { Candle } from '@src/types'
import process from 'process'
import os from 'os'
import CandleService from '@src/../unused/CandleService'
import Broker from '@src/broker/Broker'
import Timeline from '@src/broker/Timeline'
import EntityManager from '@src/repository/EntityManager'
import PriceHistoryRepository, {
	PriceHistory,
	PriceHistoryCreateParams
} from '@src/repository/PriceHistoryRepository'
import AccountService from '@src/service/AccountService'
import PositionService from '@src/service/PositionService'
import { Account } from '@src/repository/AccountRepository'
import TriggerService from '@src/service/TriggerService'
import BacktestClient from '@src/client/BacktestClient'

type CandleMap = {
	[symbol: string]: {
		[timeframe: string]: Candle[]
	}
}

describe('hi', () => {
	let backtestClient: BacktestClient
	let entityManager: EntityManager
	let broker: Broker
	let timeline: Timeline
	let accountService: AccountService
	let positionService: PositionService
	let triggerService: TriggerService

	let priceHistoryDay: PriceHistoryCreateParams

	// 2022-08-20
	const MS_TIME_START_AAPL = 1661002943915
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
			candles: []
		}

		let candlesDay: {
			low: number
			open: number
			high: number
			close: number
		}[] = []

		const ITERATIONS = 10000
		for (let i = 0; i < ITERATIONS; i++) {
			candlesDay.push(
				...[
					{ open: 2, high: 4, low: 1, close: 3 },
					{ open: 3, high: 5, low: 2, close: 4 },
					{ open: 4, high: 6, low: 3, close: 5 },
					{ open: 5, high: 7, low: 4, close: 6 },
					{ open: 4, high: 6, low: 3, close: 5 },
					{ open: 3, high: 5, low: 2, close: 4 },
					{ open: 2, high: 4, low: 1, close: 3 },
					{ open: 4, high: 6, low: 3, close: 5 },
					{ open: 5, high: 7, low: 4, close: 6 },
					{ open: 4, high: 6, low: 3, close: 5 },
					{ open: 3, high: 5, low: 2, close: 4 },
					{ open: 2, high: 4, low: 1, close: 3 }
				]
			)
		}
		priceHistoryDay.candles = candles('day', MS_TIME_START_AAPL, candlesDay)

		broker.init({
			accounts: [{ startingCash: 20000 }, { startingCash: 10000 }],
			priceHistory: priceHistoryDay,
			startTime: MS_TIME_START_AAPL
		})
	})

	test('Performance Timeline.setTime', () => {
		let i = 0
		console.time('timeline.setTime')
		while (timeline.next() && i < 1000000) {
			i++
		}
		console.timeEnd('timeline.setTime')

		console.time('Array.push')
		const candles = []
		for (let b = 0; b < i; b++) {
			candles.push(priceHistoryDay.candles[b])
		}
		console.timeEnd('Array.push')
		console.log(`${i} iterations`)
	})
})
