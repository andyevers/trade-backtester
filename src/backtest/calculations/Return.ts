import { Position } from '@src/repository'
import { CurrentTestData } from '../Backtester'
import { Calculation, CalculationHandlerName } from '../StrategyResultsAnalyzer'

interface ReturnResults<> {
	returnPercentMax: number
	returnPercentAvg: number
	returnPercentYearly: number
}

export default class Return implements Calculation<ReturnResults> {
	// the values in here should always be ascending.
	public readonly handlerNames: CalculationHandlerName[] = ['handlePositionClose', 'handleEnd']

	private readonly results: ReturnResults = {
		returnPercentMax: 0,
		returnPercentAvg: 0,
		returnPercentYearly: 0
	}

	private closedPositionCount = 0

	private readonly returnByPositionId: {
		[positionId: number]: number
	} = {}

	public handlePositionClose(data: CurrentTestData): void {
		const position = data.currentPosition as Position<'CLOSED'>
		const returnPercent = position.exitProfit / position.cost
		this.returnByPositionId[position.id] = returnPercent
		this.results.returnPercentAvg =
			(this.results.returnPercentAvg * this.closedPositionCount + returnPercent) /
			(this.closedPositionCount + 1)

		if (returnPercent > this.results.returnPercentMax) {
			this.results.returnPercentMax = returnPercent
		}
		this.closedPositionCount++
	}

	public handleEnd(data: CurrentTestData): void {
		const { startingCandle, currentCandle } = data
		const MS_YEAR = 31536000000
		const durationMs = currentCandle.time - startingCandle.time
		this.results.returnPercentYearly = (durationMs / MS_YEAR) * this.results.returnPercentAvg
	}

	public getResults(): ReturnResults {
		return this.results
	}
}
