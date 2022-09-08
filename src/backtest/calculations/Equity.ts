import { Account } from '@src/repository'
import { CurrentTestData } from '..'
import { Calculation, CalculationHandlerName } from '../StrategyResultsAnalyzer'

interface EquityResults {
	equityHistory: number[]
	equityMax: number
	equityMin: number
	equityEnding: number

	drawdownHistory: number[]
	drawdownPercentMax: number
	drawdownPercentAvg: number
	drawdownDurationMax: number

	/**
	 * Indicates relationship between risk and return. Uses 1 year average return.
	 * @see https://corporatefinanceinstitute.com/resources/knowledge/trading-investing/calmar-ratio/
	 */
	calmarRatio: number

	/**
	 *
	 */
	sharpeRatio: number
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

	private currentDrawdownPercent = 0
	private currentDrawdownStartTime: number | null = null
	private countDrawdowns = 0

	private readonly results: EquityResults = {
		equityHistory: [],
		equityMax: 0,
		equityMin: Infinity,
		equityEnding: 0,

		drawdownDurationMax: 0,
		drawdownHistory: [],
		drawdownPercentAvg: 0,
		drawdownPercentMax: 0,
		calmarRatio: 0,
		sharpeRatio: 0
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

		// Drawdown
		const drawdownCurrent = (this.results.equityMax - equity) / this.results.equityMax
		this.results.drawdownHistory.push(drawdownCurrent)

		if (equity < this.results.equityMax) {
			if (this.currentDrawdownStartTime === null) {
				this.currentDrawdownStartTime = candle.time
			} else if (candle.time - this.currentDrawdownStartTime > this.results.drawdownDurationMax) {
				this.results.drawdownDurationMax = candle.time - this.currentDrawdownStartTime
			}
			if (drawdownCurrent > this.currentDrawdownPercent) {
				this.currentDrawdownPercent = drawdownCurrent

				if (drawdownCurrent > this.results.drawdownPercentMax) {
					this.results.drawdownPercentMax = drawdownCurrent
				}
			}
		} else {
			this.countDrawdowns++
			this.results.drawdownPercentAvg =
				(this.results.drawdownPercentAvg + this.currentDrawdownPercent) / this.countDrawdowns

			this.currentDrawdownPercent = 0
			this.currentDrawdownStartTime = null
		}
	}

	public handleStart(data: CurrentTestData): void {
		this.account = data.account
	}

	public handleEnd(data: CurrentTestData): void {
		const { account, currentCandle, startingCandle } = data
		if (this.results.equityMin === Infinity) this.results.equityMin = 0
		this.results.equityEnding = this.results.equityHistory[this.results.equityHistory.length - 1]

		const { startingCash, startingMarginDebt } = account

		const MS_YEAR = 31536000000
		const years = (currentCandle.time - startingCandle.time) / MS_YEAR

		const equityStarting = startingCash - startingMarginDebt
		const profit = this.results.equityEnding - equityStarting

		// TODO: Should we be using the return of the positions or the account?
		const returnPercent = profit / equityStarting
		const returnPercentYearly = returnPercent / years
		this.results.calmarRatio = returnPercentYearly / this.results.drawdownPercentMax

		// = np.sqrt((day_returns.var(ddof=int(bool(day_returns.shape))) + (1 + gmean_day_return)**2)**annual_trading_days - (1 + gmean_day_return)**(2*annual_trading_days)) * 100
		/* s.loc['Volatility (Ann.) [%]'] = 
        np.sqrt(
            (day_returns.var(ddof=int(bool(day_returns.shape))) 
            + (1 + gmean_day_return)**2)**annual_trading_days 
            - (1 + gmean_day_return)**(2*annual_trading_days)
        ) * 100  # noqa: E501
        
        */
		const volatilityYearly = Math.sqrt((returnPercentYearly + 1) ** 2 - 1) * 100
	}

	public getResults(): EquityResults {
		return this.results
	}
}
