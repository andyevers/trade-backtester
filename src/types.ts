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

export interface Strategy {
	init(client: any): void
	next(candleBySymbol: CandleBySymbol): void
}
