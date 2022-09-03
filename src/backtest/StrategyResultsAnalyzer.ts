import { Account, Position, TimeframeType } from '@src/repository'
import { Candle, CandleBySymbol } from '@src/types'

interface StrategyResultsAnalyzerArgs {
	positions: Position[]
	candles: Candle[]
	account: Account
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

	returnPercentEnding: number
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

/*
Start                     2004-08-19 00:00:00
End                       2013-03-01 00:00:00
Duration                   3116 days 00:00:00
Exposure Time [%]                       94.27
Equity Final [$]                     68935.12
Equity Peak [$]                      68991.22
Return [%]                             589.35
Buy & Hold Return [%]                  703.46
Return (Ann.) [%]                       25.42
Volatility (Ann.) [%]                   38.43
Sharpe Ratio                             0.66
Sortino Ratio                            1.30
Calmar Ratio                             0.77
Max. Drawdown [%]                      -33.08
Avg. Drawdown [%]                       -5.58
Max. Drawdown Duration      688 days 00:00:00
Avg. Drawdown Duration       41 days 00:00:00
# Trades                                   93
Win Rate [%]                            53.76
Best Trade [%]                          57.12
Worst Trade [%]                        -16.63
Avg. Trade [%]                           1.96
Max. Trade Duration         121 days 00:00:00
Avg. Trade Duration          32 days 00:00:00
Profit Factor                            2.13
Expectancy [%]                           6.91
SQN                                      1.78
_strategy              SmaCross(n1=10, n2=20)
*/

export default class StrategyResultsAnalyzer {
	// private readonly startingCash: number

	constructor(args: StrategyResultsAnalyzerArgs) {
		// const { startingCash } = args
		// this.startingCash = startingCash
	}

	// public analyze(): void {
}
