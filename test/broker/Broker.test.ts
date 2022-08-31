import Broker from '@src/broker/Broker'
import Timeline from '@src/broker/Timeline'
import { Account } from '@src/repository/AccountRepository'
import EntityManager from '@src/repository/EntityManager'
import { PriceHistoryCreateParams } from '@src/repository/PriceHistoryRepository'
import AccountService from '@src/service/AccountService'
import PositionService from '@src/service/PositionService'
import TriggerService from '@src/service/TriggerService'
import { Candle } from '@src/types'

describe('Broker', () => {
	let entityManager: EntityManager
	let timeline: Timeline
	let positionService: PositionService
	let accountService: AccountService
	let triggerService: TriggerService

	let broker: Broker
	let account: Account

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

		broker = new Broker({ accountService, entityManager, positionService, timeline, triggerService })
		account = entityManager.getRepository('account').create({ startingCash: 5000 })

		const priceHistoryArr: PriceHistoryCreateParams[] = []

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
		priceHistoryArr.push(priceHistoryDay, priceHistoryDayTSLA, priceHistoryHour4GM)

		timeline.setPriceHistory(priceHistoryArr)
		timeline.initFromPriceHistory('AAPL', 'day', {
			onNewCandle(data) {
				const { candle, symbol, timeframe } = data
				const priceHistoryRepository = entityManager.getRepository('priceHistory')
				priceHistoryRepository.addCandle({ candle, symbol, timeframe })
			}
		})
	})

	test('hasPositions', () => {
		broker.placeOrder({
			accountId: account.id,
			orderQty: 30,
			orderType: 'MARKET',
			symbol: 'AAPL',
			type: 'LONG'
		})

		const hasOpenLong = broker.hasPositions({
			accountId: account.id,
			status: 'OPEN',
			type: 'LONG'
		})

		const hasOpenLongGM = broker.hasPositions({
			accountId: account.id,
			status: 'OPEN',
			symbol: 'GM',
			type: 'LONG'
		})

		const hasPendingLong = broker.hasPositions({
			accountId: account.id,
			status: 'PENDING',
			symbol: 'GM',
			type: 'LONG'
		})

		expect(hasOpenLong).toBe(true)
		expect(hasOpenLongGM).toBe(false)
		expect(hasPendingLong).toBe(false)
	})

	test('getAccount', () => {
		const orderMarket = broker.placeOrder({
			accountId: account.id,
			orderQty: 30,
			orderType: 'MARKET',
			symbol: 'AAPL',
			type: 'LONG'
		})

		const accountWithPositions = broker.getAccount(account.id)

		expect(accountWithPositions.id).toBe(account.id)
		expect(accountWithPositions.cash).toBe(account.cash)
		expect(accountWithPositions.marginDebt).toBe(account.marginDebt)
		expect(accountWithPositions.startingCash).toBe(account.startingCash)
		expect(Object.values(accountWithPositions.positionsById)).toContain(orderMarket)
	})

	test('closeOrder', () => {
		const orderMarketA = broker.placeOrder({
			accountId: account.id,
			orderQty: 30,
			orderType: 'MARKET',
			symbol: 'AAPL',
			type: 'LONG'
		})

		const orderLimitA = broker.placeOrder({
			accountId: account.id,
			orderQty: 30,
			orderType: 'LIMIT',
			orderPrice: 30,
			symbol: 'TSLA',
			type: 'LONG'
		})

		broker.closeOrder({
			accountId: account.id,
			status: 'OPEN_PENDING'
		})

		expect(orderMarketA.status).toBe('CLOSED')
		expect(orderLimitA.status).toBe('CANCELED')

		const orderMarketB = broker.placeOrder({
			accountId: account.id,
			orderQty: 30,
			orderType: 'MARKET',
			symbol: 'AAPL',
			type: 'LONG'
		})

		const orderLimitB = broker.placeOrder({
			accountId: account.id,
			orderQty: 30,
			orderType: 'LIMIT',
			orderPrice: 30,
			symbol: 'TSLA',
			type: 'LONG'
		})

		broker.closeOrder({
			accountId: account.id,
			status: 'OPEN'
		})

		expect(orderMarketB.status).toBe('CLOSED')
		expect(orderLimitB.status).toBe('PENDING')

		const orderMarketC = broker.placeOrder({
			accountId: account.id,
			orderQty: 30,
			orderType: 'MARKET',
			symbol: 'AAPL',
			type: 'LONG'
		})

		const orderLimitC = broker.placeOrder({
			accountId: account.id,
			orderQty: 30,
			orderType: 'LIMIT',
			orderPrice: 30,
			symbol: 'TSLA',
			type: 'LONG'
		})

		broker.closeOrder({
			accountId: account.id,
			symbol: 'TSLA'
		})

		expect(orderMarketC.status).toBe('OPEN')
		expect(orderLimitC.status).toBe('CANCELED')
		expect(orderLimitC.cancelTime).toBe(priceHistoryDayTSLA.candles[0].time)
	})

	test('getQuote', () => {
		const candlesAAPL = priceHistoryDay.candles
		const candlesTSLA = priceHistoryDayTSLA.candles

		const quoteAAPL1 = broker.getQuote('AAPL')
		const quoteTSLA1 = broker.getQuote('TSLA')
		const quoteGM1 = broker.getQuote('GM')

		expect(quoteAAPL1?.ask).toBe(candlesAAPL[0].close)
		expect(quoteAAPL1?.bid).toBe(candlesAAPL[0].close)
		expect(quoteTSLA1?.ask).toBe(candlesTSLA[0].close)
		expect(quoteTSLA1?.time).toBe(candlesTSLA[0].time)

		// no candles appeared yet.
		expect(quoteGM1).toBeNull()

		broker.next()

		const quoteAAPL2 = broker.getQuote('AAPL')
		const quoteTSLA2 = broker.getQuote('TSLA')
		const quoteGM2 = broker.getQuote('GM')

		const candlesCurrentGM = timeline.getCurrentCandles('GM', 'hour4')
		const latestCandleGM = candlesCurrentGM[candlesCurrentGM.length - 1]

		expect(quoteAAPL2?.ask).toBe(candlesAAPL[1].close)
		expect(quoteAAPL2?.time).toBe(candlesAAPL[1].time)
		expect(quoteTSLA2?.ask).toBe(candlesTSLA[1].close)
		expect(quoteGM2?.ask).toBe(latestCandleGM.close)
		expect(quoteGM2?.time).toBe(latestCandleGM.time)
	})
})
