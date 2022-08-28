import { Account } from '@src/repository/AccountRepository'
import EntityManager from '@src/repository/EntityManager'
import PositionService from '@src/service/PositionService'
import { Candle } from '@src/types'
import { AccountService } from '@src/service'
describe('AccountService', () => {
	let positionService: PositionService
	let entityManager: EntityManager
	let accountService: AccountService
	let account: Account

	const candleA: Candle = {
		close: 20,
		high: 25,
		low: 10,
		open: 12,
		time: 100,
		volume: 100
	}
	const candleB: Candle = {
		close: 25,
		high: 30,
		low: 15,
		open: 17,
		time: 200,
		volume: 1050
	}
	const candleC: Candle = {
		close: 30,
		high: 35,
		low: 20,
		open: 22,
		time: 300,
		volume: 1200
	}

	beforeEach(() => {
		entityManager = new EntityManager()
		positionService = new PositionService({ entityManager })
		accountService = new AccountService({ entityManager, positionService })
		account = entityManager.getRepository('account').create({ startingCash: 2000 })
	})

	test('placeOrder', () => {
		const executeOpenOrder = jest.spyOn(accountService, 'executeOpenOrder')
		const addEntryTriggers = jest.spyOn(positionService, 'addEntryTriggers')

		const marketOrder = accountService.placeOrder({
			accountId: account.id,
			orderPrice: candleA.close,
			orderQty: 30,
			orderTime: candleA.time,
			symbol: 'AAPL',
			type: 'LONG',
			orderDuration: 'DAY',
			stopLoss: 2,
			latestCandle: candleA
		})

		const marketOrderExpiredCandle = accountService.placeOrder({
			accountId: account.id,
			orderPrice: candleA.close,
			orderQty: 20,
			orderTime: candleB.time,
			symbol: 'AAPL',
			type: 'SHORT',
			latestCandle: candleA
		})

		const limitOrder = accountService.placeOrder({
			accountId: account.id,
			orderPrice: candleA.close,
			orderQty: 30,
			orderTime: candleB.time,
			symbol: 'AAPL',
			type: 'LONG',
			orderType: 'LIMIT',
			takeProfit: 244,
			latestCandle: candleA
		})

		const stopOrder = accountService.placeOrder({
			accountId: account.id,
			orderPrice: candleA.close,
			orderQty: 30,
			orderTime: candleB.time,
			symbol: 'AAPL',
			type: 'SHORT',
			orderType: 'STOP',
			trailingStop: 39
		})

		const triggers = entityManager.getRepository('trigger').getAll()

		expect(executeOpenOrder).toHaveBeenCalledTimes(1)
		expect(addEntryTriggers).toHaveBeenCalledTimes(3)

		expect(marketOrder.status).toBe('OPEN')
		expect(marketOrder.orderTime).not.toBeNull()
		expect(marketOrder.entryPrice).toBe(candleA.close)
		expect(marketOrder.cost).toBe(candleA.close * (marketOrder.qty as number))
		expect(marketOrder.orderDuration).toBe('DAY')

		expect(marketOrderExpiredCandle.status).toBe('PENDING')
		expect(marketOrderExpiredCandle.entryTime).toBeNull()
		expect(marketOrderExpiredCandle.entryPrice).toBeNull()
		expect(marketOrderExpiredCandle.orderPrice).toBe(candleA.close)
		expect(marketOrderExpiredCandle.orderTime).toBe(candleB.time)

		expect(limitOrder.cost).toBeNull()
		expect(limitOrder.entryTime).toBeNull()
		expect(limitOrder.orderType).toBe('LIMIT')

		expect(stopOrder.orderType).toBe('STOP')

		expect(triggers).toHaveLength(4)
		expect(triggers.find((trigger) => trigger.label === 'entryLimit')).toBeDefined()
		expect(triggers.find((trigger) => trigger.label === 'entryStop')).toBeDefined()
		expect(triggers.find((trigger) => trigger.label === 'entryMarket')).toBeDefined()
		expect(triggers.find((trigger) => trigger.label === 'stopLoss')).toBeDefined()
		expect(triggers.find((trigger) => trigger.label === 'takeProfit')).toBeUndefined()
		expect(triggers.find((trigger) => trigger.label === 'trailingStop')).toBeUndefined()
	})

	test('closeOrder', () => {
		const executeCloseOrder = jest.spyOn(accountService, 'executeCloseOrder')
		const removeTriggers = jest.spyOn(positionService, 'removeTriggers')

		const marketOrder = accountService.placeOrder({
			accountId: account.id,
			orderPrice: candleA.close,
			orderQty: 30,
			orderTime: candleA.time,
			symbol: 'AAPL',
			type: 'LONG',
			latestCandle: candleA
		})

		const marketWaitingClose = accountService.placeOrder({
			accountId: account.id,
			orderPrice: candleA.close,
			orderQty: 30,
			orderTime: candleA.time,
			symbol: 'AAPL',
			type: 'LONG',
			latestCandle: candleA
		})

		accountService.closeOrder({
			id: marketOrder.id,
			orderExitTime: candleC.time,
			latestCandle: candleC,
			orderExitPrice: candleC.close
		})

		accountService.closeOrder({
			id: marketWaitingClose.id,
			orderExitTime: candleC.time,
			latestCandle: candleB,
			orderExitPrice: candleC.close
		})

		const triggers = entityManager.getRepository('trigger').getAll()
		const triggerMarketClose = triggers.find((trigger) => trigger.label === 'closeMarket')

		// 2 time in executeOpenOrder, 1 time in closeOrder, 1 time in executeCloseOrder
		expect(removeTriggers).toHaveBeenCalledTimes(4)
		expect(executeCloseOrder).toHaveBeenCalledTimes(1)
		expect(triggers).toHaveLength(1)
		expect(triggerMarketClose?.positionId).toBe(marketWaitingClose.id)
	})

	test('executeOpenOrder', () => {
		const marketOrder = accountService.placeOrder({
			accountId: account.id,
			orderPrice: candleA.close,
			orderQty: 30,
			orderTime: candleA.time,
			symbol: 'AAPL',
			type: 'LONG',
			orderDuration: 'DAY',
			latestCandle: candleA
		})

		const limitOrder = accountService.placeOrder({
			accountId: account.id,
			orderPrice: candleA.close,
			orderQty: 30,
			orderTime: candleB.time,
			symbol: 'AAPL',
			type: 'LONG',
			orderType: 'LIMIT',
			takeProfit: 244,
			latestCandle: candleA
		})

		const stopOrder = accountService.placeOrder({
			accountId: account.id,
			orderPrice: candleA.close,
			orderQty: 30,
			orderTime: candleB.time,
			symbol: 'AAPL',
			type: 'SHORT',
			orderType: 'STOP',
			trailingStop: 39
		})

		const triggerRepository = entityManager.getRepository('trigger')
		const triggersBefore = triggerRepository.getAll().filter((trigger) => trigger.isActive)

		expect(() => accountService.executeOpenOrder(marketOrder, candleA)).toThrow(
			'Cannot open order with status OPEN'
		)

		// Entry triggers added, not exit triggers.
		expect(triggersBefore).toHaveLength(2)
		expect(triggersBefore.find((trigger) => trigger.label === 'entryLimit')).toBeDefined()
		expect(triggersBefore.find((trigger) => trigger.label === 'entryStop')).toBeDefined()
		expect(triggersBefore.find((trigger) => trigger.label === 'takeProfit')).toBeUndefined()
		expect(triggersBefore.find((trigger) => trigger.label === 'pullTrailingStop')).toBeUndefined()
		expect(triggersBefore.find((trigger) => trigger.label === 'trailingStop')).toBeUndefined()

		expect(limitOrder.entryPrice).toBeNull()
		expect(limitOrder.entryTime).toBeNull()
		expect(stopOrder.entryPrice).toBeNull()
		expect(stopOrder.entryTime).toBeNull()

		const cashBefore = account.startingCash - (marketOrder.cost as number)
		expect(account.cash).toBe(cashBefore)

		const executeOpenLimitPrice = 22
		accountService.executeOpenOrder(limitOrder, candleB, executeOpenLimitPrice)
		accountService.executeOpenOrder(stopOrder, candleB)

		const triggersAfter = triggerRepository.getAll().filter((trigger) => trigger.isActive)

		// Entry triggers removed and exit triggers added.
		expect(triggersAfter).toHaveLength(3)
		expect(triggersAfter.find((trigger) => trigger.label === 'entryLimit')).toBeUndefined()
		expect(triggersAfter.find((trigger) => trigger.label === 'entryStop')).toBeUndefined()
		expect(triggersAfter.find((trigger) => trigger.label === 'takeProfit')).toBeDefined()
		expect(triggersAfter.find((trigger) => trigger.label === 'pullTrailingStop')).toBeDefined()
		expect(triggersAfter.find((trigger) => trigger.label === 'trailingStop')).toBeDefined()

		expect(limitOrder.entryPrice).toBe(executeOpenLimitPrice)
		expect(limitOrder.entryTime).toBe(candleB.time)
		expect(stopOrder.entryPrice).toBe(candleB.close)
		expect(stopOrder.entryTime).toBe(candleB.time)

		const costLimitOrder = limitOrder.cost as number
		const costStopOrder = stopOrder.cost as number

		// short positions add to margin debt, long subtracts from cash
		expect(account.cash).toBe(cashBefore - costLimitOrder)
		expect(account.marginDebt).toBe(costStopOrder)
	})

	test('executeCloseOrder', () => {
		const marketOrder = accountService.placeOrder({
			accountId: account.id,
			orderPrice: candleA.close,
			orderQty: 30,
			orderTime: candleA.time,
			symbol: 'AAPL',
			type: 'LONG',
			orderDuration: 'DAY',
			latestCandle: candleA
		})

		const limitOrder = accountService.placeOrder({
			accountId: account.id,
			orderPrice: candleA.close,
			orderQty: 30,
			orderTime: candleA.time,
			symbol: 'AAPL',
			type: 'LONG',
			orderType: 'LIMIT',
			takeProfit: 244,
			latestCandle: candleA
		})

		const limitOrderPending = accountService.placeOrder({
			accountId: account.id,
			orderPrice: candleA.close,
			orderQty: 30,
			orderTime: candleA.time,
			symbol: 'AAPL',
			type: 'LONG',
			orderType: 'LIMIT',
			takeProfit: 244,
			latestCandle: candleA
		})

		const stopOrder = accountService.placeOrder({
			accountId: account.id,
			orderPrice: candleA.close,
			orderQty: 30,
			orderTime: candleA.time,
			symbol: 'AAPL',
			type: 'SHORT',
			orderType: 'STOP',
			trailingStop: 39
		})

		accountService.executeOpenOrder(limitOrder, candleA)
		accountService.executeOpenOrder(stopOrder, candleA)

		const cashBefore = account.cash
		const marginBefore = account.marginDebt

		expect(marginBefore).toBe(stopOrder.cost)
		expect(cashBefore).toBe(
			account.startingCash - (limitOrder.cost as number) - (marketOrder.cost as number)
		)

		accountService.executeCloseOrder(marketOrder, candleB)
		accountService.executeCloseOrder(limitOrder, candleC)
		accountService.executeCloseOrder(stopOrder, candleC, 8)
		accountService.executeCloseOrder(limitOrderPending, candleB)

		const profitMarketOrder = marketOrder.exitProfit as number // 150
		const profitLimitOrder = limitOrder.exitProfit as number // 300
		const profitStopOrder = stopOrder.exitProfit as number // 360
		const profitTotal = profitMarketOrder + profitLimitOrder + profitStopOrder

		// add back cost of limit and market order because they subtracted from cash
		expect(account.cash).toBe(
			cashBefore + profitTotal + (marketOrder.cost as number) + (limitOrder.cost as number)
		)
		expect(account.marginDebt).toBe(0)

		expect(marketOrder.status).toBe('CLOSED')
		expect(marketOrder.exitTime).toBe(candleB.time)
		expect(marketOrder.cancelTime).toBeNull()

		expect(limitOrderPending.status).toBe('CANCELED')
		expect(limitOrderPending.cancelTime).toBe(candleB.time)
		expect(limitOrderPending.exitTime).toBeNull()

		const triggerRepository = entityManager.getRepository('trigger')
		expect(triggerRepository.getAll().filter((trigger) => trigger.isActive)).toHaveLength(0)
	})
})
