import { Position } from '../../repository'
import { CurrentTestData } from '..'
import { Calculation, CalculationHandlerName } from '../../backtest'

interface DrawdownResults {
	drawdownPercentMax: number
	drawdownPercentAvg: number
}

export default class PositionsDrawdown implements Calculation<DrawdownResults> {
	// the values in here should always be ascending.
	public readonly handlerNames: CalculationHandlerName[] = [
		'handleCandle',
		'handlePositionOpen',
		'handlePositionClose'
	]

	private readonly lowestLowsInPositions: number[] = []
	private readonly lowestLowsBuckets: {
		// lowPrice: Set<positionId>
		[lowestLow: number]: Set<number>
	} = {}

	// the values in here should always be descending.
	private readonly highestHighsInPositions: number[] = []
	private readonly highestHighsBuckets: {
		[highestHigh: number]: Set<number>
	} = {}

	private readonly positionIdsDrawdownPrices: {
		[positionId: number]: number
	} = {}

	private readonly drawdownPercentByPositionId: {
		[positionId: number]: number
	} = {}

	private closedPositionCount = 0
	private drawdownPercentMax = 0
	private drawdownPercentAvg = 0

	public getResults(): DrawdownResults {
		return {
			drawdownPercentAvg: this.drawdownPercentAvg,
			drawdownPercentMax: this.drawdownPercentMax
		}
	}

	public handleCandle(data: CurrentTestData) {
		const candle = data.currentCandle
		// check if is new low
		if (candle.low < this.lowestLowsInPositions[this.lowestLowsInPositions.length - 1]) {
			let isNewIndex = false
			while (candle.low < this.lowestLowsInPositions[this.lowestLowsInPositions.length - 1]) {
				// delete latest array item and key from this.lowestLowsBuckets
				const lowestLow = this.lowestLowsInPositions.pop() as number
				const positionIdsSet = this.lowestLowsBuckets[lowestLow]
				delete this.lowestLowsBuckets[lowestLow]

				if (this.lowestLowsBuckets[candle.low] === undefined) {
					this.lowestLowsBuckets[candle.low] = new Set()
					isNewIndex = true
				}

				positionIdsSet.forEach((id) => {
					this.lowestLowsBuckets[candle.low].add(id)
					this.positionIdsDrawdownPrices[id] = candle.low
				})
			}

			if (isNewIndex) {
				this.lowestLowsInPositions.push(candle.low)
			}
		}

		// check if is new high
		if (candle.high > this.highestHighsInPositions[this.highestHighsInPositions.length - 1]) {
			let isNewIndex = false
			while (candle.high < this.highestHighsInPositions[this.highestHighsInPositions.length - 1]) {
				const highVal = this.highestHighsInPositions.pop() as number
				const positionIdsSet = this.highestHighsBuckets[highVal]
				delete this.highestHighsBuckets[highVal]

				if (this.highestHighsBuckets[candle.high] === undefined) {
					this.highestHighsBuckets[candle.high] = new Set()
					isNewIndex = true
				}

				positionIdsSet.forEach((id) => {
					this.highestHighsBuckets[candle.high].add(id)
					this.positionIdsDrawdownPrices[id] = candle.high
				})
			}

			if (isNewIndex) {
				this.highestHighsInPositions.push(candle.high)
			}
		}
	}

	public handlePositionOpen(data: CurrentTestData) {
		const candle = data.currentCandle
		const position = data.currentPosition as Position

		if (position.type === 'LONG') {
			if (this.lowestLowsInPositions[this.lowestLowsInPositions.length - 1] !== candle.low) {
				this.lowestLowsInPositions.push(candle.low)
				this.lowestLowsBuckets[candle.low] = new Set()
			}
			this.lowestLowsBuckets[candle.low].add(position.id)
			this.positionIdsDrawdownPrices[position.id] = candle.low
		} else {
			if (this.highestHighsInPositions[this.highestHighsInPositions.length - 1] !== candle.high) {
				this.highestHighsInPositions.push(candle.high)
				this.highestHighsBuckets[candle.high] = new Set()
			}
			this.highestHighsBuckets[candle.high].add(position.id)
			this.positionIdsDrawdownPrices[position.id] = candle.high
		}
	}

	public handlePositionClose(data: CurrentTestData) {
		const position = data.currentPosition as Position<'CLOSED'>

		let drawdownPercent = 0
		if (position.type === 'LONG') {
			const lowestLow = this.positionIdsDrawdownPrices[position.id]
			this.lowestLowsBuckets[lowestLow].delete(position.id)
			delete this.positionIdsDrawdownPrices[position.id]
			drawdownPercent = (lowestLow - position.entryPrice) / position.entryPrice
		} else {
			const highestHigh = this.positionIdsDrawdownPrices[position.id]
			this.highestHighsBuckets[highestHigh].delete(position.id)
			delete this.positionIdsDrawdownPrices[position.id]
			drawdownPercent = (highestHigh - position.entryPrice) / position.entryPrice
		}

		this.drawdownPercentByPositionId[position.id] = drawdownPercent
		this.drawdownPercentAvg =
			(this.drawdownPercentAvg * this.closedPositionCount + drawdownPercent) /
			(this.closedPositionCount + 1)

		if (drawdownPercent > this.drawdownPercentMax) {
			this.drawdownPercentMax = drawdownPercent
		}

		this.closedPositionCount++
	}
}
