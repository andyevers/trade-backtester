import { Broker } from './backtest'
import { BacktestClient } from './client'
import { EntityManager, PriceHistoryCreateParams } from './repository'
import { Strategy } from './strategy/DemoStrategy'

interface BacktesterArgs {
	startingCash: number
	startTime: number
	priceHistory: PriceHistoryCreateParams
	priceHistoryAdditional?: PriceHistoryCreateParams[]
	_deps?: {
		entityManager?: EntityManager
		broker?: Broker
		backtestClient?: BacktestClient
	}
}

// TODO: Add strategy results
interface StrategyResults {}

export default class Backtester {
	private readonly broker: Broker
	private readonly client: BacktestClient
	private readonly entityManager: EntityManager

	constructor(args: BacktesterArgs) {
		const { priceHistory, startingCash, startTime, priceHistoryAdditional = [], _deps = {} } = args
		const {
			entityManager = new EntityManager(),
			broker = new Broker({ entityManager }),
			backtestClient = new BacktestClient({
				broker,
				accountId: entityManager.getRepository('account').create({ startingCash }).id
			})
		} = _deps

		this.broker = broker
		this.client = backtestClient
		this.entityManager = entityManager

		this.broker.init({
			priceHistory,
			startTime,
			priceHistoryAdditional
		})
	}

	public getEntityManager(): EntityManager {
		return this.entityManager
	}

	public runTest(strategy: Strategy): StrategyResults {
		strategy.init(this.client)
		let candlesBySymbol = this.broker.next()
		const maxIterations = 1000000 // 1 million

		let i = 0
		while (candlesBySymbol) {
			strategy.next(candlesBySymbol)
			candlesBySymbol = this.broker.next()
			if (i >= maxIterations) {
				throw new Error(`Max iterations reached: ${maxIterations.toLocaleString('en-US')}`)
			}
			i++
		}

		// this.broker.getTimeline().reset()

		return {}
	}
}
