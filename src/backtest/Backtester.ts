import { Broker } from '.'
import { BacktestClient } from '../client'
import { AccountRepository, EntityManager, PriceHistoryCreateParams } from '../repository'
import { Strategy } from '../strategy/DemoStrategy'
import StrategyResultsAnalyzer from './StrategyResultsAnalyzer'

interface BacktesterArgs {
	startingCash: number
	startTime: number
	priceHistory: PriceHistoryCreateParams
	priceHistoryAdditional?: PriceHistoryCreateParams[]
	_deps?: {
		entityManager?: EntityManager
		broker?: Broker
		backtestClient?: BacktestClient
		strategyResultsAnalyzer?: StrategyResultsAnalyzer
	}
}

// TODO: Add strategy results
interface StrategyResults {}

export default class Backtester {
	private readonly broker: Broker
	private readonly client: BacktestClient
	private readonly entityManager: EntityManager

	private readonly accountSettings: Parameters<typeof AccountRepository.prototype.create>[0] = {
		startingCash: 100000
	}

	constructor(args: BacktesterArgs) {
		const { priceHistory, startingCash, startTime, priceHistoryAdditional = [], _deps = {} } = args
		const {
			entityManager = new EntityManager(),
			broker = new Broker({ entityManager }),
			backtestClient = new BacktestClient({ broker })
		} = _deps

		this.broker = broker
		this.client = backtestClient
		this.entityManager = entityManager

		// Add other accountSettings options
		this.accountSettings.startingCash = startingCash

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
		const accountRepository = this.entityManager.getRepository('account')
		const account = accountRepository.create(this.accountSettings)
		this.client.setAccountId(account.id)

		strategy.init(this.client)

		let i = 0
		const maxIterations = 1000000 // 1 million

		let candlesBySymbol = this.broker.next()
		while (candlesBySymbol) {
			strategy.next(candlesBySymbol)
			candlesBySymbol = this.broker.next()
			if (i >= maxIterations) {
				throw new Error(`Max iterations reached: ${maxIterations.toLocaleString('en-US')}`)
			}
			i++
		}

		return {}
	}
}
