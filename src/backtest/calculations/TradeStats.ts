import { Position } from '@src/repository'
import { CurrentTestData } from '..'
import { Calculation, CalculationHandlerName } from './Drawdown'

interface TradeStatsResults {
	tradeCount: number
	tradeCountLong: number
	tradeCountShort: number

	tradeProfitPercentBest: number
	tradeProfitPercentWorst: number
	tradeProfitPercentAvg: number

	tradeDurationAvg: number
	tradeDurationMax: number

	winPercent: number
	winPercentLong: number
	winPercentShort: number

	winCount: number
	winCountLong: number
	winCountShort: number

	countCandlesInPositions: number
}

export default class TradeStats implements Calculation<TradeStatsResults> {
	public readonly handlerNames: CalculationHandlerName[] = [
		'handlePositionClose',
		'handlePositionOpen',
		'handleCandle',
		'handleEnd'
	]

	private readonly results: TradeStatsResults = {
		tradeCount: 0,
		tradeCountLong: 0,
		tradeCountShort: 0,

		tradeProfitPercentBest: 0,
		tradeProfitPercentWorst: Infinity,
		tradeProfitPercentAvg: 0,

		tradeDurationAvg: 0,
		tradeDurationMax: 0,

		winPercent: 0,
		winPercentLong: 0,
		winPercentShort: 0,

		winCount: 0,
		winCountLong: 0,
		winCountShort: 0,

		countCandlesInPositions: 0
	}

	private readonly openPositionIds = new Set<number>()

	public handleCandle(): void {
		if (this.openPositionIds.size > 0) {
			this.results.countCandlesInPositions++
		}
	}

	public handlePositionOpen(data: CurrentTestData): void {
		const position = data.currentPosition as Position<'OPEN'>
		this.openPositionIds.add(position.id)
	}

	public handlePositionClose(data: CurrentTestData): void {
		const position = data.currentPosition as Position<'CLOSED'>
		const { exitProfit } = position

		this.openPositionIds.delete(position.id)

		const profitPercent = exitProfit / position.cost
		const durationMs = position.exitTime - position.entryTime

		this.results.tradeCount++
		if (profitPercent > this.results.tradeProfitPercentBest) {
			this.results.tradeProfitPercentBest = profitPercent
		}
		if (profitPercent < this.results.tradeProfitPercentWorst) {
			this.results.tradeProfitPercentWorst = profitPercent
		}
		this.results.tradeProfitPercentAvg =
			(this.results.tradeProfitPercentAvg * (this.results.tradeCount - 1) + profitPercent) /
			this.results.tradeCount

		if (profitPercent > 0) {
			this.results.winCount++
			this.results.winPercent = this.results.winCount / this.results.tradeCount
			if (position.type === 'LONG') {
				this.results.winCountLong++
			} else {
				this.results.winCountShort++
			}
		}

		if (position.type === 'LONG') {
			this.results.tradeCountLong++
			this.results.winPercentLong = this.results.winCountLong / this.results.tradeCountLong
		} else {
			this.results.tradeCountShort++
			this.results.winPercentShort = this.results.winCountShort / this.results.tradeCountShort
		}

		if (durationMs > this.results.tradeDurationMax) {
			this.results.tradeDurationMax = durationMs
		}

		this.results.tradeDurationAvg =
			(this.results.tradeDurationAvg * (this.results.tradeCount - 1) + durationMs) /
			this.results.tradeCount
	}

	public handleEnd(data: CurrentTestData): void {
		if (this.results.tradeProfitPercentWorst === Infinity) {
			this.results.tradeProfitPercentWorst = 0
		}
	}

	public getResults(): TradeStatsResults {
		return this.results
	}
}
