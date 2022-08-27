import Repository, { Entity } from './Repository'

type NumberWhen<A extends PositionStatus, B extends PositionStatus> = A extends B ? number : null

export type PositionType = 'LONG' | 'SHORT'
export type PositionStatus = 'OPEN' | 'CLOSED' | 'PENDING' | 'CANCELED'
export type PositionOrderType = 'MARKET' | 'LIMIT' | 'STOP'
export type PositionOrderDuration = 'DAY' | 'GOOD_TILL_CANCEL' | 'FILL_OR_KILL'

export interface Position<S extends PositionStatus = PositionStatus> extends Entity {
	symbol: string
	type: PositionType
	entryPrice: NumberWhen<S, 'OPEN' | 'CLOSED'>
	entryTime: NumberWhen<S, 'OPEN' | 'CLOSED'>
	exitPrice: NumberWhen<S, 'CLOSED'>
	exitTime: NumberWhen<S, 'CLOSED'>
	exitProfit: NumberWhen<S, 'CLOSED'>
	qty: NumberWhen<S, 'OPEN' | 'CLOSED'>
	cost: NumberWhen<S, 'OPEN' | 'CLOSED'>
	orderType: PositionOrderType
	orderDuration: PositionOrderDuration
	orderPrice: number
	orderTime: number
	orderQty: number
	orderExitTime: NumberWhen<S, 'OPEN' | 'CLOSED'>
	orderExitPrice: NumberWhen<S, 'OPEN' | 'CLOSED'>
	cancelTime: NumberWhen<S, 'CANCELED'>
	takeProfit: number | null
	stopLoss: number | null
	trailingStop: number | null
	status: PositionStatus
	accountId: number
}

export interface PositionCreateParams extends Omit<Partial<Position>, 'id'> {
	type: PositionType
	symbol: string
	status: PositionStatus
	orderTime: number
	orderType: PositionOrderType
	accountId: number
	orderQty: number
	orderPrice: number
}

export type PositionsById = {
	[positionId: number]: Position
}

export type PositionsByIdByStatus = {
	[T in PositionStatus]: PositionsById
}
export type PositionsByIdByType = {
	[T in PositionType]: PositionsById
}

export type PositionsByIdBySymbol = {
	[symbol: string]: PositionsById
}

export type PositionsByIdBySymbolByTypeByStatus = {
	[T in PositionStatus]: {
		[K in PositionType]: PositionsByIdBySymbol
	}
}

interface PositionTypeBlock {
	LONG: PositionsById
	SHORT: PositionsById
	_all: PositionsById
}

interface PositionMapBlock {
	_bySymbol: {
		[symbol: string]: PositionTypeBlock
	}
	_all: PositionTypeBlock
}
interface PositionsByIdMap {
	OPEN_PENDING: {
		OPEN: PositionMapBlock
		PENDING: PositionMapBlock
		_all: PositionMapBlock
	}
	CLOSED_CANCELED: {
		CLOSED: PositionMapBlock
		CANCELED: PositionMapBlock
		_all: PositionMapBlock
	}
	_all: PositionMapBlock
}

export interface PositionsByIdLookupFilters {
	accountId: number
	symbol?: string
	type?: PositionType
	status?: 'CLOSED_CANCELED' | 'OPEN_PENDING' | PositionStatus
}

type PositionStatusOrGroup = 'CLOSED_CANCELED' | 'OPEN_PENDING' | PositionStatus

interface PositionMapBlocks {
	mapBlock: PositionMapBlock
	mapBlockAll: PositionMapBlock
	mapBlockGroupAll: PositionMapBlock
}

export default class PositionRepository extends Repository<Position<PositionStatus>> {
	private readonly accountPositionsByIdMap: {
		[accountId: number]: PositionsByIdMap
	} = {}

	private ensureSymbolBlocks(accountId: number, symbol: string): void {
		const accountPositionsMap = this.getPositionsByIdMap(accountId, true)
		if (!accountPositionsMap._all._bySymbol[symbol]) {
			const createTypeBlock = () => ({ LONG: {}, SHORT: {}, _all: {} })
			accountPositionsMap._all._bySymbol[symbol] = createTypeBlock()

			accountPositionsMap.CLOSED_CANCELED._all._bySymbol[symbol] = createTypeBlock()
			accountPositionsMap.CLOSED_CANCELED.CLOSED._bySymbol[symbol] = createTypeBlock()
			accountPositionsMap.CLOSED_CANCELED.CANCELED._bySymbol[symbol] = createTypeBlock()

			accountPositionsMap.OPEN_PENDING._all._bySymbol[symbol] = createTypeBlock()
			accountPositionsMap.OPEN_PENDING.OPEN._bySymbol[symbol] = createTypeBlock()
			accountPositionsMap.OPEN_PENDING.PENDING._bySymbol[symbol] = createTypeBlock()
		}
	}

	private getMapBlocks(position: Position): PositionMapBlocks {
		const { status, accountId } = position
		const accountPositionsMap = this.getPositionsByIdMap(accountId)
		const statusGroupKey = status === 'OPEN' || status === 'PENDING' ? 'OPEN_PENDING' : 'CLOSED_CANCELED'
		const mapBlockGroup = accountPositionsMap[statusGroupKey]

		const mapBlock: PositionMapBlock = mapBlockGroup[status as keyof typeof mapBlockGroup]
		const mapBlockAll: PositionMapBlock = accountPositionsMap._all
		const mapBlockGroupAll: PositionMapBlock = mapBlockGroup._all

		return { mapBlock, mapBlockAll, mapBlockGroupAll }
	}

	private setMapBlocks(position: Position): void {
		const { id, symbol, type } = position
		const { mapBlock, mapBlockAll, mapBlockGroupAll } = this.getMapBlocks(position)

		const setMapBlock = (mapBlock: PositionMapBlock) => {
			mapBlock._all._all[id] = position
			mapBlock._all[type][id] = position
			mapBlock._bySymbol[symbol]._all[id] = position
			mapBlock._bySymbol[symbol][type][id] = position
		}

		setMapBlock(mapBlock)
		setMapBlock(mapBlockAll)
		setMapBlock(mapBlockGroupAll)
	}

	private unsetMapBlocks(position: Position): void {
		const { id, symbol, type } = position
		const { mapBlock, mapBlockAll, mapBlockGroupAll } = this.getMapBlocks(position)

		const unsetMapBlock = (mapBlock: PositionMapBlock) => {
			delete mapBlock._all._all[id]
			delete mapBlock._all[type][id]
			delete mapBlock._bySymbol[symbol]._all[id]
			delete mapBlock._bySymbol[symbol][type][id]
		}

		unsetMapBlock(mapBlock)
		unsetMapBlock(mapBlockAll)
		unsetMapBlock(mapBlockGroupAll)
	}

	private getPositionsByIdMap(accountId: number, setIfNotDefined = false): PositionsByIdMap {
		if (!this.accountPositionsByIdMap[accountId]) {
			if (setIfNotDefined === false) {
				throw new Error(`${accountId} is not a registered accountId`)
			}
			const createMapBlock = () => ({ _all: { LONG: {}, SHORT: {}, _all: {} }, _bySymbol: {} })
			this.accountPositionsByIdMap[accountId] = {
				OPEN_PENDING: {
					OPEN: createMapBlock(),
					PENDING: createMapBlock(),
					_all: createMapBlock()
				},
				CLOSED_CANCELED: {
					CLOSED: createMapBlock(),
					CANCELED: createMapBlock(),
					_all: createMapBlock()
				},
				_all: createMapBlock()
			}
		}
		return this.accountPositionsByIdMap[accountId]
	}

	private getMapBlock(accountId: number, status: PositionStatusOrGroup | '_all'): PositionMapBlock {
		const accountPositionsMap = this.getPositionsByIdMap(accountId)

		if (status === '_all') return accountPositionsMap._all

		const statusKeyMapA: {
			[K in PositionStatusOrGroup]: 'CLOSED_CANCELED' | 'OPEN_PENDING'
		} = {
			CANCELED: 'CLOSED_CANCELED',
			CLOSED: 'CLOSED_CANCELED',
			CLOSED_CANCELED: 'CLOSED_CANCELED',
			OPEN: 'OPEN_PENDING',
			OPEN_PENDING: 'OPEN_PENDING',
			PENDING: 'OPEN_PENDING'
		}

		const statusKeyMapB: {
			[K in PositionStatusOrGroup]: '_all' | PositionStatus
		} = {
			CANCELED: 'CANCELED',
			CLOSED: 'CLOSED',
			CLOSED_CANCELED: '_all',
			OPEN: 'OPEN',
			OPEN_PENDING: '_all',
			PENDING: 'PENDING'
		}

		const statusKeyA = statusKeyMapA[status]
		const statusKeyB = statusKeyMapB[status]
		const bucketA = accountPositionsMap[statusKeyA]
		return bucketA[statusKeyB as keyof typeof bucketA]
	}

	public getByIdLookup(filters: PositionsByIdLookupFilters): PositionsById {
		const { accountId, status, symbol, type } = filters

		if (!this.get(accountId)) return {}
		if (!status && !symbol && !type) {
			return this.getPositionsByIdMap(accountId)._all._all._all
		}

		const statusBucket = this.getMapBlock(accountId, status || '_all')
		const typeBlock = typeof symbol === 'string' ? statusBucket._bySymbol[symbol] : statusBucket._all
		if (!typeBlock) return {}
		return typeof type === 'string' ? typeBlock[type] : typeBlock._all
	}

	public updatePositionStatus(positionId: number, status: PositionStatus): void {
		const position = this.get(positionId)
		if (!position) return
		this.unsetMapBlocks(position)
		position.status = status
		this.setMapBlocks(position)
	}

	public override update(positionId: number, params: Omit<Partial<Position>, 'id'>): Position | null {
		if (params.status) {
			this.updatePositionStatus(positionId, params.status)
		}
		return super.update(positionId, params)
	}

	public override create(params: PositionCreateParams): Position {
		const {
			type,
			symbol,
			status,
			orderQty,
			orderTime,
			orderType,
			orderPrice,
			accountId,
			orderDuration = 'GOOD_TILL_CANCEL',
			orderExitTime = null,
			orderExitPrice = null,
			qty = null,
			stopLoss = null,
			takeProfit = null,
			trailingStop = null,
			cancelTime = null,
			cost = null,
			entryPrice = null,
			entryTime = null,
			exitPrice = null,
			exitTime = null,
			exitProfit = null
		} = params

		const position = super.create({
			type,
			symbol,
			orderType,
			status,
			orderQty,
			orderDuration,
			orderTime,
			qty,
			stopLoss,
			takeProfit,
			trailingStop,
			orderExitTime,
			orderExitPrice,
			accountId,
			cancelTime,
			cost,
			entryPrice,
			entryTime,
			exitPrice,
			exitTime,
			exitProfit,
			orderPrice
		})

		this.ensureSymbolBlocks(accountId, symbol)
		this.setMapBlocks(position)

		return position
	}

	public override import(position: Position): Position {
		const { accountId, symbol } = position
		super.import(position)
		this.ensureSymbolBlocks(accountId, symbol)
		this.setMapBlocks(position)
		return position
	}

	public override remove(positionId: number) {
		const position = this.get(positionId)
		if (!position) return
		this.unsetMapBlocks(position)
		super.remove(positionId)
	}
}
