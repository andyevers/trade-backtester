import Broker from '@src/backtest/Broker'
import Timeline from '@src/backtest/Timeline'
import Backtester from '@src/Backtester'
import { BaseClient } from '@src/client'
import BacktestClient from '@src/client/BacktestClient'
import { Account } from '@src/repository'
import EntityManager from '@src/repository/EntityManager'
import { PriceHistoryCreateParams } from '@src/repository/PriceHistoryRepository'
import { ServiceManager } from '@src/service'
import { Strategy } from '@src/strategy/DemoStrategy'
import { Candle, CandleBySymbol } from '@src/types'

describe('Performance', () => {
	let backtestClient: BacktestClient
	let entityManager: EntityManager
	let broker: Broker
	let timeline: Timeline
	let serviceManager: ServiceManager

	let priceHistoryDay: PriceHistoryCreateParams
	let priceHistoryHour4: PriceHistoryCreateParams

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
		serviceManager = new ServiceManager({ entityManager })
		broker = new Broker({ entityManager, serviceManager })
		backtestClient = new BacktestClient({ entityManager, broker })
		timeline = broker.getTimeline()

		const demoCandles: {
			low: number
			open: number
			high: number
			close: number
		}[] = [
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

		let candlesDay: typeof demoCandles = []
		let candlesHour4: typeof demoCandles = []

		priceHistoryDay = {
			symbol: 'AAPL',
			timeframe: 'day',
			candles: []
		}

		priceHistoryHour4 = {
			symbol: 'AAPL',
			timeframe: 'hour4',
			candles: []
		}

		const ITERATIONS = 10000

		for (let i = 0; i < ITERATIONS; i++) {
			candlesDay.push(...demoCandles)
			candlesHour4.push(...demoCandles)
		}
		priceHistoryDay.candles = candles('day', MS_TIME_START_AAPL, candlesDay)
		priceHistoryHour4.candles = candles('hour4', MS_TIME_START_AAPL, candlesHour4)

		const accountRepository = entityManager.getRepository('account')
		accountA = accountRepository.create({ startingCash: 20000 })
		accountB = accountRepository.create({ startingCash: 10000 })
	})

	test('Performance Timeline.setTime', () => {
		broker.init({
			priceHistory: priceHistoryDay,
			startTime: MS_TIME_START_AAPL
		})

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
		 *
		 * Results 2022-09-01
		 * iterations: 100,000
		 * time:       40ms
		 * notes:      after changing to ServiceManager.getService() instead of this.accountService
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

	test('performance triggers', () => {
		const ITERATIONS = 100000
		const triggerRepository = entityManager.getRepository('trigger')

		let time = performance.now()
		for (let i = 0; i < ITERATIONS; i++) {
			triggerRepository.create({
				category: 'position',
				label: 'takeProfit',
				price: 3,
				symbol: 'AAPL',
				type: 'crossAbove'
			})
		}
		time = performance.now() - time

		/**
		 * Results 2022-08-31
		 * iterations: 100,000
		 * time:       35ms
		 */
		logResult({ name: 'TriggerRepository.create', iterations: ITERATIONS, time })
	})

	test('performance TriggerService.processCandle', () => {
		const ITERATIONS = 100000
		const triggerService = serviceManager.getService('trigger')
		const accountService = serviceManager.getService('account')

		for (let i = 0; i < 400; i++) {
			accountService.placeOrder({
				accountId: accountA.id,
				symbol: 'AAPL',
				type: 'LONG',
				orderQty: 30,
				orderTime: priceHistoryDay.candles[0].time,
				orderType: 'MARKET',
				orderPrice: 200
			})
		}

		const candle = priceHistoryDay.candles[1]

		let time = performance.now()
		for (let i = 0; i < ITERATIONS; i++) {
			triggerService.processCandle('AAPL', candle)
		}
		time = performance.now() - time

		/**
		 * Results 2022-09-02
		 * iterations: 1,000
		 * time:       75ms
		 * notes:      SUPER SLOW! Fix this.
		 *
		 * Results 2022-09-02
		 * iterations: 100,000
		 * time:       17ms
		 * notes:      after switching to using TriggerRepository.incrementIndex instead of checking all triggers every candle.
		 */
		logResult({ name: 'TriggerService.processCandle', iterations: ITERATIONS, time })
	})

	test('Performance Place Order', () => {
		const ITERATIONS = 100000
		const accountService = serviceManager.getService('account')
		let time = performance.now()
		for (let i = 0; i < ITERATIONS; i++) {
			accountService.placeOrder({
				accountId: accountA.id,
				symbol: 'AAPL',
				type: 'LONG',
				orderQty: 30,
				orderTime: priceHistoryDay.candles[0].time,
				orderType: 'MARKET',
				orderPrice: 200
			})
		}

		time = performance.now() - time

		/**
		 * Results 2022-09-02
		 * iterations: 100,000
		 * time:       575ms
		 * notes:      Slow. speed this up
		 *
		 * iterations: 100,000
		 * time:       138ms
		 * notes:      Removed createPendingOrder from accountService. Spread op on params was slow.
		 */
		logResult({ name: 'Place Order', iterations: ITERATIONS, time })
	})

	test('Performance Backtester', () => {
		const positionCount = 2000
		let i = 0
		class DemoStrategy implements Strategy {
			private client!: BaseClient

			init(client: BaseClient): void {
				this.client = client
			}

			next(candleBySymbol: CandleBySymbol): void {
				for (const symbol in candleBySymbol) {
					if (i >= positionCount) continue
					this.client.placeOrder({
						symbol,
						orderQty: 30,
						type: 'LONG',
						takeProfit: 5,
						stopLoss: 2
					})
					i++
				}
			}
		}

		const backtest = new Backtester({
			priceHistory: priceHistoryDay,
			startingCash: 20000,
			startTime: MS_TIME_START_AAPL
		})
		const strategy = new DemoStrategy()

		let time = performance.now()
		backtest.runTest(strategy)
		time = performance.now() - time

		/**
		 * Results 2022-09-02
		 * iterations: 100,000
		 * time:       113ms
		 */
		logResult({ name: 'Backtester', iterations: priceHistoryDay.candles.length, time })
	})
})
