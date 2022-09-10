import { Account, Position, PriceHistoryCreateParams } from '../repository'
import { Candle } from '../types'
import { CurrentTestData } from '.'
import Equity from './calculations/Equity'
import PositionsDrawdown from './calculations/PositionsDrawdown'
import TradeStats from './calculations/TradeStats'

export type CalculationHandlerName =
	| 'handlePositionOpen'
	| 'handlePositionClose'
	| 'handleCandle'
	| 'handleStart'
	| 'handleEnd'

export interface Calculation<T> {
	handlePositionOpen?(data: CurrentTestData): void
	handlePositionClose?(data: CurrentTestData): void
	handleCandle?(data: CurrentTestData): void
	handleStart?(data: CurrentTestData): void
	handleEnd?(data: CurrentTestData): void
	getResults(): T
	handlerNames: CalculationHandlerName[]
}

export interface StrategyResultsWithEntities extends StrategyResults {
	positions: Position[]
	priceHistory: PriceHistoryCreateParams
	account: Account
	equityHistory: number[]
	candlesTested: Candle[]
}

export interface StrategyResults {
	// startTime: number // start
	// endTime: number // end
	// daysCount: number // duration
	// timeframe: TimeframeType
	// symbol: string

	// countCandles: number
	countCandlesInPositions: number // exposure

	equityEnding: number
	equityMax: number
	equityMin: number

	//TRADES
	drawdownPercentMax: number
	drawdownPercentAvg: number
	drawdownDurationMax: number
	// drawdownDurationAvg: number

	winPercent: number
	winPercentLong: number
	winPercentShort: number

	winCount: number
	winCountLong: number
	winCountShort: number

	tradeCount: number
	tradeCountLong: number
	tradeCountShort: number

	tradeProfitPercentBest: number
	tradeProfitPercentWorst: number
	tradeProfitPercentAvg: number

	tradeDurationAvg: number
	tradeDurationMax: number
}

interface StrategyResultsAnalyzerArgs {
	calculations?: Partial<Calculations>
	priceHistory: PriceHistoryCreateParams
}

interface Calculations {
	drawdown: PositionsDrawdown
	equity: Equity
	tradeStats: TradeStats
}

export default class StrategyResultsAnalyzer {
	private readonly calculations: Calculations

	private watchedCalculationsMap!: {
		[K in CalculationHandlerName]: Required<Calculation<any>>[K][]
	}

	constructor(args?: StrategyResultsAnalyzerArgs) {
		const { calculations } = args || {}

		const {
			drawdown = new PositionsDrawdown(),
			equity = new Equity(),
			tradeStats = new TradeStats()
		} = calculations || {}

		this.calculations = {
			drawdown,
			equity,
			tradeStats
		}

		this.setWatchedCalculations(['drawdown', 'equity', 'tradeStats'])
	}

	public getResults(): StrategyResults {
		const { drawdown, equity, tradeStats } = this.calculations
		const equityResults = equity.getResults()
		const tradeStatsResults = tradeStats.getResults()
		const drawdownResults = drawdown.getResults()

		// TODO: To make it clear what is being returned, destructure the results
		return {
			...drawdownResults,
			...tradeStatsResults,
			...equityResults
		}
	}

	public setWatchedCalculations(calculationNames: (keyof Calculations)[]) {
		this.watchedCalculationsMap = {
			handleStart: [],
			handleCandle: [],
			handlePositionOpen: [],
			handlePositionClose: [],
			handleEnd: []
		}
		for (const calculationName of calculationNames) {
			const calculation = this.calculations[calculationName]
			for (const handlerName of calculation.handlerNames) {
				const calculationMethod = calculation[handlerName as keyof typeof calculation] as any
				this.watchedCalculationsMap[handlerName].push(calculationMethod.bind(calculation))
			}
		}
	}

	public handleCandle(data: CurrentTestData) {
		this.watchedCalculationsMap.handleCandle.forEach((calculation) => calculation(data))
	}

	public handlePositionOpen(data: CurrentTestData) {
		this.watchedCalculationsMap.handlePositionOpen.forEach((calculation) => calculation(data))
	}

	public handlePositionClose(data: CurrentTestData) {
		this.watchedCalculationsMap.handlePositionClose.forEach((calculation) => calculation(data))
	}

	public handleEnd(data: CurrentTestData) {
		this.watchedCalculationsMap.handleEnd.forEach((calculation) => calculation(data))
	}

	public handleStart(data: CurrentTestData) {
		this.watchedCalculationsMap.handleStart.forEach((calculation) => calculation(data))
	}

	public reset(calculations?: Partial<Calculations>): void {
		const {
			drawdown = new PositionsDrawdown(),
			equity = new Equity(),
			tradeStats = new TradeStats()
		} = calculations || {}
		this.calculations.drawdown = drawdown
		this.calculations.equity = equity
		this.calculations.tradeStats = tradeStats
	}
}
