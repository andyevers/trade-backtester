import { Broker } from '@src/broker'
import BacktestClient from '@src/client/BacktestClient'
import { Account, PriceHistoryCreateParams } from '@src/repository'
import EntityManager from '@src/repository/EntityManager'
import { Candle } from '@src/types'

describe('BacktestClient', () => {
	let backtestClient: BacktestClient
	let entityManager: EntityManager
	let broker: Broker

	let priceHistoryDay: PriceHistoryCreateParams
	let priceHistoryHour4: PriceHistoryCreateParams
	let priceHistoryHour4GM: PriceHistoryCreateParams

	let accountA: Account
	let accountB: Account

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
		broker = new Broker({ entityManager })
		backtestClient = new BacktestClient({ entityManager, broker })

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
				{ open: 3.0, high: 5.0, low: 2.0, close: 4.0 },
				{ open: 3.25, high: 5.25, low: 2.25, close: 4.25 },
				{ open: 3.5, high: 5.5, low: 2.5, close: 4.5 },
				{ open: 3.75, high: 5.75, low: 2.75, close: 4.75 },
				{ open: 4.0, high: 6.0, low: 3.0, close: 5.0 }
			])
		}

		const accountRepository = entityManager.getRepository('account')
		accountA = accountRepository.create({ startingCash: 20000 })
		accountB = accountRepository.create({ startingCash: 10000 })

		broker.init({
			accountIds: [accountA.id, accountB.id],
			priceHistory: priceHistoryDay,
			priceHistoryAdditional: [priceHistoryHour4, priceHistoryHour4GM],
			startTime: MS_TIME_START_AAPL
		})
	})

	test('getCandles', () => {
		const candlesDay = priceHistoryDay.candles
		const candlesHour4 = priceHistoryHour4.candles
		const candlesHour4GM = priceHistoryHour4GM.candles

		const getCandlesDay = () => backtestClient.getCandles({ symbol: 'AAPL', timeframe: 'day' })
		const getCandlesHour4 = () => backtestClient.getCandles({ symbol: 'AAPL', timeframe: 'hour4' })
		const getCandlesHour4GM = () => backtestClient.getCandles({ symbol: 'GM', timeframe: 'hour4' })

		// GM should not exist in repository until candles are in past.
		const priceHistoryRepository = entityManager.getRepository('priceHistory')
		expect(priceHistoryRepository.getAll().find((c) => c.symbol === 'GM')).toBeUndefined()

		// assert current candles at start time
		expect(getCandlesDay()).toEqual([candlesDay[0]])
		expect(getCandlesHour4()).toEqual([candlesHour4[0]])
		expect(getCandlesHour4GM()).toEqual([])

		broker.next()

		// candles at index 1
		expect(getCandlesDay()).toEqual([candlesDay[0], candlesDay[1]])
		expect(getCandlesHour4()).toEqual([
			candlesHour4[0],
			candlesHour4[1],
			candlesHour4[2],
			candlesHour4[3],
			candlesHour4[4],
			candlesHour4[5],
			candlesHour4[6]
		])
		expect(getCandlesHour4GM()).toEqual([
			candlesHour4GM[0],
			candlesHour4GM[1],
			candlesHour4GM[2],
			candlesHour4GM[3],
			candlesHour4GM[4]
		])

		broker.next()

		expect(getCandlesDay()).toEqual([candlesDay[0], candlesDay[1], candlesDay[2]])
		expect(getCandlesHour4()).toEqual([
			candlesHour4[0],
			candlesHour4[1],
			candlesHour4[2],
			candlesHour4[3],
			candlesHour4[4],
			candlesHour4[5],
			candlesHour4[6],
			candlesHour4[7],
			candlesHour4[8],
			candlesHour4[9],
			candlesHour4[10],
			candlesHour4[11],
			candlesHour4[12]
		])
		expect(getCandlesHour4GM()).toEqual([
			candlesHour4GM[0],
			candlesHour4GM[1],
			candlesHour4GM[2],
			candlesHour4GM[3],
			candlesHour4GM[4],
			candlesHour4GM[5],
			candlesHour4GM[6],
			candlesHour4GM[7]
		])
	})

	test('getAccount', () => {
		expect(backtestClient.getAccount()).toBe(accountA)
	})

	test('getPositions', () => {
		const orderMarket = broker.placeOrder({
			accountId: accountA.id,
			orderQty: 30,
			orderType: 'MARKET',
			symbol: 'AAPL',
			type: 'LONG'
		})

		expect(Object.values(backtestClient.getPositions())).toContain(orderMarket)
	})

	test('hasPositions', () => {
		backtestClient.placeOrder({
			orderQty: 30,
			orderType: 'MARKET',
			symbol: 'AAPL',
			type: 'LONG'
		})

		const hasOpenLong = backtestClient.hasPositions({
			status: 'OPEN',
			type: 'LONG'
		})

		const hasOpenLongGM = backtestClient.hasPositions({
			status: 'OPEN',
			symbol: 'GM',
			type: 'LONG'
		})

		const hasPendingLong = backtestClient.hasPositions({
			status: 'PENDING',
			symbol: 'GM',
			type: 'LONG'
		})

		expect(hasOpenLong).toBe(true)
		expect(hasOpenLongGM).toBe(false)
		expect(hasPendingLong).toBe(false)
	})
})
