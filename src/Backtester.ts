import { Broker } from './broker'
import { BacktestClient } from './client'
import { EntityManager, PriceHistoryCreateParams } from './repository'
import { Strategy } from './strategy/DemoStrategy'

interface BacktesterArgs {
	startingCash: number
	startTime: number
	priceHistory: PriceHistoryCreateParams
	priceHistoryAdditional?: PriceHistoryCreateParams[]
}

interface BacktesterDeps {
	EntityManagerClass: typeof EntityManager
	BrokerClass: typeof Broker
	BacktestClientClass: typeof BacktestClient
}

// TODO: Add strategy results
interface StrategyResults {}

export default class Backtester {
	private readonly broker: Broker
	private readonly client: BacktestClient
	private readonly entityManager: EntityManager

	constructor(args: BacktesterArgs, _deps?: BacktesterDeps) {
		const {
			BrokerClass = Broker,
			EntityManagerClass = EntityManager,
			BacktestClientClass = BacktestClient
		} = _deps || {}

		const { priceHistory, startingCash, priceHistoryAdditional = [], startTime } = args

		this.entityManager = new EntityManagerClass()
		const account = this.entityManager.getRepository('account').create({ startingCash })

		this.broker = new BrokerClass({ entityManager: this.entityManager })
		this.client = new BacktestClientClass({
			entityManager: this.entityManager,
			broker: this.broker,
			accountId: account.id
		})

		this.broker.init({
			accountIds: [account.id],
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
				// break
			}
			i++
		}

		// this.broker.getTimeline().reset()

		return {}
	}
}
