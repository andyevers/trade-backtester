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

	constructor(args: BacktesterArgs, _deps?: BacktesterDeps) {
		const {
			BrokerClass = Broker,
			EntityManagerClass = EntityManager,
			BacktestClientClass = BacktestClient
		} = _deps || {}

		const { priceHistory, startingCash, priceHistoryAdditional = [], startTime } = args

		const entityManager = new EntityManagerClass()
		const account = entityManager.getRepository('account').create({ startingCash })

		this.broker = new BrokerClass({ entityManager })
		this.client = new BacktestClientClass({
			entityManager,
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

	public runTest(strategy: Strategy): StrategyResults {
		strategy.init(this.client)
		let candlesBySymbol = this.broker.next()

		while (candlesBySymbol) {
			strategy.next(candlesBySymbol)
			candlesBySymbol = this.broker.next()
		}

		this.broker.getTimeline().reset()

		return {}
	}
}
