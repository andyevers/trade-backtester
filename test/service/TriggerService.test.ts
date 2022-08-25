import { Account } from '@src/repository/AccountRepository'
import EntityManager from '@src/repository/EntityManager'
import { Trigger } from '@src/repository/TriggerRepository'
import AccountService from '@src/service/AccountService'
import PositionService from '@src/service/PositionService'
import TriggerService from '@src/service/TriggerService'
import { Candle } from '@src/types'

describe('TriggerService', () => {
	let triggerService: TriggerService
	let accountService: AccountService
	let entityManager: EntityManager
	let positionService: PositionService
	let account: Account

	// 2022-08-20
	const MS_TIME_START_AAPL = 1661002943915

	const MS_TIMES = {
		day: 86400000,
		hour4: 14400000
	}

	beforeEach(() => {
		entityManager = new EntityManager()
		positionService = new PositionService({ entityManager })
		accountService = new AccountService({ entityManager, positionService })
		triggerService = new TriggerService({ entityManager, accountService })

		const accountRepository = entityManager.getRepository('account')
		account = accountRepository.create({ startingCash: 10000 })
	})

	test('processCandle - trigger gap', () => {
		const limitOrderSameDay = accountService.placeOrder({
			accountId: account.id,
			orderQty: 50,
			orderTime: MS_TIME_START_AAPL,
			symbol: 'AAPL',
			type: 'LONG',
			orderType: 'LIMIT',
			orderPrice: 5
		})

		const limitOrderPrevDay = accountService.placeOrder({
			accountId: account.id,
			orderQty: 50,
			orderTime: MS_TIME_START_AAPL - MS_TIMES.day,
			symbol: 'AAPL',
			type: 'LONG',
			orderType: 'LIMIT',
			orderPrice: 2
		})

		const limitOrderGapPrevDay1 = accountService.placeOrder({
			accountId: account.id,
			orderQty: 50,
			orderTime: MS_TIME_START_AAPL - MS_TIMES.day,
			symbol: 'AAPL',
			type: 'LONG',
			orderType: 'LIMIT',
			orderPrice: 5
		})

		const limitOrderGapPrevDay2 = accountService.placeOrder({
			accountId: account.id,
			orderQty: 50,
			orderTime: MS_TIME_START_AAPL - MS_TIMES.day,
			symbol: 'AAPL',
			type: 'LONG',
			orderType: 'LIMIT',
			orderPrice: 8
		})

		const candle: Candle = {
			close: 4,
			high: 5,
			low: 1,
			open: 3,
			time: MS_TIME_START_AAPL,
			volume: 1
		}

		const triggerRepository = entityManager.getRepository('trigger')
		const triggerMap = triggerRepository.getByLabelByPositionId({ symbol: 'AAPL', isActive: true })

		const triggerEntrySameDay = triggerMap[limitOrderSameDay.id].entryLimit as Trigger<'position'>
		const triggerEntryPrevDay = triggerMap[limitOrderPrevDay.id].entryLimit as Trigger<'position'>
		const triggerEntryGapPrevDay1 = triggerMap[limitOrderGapPrevDay1.id].entryLimit as Trigger<'position'>
		const triggerEntryGapPrevDay2 = triggerMap[limitOrderGapPrevDay2.id].entryLimit as Trigger<'position'>

		triggerService.processCandle('AAPL', candle)

		// ensure triggers removed
		expect(triggerRepository.get(triggerEntrySameDay.id)).toBeNull()
		expect(triggerRepository.get(triggerEntryPrevDay.id)).toBeNull()
		expect(triggerRepository.get(triggerEntryGapPrevDay1.id)).toBeNull()
		expect(triggerRepository.get(triggerEntryGapPrevDay2.id)).toBeNull()

		// same day gets executed at price
		expect(triggerEntrySameDay.lastExecutionPrice).toBe(triggerEntrySameDay.price)
		expect(triggerEntryPrevDay.lastExecutionPrice).toBe(triggerEntryPrevDay.price)
		expect(triggerEntryGapPrevDay1.lastExecutionPrice).toBe(candle.open)
		expect(triggerEntryGapPrevDay2.lastExecutionPrice).toBe(candle.open)
	})

	test('processCandle - trailingStop', () => {
		const candleA: Candle = {
			close: 5,
			high: 6,
			low: 2,
			open: 4,
			time: MS_TIME_START_AAPL,
			volume: 1
		}

		const candleB: Candle = {
			close: 8,
			high: 8,
			low: 6,
			open: 6,
			time: MS_TIME_START_AAPL,
			volume: 1
		}

		const candleC: Candle = {
			close: 10,
			high: 12,
			low: 6,
			open: 10,
			time: MS_TIME_START_AAPL,
			volume: 1
		}

		const orderTrail = accountService.placeOrder({
			accountId: account.id,
			orderQty: 50,
			orderTime: MS_TIME_START_AAPL,
			symbol: 'AAPL',
			type: 'LONG',
			orderType: 'MARKET',
			trailingStop: 5,
			latestCandle: candleA
		})

		const orderTrailHitSL = accountService.placeOrder({
			accountId: account.id,
			orderQty: 50,
			orderTime: MS_TIME_START_AAPL,
			symbol: 'AAPL',
			type: 'LONG',
			orderType: 'MARKET',
			latestCandle: candleA,
			stopLoss: 3,
			trailingStop: 5
		})

		const triggerRepository = entityManager.getRepository('trigger')
		const triggerMap = triggerRepository.getByLabelByPositionId({ symbol: 'AAPL', isActive: true })

		const triggerStopLoss = triggerMap[orderTrailHitSL.id].stopLoss as Trigger<'position'>
		const triggerStopLossTrail = triggerMap[orderTrailHitSL.id].trailingStop as Trigger<'position'>

		const triggerTrailStop = triggerMap[orderTrail.id].trailingStop as Trigger<'position'>
		const triggerTrailPull = triggerMap[orderTrail.id].pullTrailingStop as Trigger<'position'>

		triggerService.processCandle('AAPL', candleA)

		// assert closer stopLoss was taken.
		expect(triggerStopLoss.lastExecutionPrice).toBe(triggerStopLoss.price)
		expect(triggerRepository.get(triggerStopLossTrail.id)?.isActive).toBe(false)

		expect(triggerTrailPull.price).toBe(candleA.high)
		expect(triggerTrailPull.lastExecutionPrice).toBe(5)
		expect(triggerTrailStop.price).toBe(candleA.high - (orderTrail.trailingStop as number))

		triggerService.processCandle('AAPL', candleB)

		expect(triggerTrailPull.price).toBe(candleB.high)
		expect(triggerTrailPull.lastTriggerCandle).toBe(candleB)
		expect(triggerTrailStop.lastTriggerCandle).toBeNull()
		expect(triggerRepository.get(triggerTrailPull.id)).toBe(triggerTrailPull)

		triggerService.processCandle('AAPL', candleC)

		// 6 not 7 because the range of the candle is larger than trail amount.
		expect(triggerTrailStop.lastExecutionPrice).toBe(6)
		expect(triggerRepository.get(triggerTrailPull.id)?.isActive).toBe(false)
	})

	test('processCandle - position open close same candle', () => {
		const candle: Candle = {
			close: 10,
			high: 13,
			low: 4,
			open: 4,
			time: MS_TIME_START_AAPL,
			volume: 1
		}

		const orderHitTP = accountService.placeOrder({
			accountId: account.id,
			orderQty: 50,
			orderTime: MS_TIME_START_AAPL,
			symbol: 'AAPL',
			type: 'LONG',
			orderType: 'LIMIT',
			orderPrice: 8,
			takeProfit: 12,
			stopLoss: 3,
			latestCandle: candle
		})

		const orderHitSL = accountService.placeOrder({
			accountId: account.id,
			orderQty: 50,
			orderTime: MS_TIME_START_AAPL,
			symbol: 'AAPL',
			type: 'LONG',
			orderType: 'LIMIT',
			orderPrice: 8,
			takeProfit: 12,
			stopLoss: 5,
			latestCandle: candle
		})

		triggerService.processCandle('AAPL', candle)

		expect(orderHitTP.status).toBe('CLOSED')
		expect(orderHitSL.status).toBe('CLOSED')

		expect(orderHitTP.exitPrice).toBe(12)
		expect(orderHitSL.exitPrice).toBe(5)

		expect(true).toBeTruthy()
	})

	test('processCandle - expired trigger', () => {
		const candle: Candle = {
			close: 10,
			high: 13,
			low: 7,
			open: 8,
			time: MS_TIME_START_AAPL,
			volume: 1
		}

		const orderHitSameDay = accountService.placeOrder({
			accountId: account.id,
			orderQty: 50,
			orderTime: MS_TIME_START_AAPL,
			symbol: 'AAPL',
			type: 'LONG',
			orderType: 'LIMIT',
			orderDuration: 'DAY',
			orderPrice: 8
		})

		const orderHitNextDay = accountService.placeOrder({
			accountId: account.id,
			orderQty: 50,
			orderTime: MS_TIME_START_AAPL - MS_TIMES.day,
			symbol: 'AAPL',
			type: 'LONG',
			orderType: 'LIMIT',
			orderDuration: 'DAY',
			orderPrice: 8
		})

		triggerService.processCandle('AAPL', candle)

		expect(orderHitSameDay.status).toBe('OPEN')
		expect(orderHitNextDay.status).toBe('CANCELED')
	})
})
