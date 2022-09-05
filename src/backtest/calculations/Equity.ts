import { Account } from '@src/repository'
import { CurrentTestData } from '..'
import { Calculation, CalculationHandlerName } from './Drawdown'

interface EquityResults {
	equityHistory: number[]
	equityMax: number
	equityMin: number
	equityEnding: number
}

export default class Equity implements Calculation<EquityResults> {
	public readonly handlerNames: CalculationHandlerName[] = ['handleCandle', 'handleStart', 'handleEnd']

	/**
	 * This should be a reference to the account being used in the backtest so
	 * the positions are updated with the correct equity value.
	 */
	private account!: Account

	private resultPositionsSizes = {
		// combined amounts of all positions. used to get equity for each candle
		qtyLong: 0,
		qtyShort: 0,
		costLong: 0,
		costShort: 0
	}

	private readonly results: EquityResults = {
		equityHistory: [],
		equityMax: 0,
		equityMin: Infinity,
		equityEnding: 0
	}

	public handleCandle(data: CurrentTestData): void {
		const candle = data.currentCandle
		const { costLong, costShort, qtyLong, qtyShort } = this.resultPositionsSizes
		const profitLong = candle.close * qtyLong - costLong
		const profitShort = costShort - candle.close * qtyShort
		const equity = profitLong + profitShort + this.account.cash - this.account.marginDebt

		this.results.equityHistory.push(equity)

		if (equity < this.results.equityMin) this.results.equityMin = equity
		if (equity > this.results.equityMax) this.results.equityMax = equity
	}

	public handleStart(data: CurrentTestData): void {
		this.account = data.account
	}

	public handleEnd(data: CurrentTestData): void {
		if (this.results.equityMin === Infinity) this.results.equityMin = 0
		this.results.equityEnding = this.results.equityHistory[this.results.equityHistory.length - 1]
	}

	public getResults(): EquityResults {
		return this.results
	}
}
