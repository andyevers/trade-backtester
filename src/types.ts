export interface Candle {
	open: number
	close: number
	high: number
	low: number
	volume: number
	time: number
}

export interface CandleBySymbol {
	[symbol: string]: Candle
}
