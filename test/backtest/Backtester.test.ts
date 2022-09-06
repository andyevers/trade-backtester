import { Backtester } from '@src/backtest'
import Broker from '@src/backtest/Broker'
import Timeline from '@src/backtest/Timeline'
import { BaseClient } from '@src/client'
import { Account } from '@src/repository/AccountRepository'
import EntityManager from '@src/repository/EntityManager'
import { PriceHistoryCreateParams } from '@src/repository/PriceHistoryRepository'
import { Candle } from '@src/types'

describe('Broker', () => {
	let entityManager: EntityManager
	let timeline: Timeline

	let broker: Broker
	let account: Account
	let backtester: Backtester

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
		priceHistoryDay = {
			symbol: 'AAPL',
			timeframe: 'hour4',
			candles: candles('hour4', MS_TIME_START_AAPL, [
				{ open: 2, high: 4, low: 1, close: 3 },
				{ open: 3, high: 5, low: 2, close: 4 },
				{ open: 4, high: 6, low: 3, close: 5 },
				{ open: 5, high: 7, low: 4, close: 6 },
				{ open: 4, high: 6, low: 3, close: 5 },
				{ open: 3, high: 5, low: 2, close: 4 },
				{ open: 2, high: 4, low: 1, close: 3 }
			])
		}

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

		const ITERATIONS = 300

		for (let i = 0; i < ITERATIONS; i++) {
			candlesDay.push(...demoCandles)
		}
		priceHistoryDay.candles = candles('day', MS_TIME_START_AAPL, candlesDay)

		backtester = new Backtester({
			priceHistory: priceHistoryDay,
			startingCash: 10000,
			startTime: MS_TIME_START_AAPL
		})
	})

	const logResult = (result: { name: string; iterations: number; time: number }) => {
		// if (!USE_LOGS) return
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

	test('runTest', () => {
		let i = 0
		let client: BaseClient

		let orderCount = 0
		// let equity2 =
		let time = performance.now()
		const results = backtester.runTest({
			init(backtestClient) {
				client = backtestClient
				// client.placeOrder({
				// 	orderQty: 30,
				// 	symbol: 'AAPL',
				// 	type: 'LONG'
				// })
				// console.log('init')
			},
			next(candleBySymbol) {
				if (i % 3 === 0) {
					// client.placeOrder({
					// 	orderQty: 30,
					// 	symbol: 'AAPL',
					// 	type: 'LONG'
					// })
					orderCount++
				}
				if (i % 5 === 0) {
					// client.closeOrders({
					// 	symbol: 'AAPL',
					// 	type: 'LONG'
					// })
					// orderCount++
				}
				i++
			}
		})

		time = performance.now() - time

		const entityManager = backtester.getEntityManager()
		const accountRepository = entityManager.getRepository('account')
		const positionRepository = entityManager.getRepository('position')
		account = accountRepository.get(1) as Account
		const positions = positionRepository.getAll()

		// console.log(orderCount)
		// console.log(account)
		// console.log(positions.length)
		// console.log(results)
		logResult({ name: 'Timeline.setTime', iterations: i, time })
		// console.log(backtest.get)
		// const analyzer = backtester.getResultsAnalyzer()
		// console.log(analyzer.stopWatchingStrategy())
	})
})
