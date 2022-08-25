import PositionRepository, {
	PositionsByIdLookupFilters,
	PositionStatus,
	PositionType
} from '@src/repository/PositionRepository'

describe('PositionRepository', () => {
	test('getByIdLookup', () => {
		const positionRepository = new PositionRepository()
		const createPosition = (symbol: string, type: PositionType, status: PositionStatus) => {
			return positionRepository.create({
				accountId: 1,
				orderPrice: 10,
				orderQty: 10,
				orderTime: 10,
				orderType: 'MARKET',
				status: status,
				symbol: symbol,
				type: type
			})
		}

		const getPositions = (filters: Omit<PositionsByIdLookupFilters, 'accountId'>) => {
			return Object.values(positionRepository.getByIdLookup({ accountId: 1, ...filters }))
		}

		const containsOnly = (arr: any[], els: any[]) =>
			arr.length === els.length && els.every((el) => arr.includes(el))

		// Positions
		const posAAPLLongOpen1 = createPosition('AAPL', 'LONG', 'OPEN')
		const posAAPLLongOpen2 = createPosition('AAPL', 'LONG', 'OPEN')
		const posAAPLLongPending = createPosition('AAPL', 'LONG', 'PENDING')
		const posAAPLShortOpen = createPosition('AAPL', 'SHORT', 'OPEN')
		const posAAPLShortCanceled = createPosition('AAPL', 'SHORT', 'CANCELED')
		const posAAPLShortPending = createPosition('AAPL', 'SHORT', 'PENDING')

		const posGMLongOpen = createPosition('GM', 'LONG', 'OPEN')
		const posGMShortClosed = createPosition('GM', 'SHORT', 'CLOSED')
		const posGMLongClosed = createPosition('GM', 'LONG', 'CLOSED')
		const posGMShortCanceled = createPosition('GM', 'SHORT', 'CANCELED')

		// Results
		const resAAPL = getPositions({ symbol: 'AAPL' })
		const resAAPLOpen = getPositions({ symbol: 'AAPL', status: 'OPEN' })
		const resAAPLLong = getPositions({ symbol: 'AAPL', type: 'LONG' })
		const resAAPLLongOpen = getPositions({ symbol: 'AAPL', type: 'LONG', status: 'OPEN' })
		const resAAPLOpenPending = getPositions({ symbol: 'AAPL', status: 'OPEN_PENDING' })
		const resAAPLLongStatusUndefined = getPositions({ symbol: 'AAPL', type: 'LONG', status: undefined })

		const resAll = getPositions({})
		const resCanceled = getPositions({ status: 'CANCELED' })
		const resClosedCanceled = getPositions({ status: 'CLOSED_CANCELED' })
		const resLongOpen = getPositions({ type: 'LONG', status: 'OPEN' })
		const resShort = getPositions({ type: 'SHORT' })

		expect(
			containsOnly(resAAPL, [
				posAAPLLongOpen1,
				posAAPLLongOpen2,
				posAAPLLongPending,
				posAAPLShortCanceled,
				posAAPLShortOpen,
				posAAPLShortPending
			])
		).toBe(true)
		expect(containsOnly(resAAPLLongOpen, [posAAPLLongOpen1, posAAPLLongOpen2])).toBe(true)
		expect(containsOnly(resAAPLOpen, [posAAPLLongOpen1, posAAPLLongOpen2, posAAPLShortOpen])).toBe(true)
		expect(containsOnly(resAAPLLong, [posAAPLLongOpen1, posAAPLLongOpen2, posAAPLLongPending])).toBe(true)
		expect(containsOnly(resAAPLLongOpen, [posAAPLLongOpen1, posAAPLLongOpen2])).toBe(true)
		expect(
			containsOnly(resAAPLOpenPending, [
				posAAPLLongOpen1,
				posAAPLLongOpen2,
				posAAPLLongPending,
				posAAPLShortOpen,
				posAAPLShortOpen
			])
		).toBe(true)
		expect(
			containsOnly(resAAPLLongStatusUndefined, [posAAPLLongOpen1, posAAPLLongOpen2, posAAPLLongPending])
		).toBe(true)

		expect(
			containsOnly(resAll, [
				posAAPLLongOpen1,
				posAAPLLongOpen2,
				posAAPLLongPending,
				posAAPLShortCanceled,
				posAAPLShortOpen,
				posAAPLShortPending,
				posGMLongClosed,
				posGMLongOpen,
				posGMShortCanceled,
				posGMShortClosed
			])
		).toBe(true)
		expect(containsOnly(resCanceled, [posAAPLShortCanceled, posGMShortCanceled])).toBe(true)
		expect(
			containsOnly(resClosedCanceled, [
				posAAPLShortCanceled,
				posGMLongClosed,
				posGMShortCanceled,
				posGMShortClosed
			])
		).toBe(true)
		expect(containsOnly(resLongOpen, [posAAPLLongOpen1, posAAPLLongOpen2, posGMLongOpen])).toBe(true)
		expect(
			containsOnly(resShort, [
				posAAPLShortCanceled,
				posAAPLShortOpen,
				posAAPLShortPending,
				posGMShortCanceled,
				posGMShortClosed
			])
		).toBe(true)
	})
})
