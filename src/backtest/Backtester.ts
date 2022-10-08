import { Candle, CandleBySymbol } from '../types'
import { Broker } from '.'
import { BacktestClient } from '../client'
import {
	Account,
	AccountCreateParams,
	EntityManager,
	Position,
	PriceHistoryCreateParams
} from '../repository'
import { Strategy } from '../types'
import StrategyResultsAnalyzer, { StrategyResults } from './StrategyResultsAnalyzer'

export interface BacktesterArgs {
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

export interface CurrentTestData {
	candles: Candle[]
	account: Account
	currentIndex: number
	currentCandle: Candle
	startingIndex: number
	startingCandle: Candle
	iteration: number
	currentPosition: Position | null
}

export default class Backtester {
	private readonly broker: Broker
	private readonly client: BacktestClient
	private readonly entityManager: EntityManager
	public readonly strategyResultsAnalyzer: StrategyResultsAnalyzer

	private readonly priceHistory: PriceHistoryCreateParams
	private readonly accountSettings: AccountCreateParams = {
		startingCash: 100000
	}

	private currentTestData!: CurrentTestData

	constructor(args: BacktesterArgs) {
		const { priceHistory, startingCash, startTime, priceHistoryAdditional = [], _deps = {} } = args
		const {
			entityManager = new EntityManager(),
			broker = new Broker({ entityManager }),
			backtestClient = new BacktestClient({ broker }),
			strategyResultsAnalyzer = new StrategyResultsAnalyzer()
		} = _deps

		this.broker = broker
		this.client = backtestClient
		this.entityManager = entityManager
		this.strategyResultsAnalyzer = strategyResultsAnalyzer
		this.priceHistory = priceHistory

		// Add other accountSettings options
		this.accountSettings.startingCash = startingCash

		this.broker.init({
			priceHistory,
			startTime,
			priceHistoryAdditional
		})
	}

	public getResultsAnalyzer(): StrategyResultsAnalyzer {
		return this.strategyResultsAnalyzer
	}

	public getEntityManager(): EntityManager {
		return this.entityManager
	}

	public getBroker(): Broker {
		return this.broker
	}

	public getClient(): BacktestClient {
		return this.client
	}

	public getCurrentTestData(): CurrentTestData {
		return this.currentTestData
	}

	private onAfterNext(latestCandles: CandleBySymbol) {
		this.strategyResultsAnalyzer.handleCandle(this.currentTestData)
	}

	private onTestStart() {
		this.strategyResultsAnalyzer.handleStart(this.currentTestData)

		this.entityManager.on('positionRepository.update', 'backtester.handleOpenPosition', (data) => {
			const position = data.entity
			if (position.status === 'CLOSED') {
				this.currentTestData.currentPosition = position
				this.strategyResultsAnalyzer.handlePositionClose(this.currentTestData)
			} else if (position.status === 'OPEN') {
				this.currentTestData.currentPosition = position
				this.strategyResultsAnalyzer.handlePositionOpen(this.currentTestData)
			}
			this.currentTestData.currentPosition = null
		})
	}

	private onTestEnd() {
		this.strategyResultsAnalyzer.handleEnd(this.currentTestData)
		this.entityManager.off('positionRepository.update', 'backtester.handleOpenPosition')
	}

	public runTest(strategy: Strategy): StrategyResults {
		const accountRepository = this.entityManager.getRepository('account')
		const account = accountRepository.create(this.accountSettings)
		this.client.setAccountId(account.id)

		this.strategyResultsAnalyzer.reset()
		const startingIndex = this.broker.getTimeline().getTimelineIndex()
		this.currentTestData = {
			candles: this.priceHistory.candles,
			currentCandle: this.priceHistory.candles[startingIndex],
			startingCandle: this.priceHistory.candles[startingIndex],
			account: account,
			currentIndex: startingIndex,
			startingIndex: startingIndex,
			iteration: 0,
			currentPosition: null
		}

		this.onTestStart()
		strategy.init(this.client)

		do {
			const candlesBySymbol = this.broker.next()
			if (!candlesBySymbol) break

			this.currentTestData.currentIndex++
			this.currentTestData.currentCandle = candlesBySymbol[this.priceHistory.symbol]
			this.currentTestData.iteration++

			strategy.next(candlesBySymbol)
			this.onAfterNext(candlesBySymbol)

			if (this.currentTestData.iteration >= 1000000) {
				throw new Error('Max iterations reached: 1,000,000')
			}
		} while (true)

		this.onTestEnd()
		return this.strategyResultsAnalyzer.getResults()
	}
}
