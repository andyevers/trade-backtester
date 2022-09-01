import Broker from '@src/broker/Broker'
import Timeline from '@src/broker/Timeline'
import BacktestClient from '@src/client/BacktestClient'
import { Account } from '@src/repository'
import EntityManager from '@src/repository/EntityManager'
import { PriceHistoryCreateParams } from '@src/repository/PriceHistoryRepository'
import AccountService from '@src/service/AccountService'
import PositionService from '@src/service/PositionService'
import TriggerService from '@src/service/TriggerService'
import { Candle } from '@src/types'

describe('Performance', () => {
	let backtestClient: BacktestClient
	let entityManager: EntityManager
	let broker: Broker
	let timeline: Timeline
	let accountService: AccountService
	let positionService: PositionService
	let triggerService: TriggerService

	let priceHistoryDay: PriceHistoryCreateParams

	let accountA: Account
	let accountB: Account
	// 2022-08-20
	const MS_TIME_START_AAPL = 1661002943915
	const MS_TIMES = {
		day: 86400000,
		hour4: 14400000
	}

	const logResult = (result: { name: string; iterations: number; time: number }) => {
		const cyan = '\x1b[36m'
		const reset = '\x1b[0m'
		console.log(
			`${cyan}${result.name}${reset}`,
			'\n',
			`iterations: ${result.iterations.toLocaleString('en-US')}`,
			'\n',
			`time:       ${Math.round(result.time).toLocaleString('en-US')}ms`
		)
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
					{ open: 4, high: 6, low: 3, close: 5 }
				]
			)
		}
		priceHistoryDay.candles = candles('day', MS_TIME_START_AAPL, candlesDay)

		const accountRepository = entityManager.getRepository('account')
		accountA = accountRepository.create({ startingCash: 20000 })
		accountB = accountRepository.create({ startingCash: 10000 })

		broker.init({
			accountIds: [accountA.id, accountB.id],
			priceHistory: priceHistoryDay,
			startTime: MS_TIME_START_AAPL
		})
	})

	test('Performance Timeline.setTime', () => {
		// prevent infinite loop
		const maxIterations = 1000000 // 1 million

		let i = 1
		let time = performance.now()
		while (timeline.next()) {
			i++
			if (i > maxIterations) {
				throw new Error(`Did not finish before ${maxIterations.toLocaleString('en-US')} iterations`)
			}
		}
		time = performance.now() - time

		/**
		 * Results 2022-08-31
		 * iterations: 100,000
		 * time:       39ms
		 */
		logResult({ name: 'Timeline.setTime', iterations: i, time })
	})

	test('Performance PriceHistoryRepository.getIndexNearTime', () => {
		const ITERATIONS = 100000
		const priceHistoryRepository = entityManager.getRepository('priceHistory')
		priceHistoryRepository.addCandles({
			candles: priceHistoryDay.candles,
			symbol: 'AAPL',
			timeframe: 'day'
		})

		let time = performance.now()
		for (let i = 0; i < ITERATIONS; i++) {
			priceHistoryRepository.getIndexNearTime({
				symbol: 'AAPL',
				timeframe: 'day',
				time: MS_TIME_START_AAPL + 100 + i * MS_TIMES.day
			})
		}
		time = performance.now() - time

		/**
		 * Results 2022-08-31
		 * iterations: 100,000
		 * time:       35ms
		 */
		logResult({ name: 'PriceHistoryRepository.getIndexNearTime', iterations: ITERATIONS, time })
	})
})
