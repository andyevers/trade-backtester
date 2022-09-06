import { Account, Position, PriceHistoryCreateParams, TimeframeType } from '@src/repository'
import { Candle } from '@src/types'
import { CurrentTestData } from '.'
import Drawdown, { Calculation, CalculationHandlerName } from './calculations/Drawdown'
import Equity from './calculations/Equity'
import TradeStats from './calculations/TradeStats'

export interface StrategyResultsWithEntities extends StrategyResults {
	positions: Position[]
	priceHistory: PriceHistoryCreateParams
	account: Account
	equityHistory: number[]
	candlesTested: Candle[]
}

export interface StrategyResults {
	startTime: number // start
	endTime: number // end
	daysCount: number // duration
	timeframe: TimeframeType
	symbol: string

	candleCount: number
	candleCountInPositions: number // exposure
	equityEnding: number
	equityMax: number
	equityMin: number
	returnPercent: number
	returnPercentYearly: number
	returnPercentAvg: number
	volatilityPercentYearly: number

	//TRADES
	drawdownPercentMax: number
	drawdownPercentAvg: number
	drawdownDurationMax: number
	drawdownDurationAvg: number

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
	tradeDurationMin: number

	strategyName: string
	strategySettings: Record<string, number | string>

	sharpeRatio: number
	sortinoRatio: number
	calmarRatio: number
}

interface StrategyResultsAnalyzerArgs {
	calculations: Partial<Calculations>
}

interface Calculations {
	drawdown: Drawdown
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
			drawdown = new Drawdown(),
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
}
