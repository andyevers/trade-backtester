/**
 * Gets the moving standard deviation of a series of values.
 */
export default class MovingStdDev {
	private readonly period: number
	private readonly observationWindow: number[]

	private count: number = 0
	private average: number = 0
	private varianceSum: number = 0

	constructor(period: number) {
		this.period = period
		this.observationWindow = [period]
	}

	/**
	 * Returns the moving standard deviation of the observations.
	 *
	 * @param usePopulationCalc Whether to use sample or population calculation (denominator n-1 or n respectively). defaults to sample calculation.
	 *
	 * @see https://www.calculatorsoup.com/calculators/statistics/standard-deviation-calculator.php
	 */
	public getStdDev(usePopulationCalc: boolean = false): number {
		const n = this.count < this.period ? this.count : this.period
		const denominator = usePopulationCalc ? n : n - 1
		const variance = n > 1 ? this.varianceSum / denominator : 0
		return Math.sqrt(variance) || 0
	}

	/**
	 * Number to include in the moving standard deviation calculation.
	 *
	 * @param observation number to be included
	 */
	public addObservation(observation: number): void {
		const index = this.count % this.period
		const oldObservation = this.observationWindow[index]
		this.observationWindow[index] = observation
		this.count++

		const oldAverage = this.average
		if (this.count <= this.period) {
			const delta = observation - oldAverage
			this.average += delta / this.count
			this.varianceSum += delta * (observation - this.average)
		} else {
			const delta = observation - oldObservation
			this.average += delta / this.period
			this.varianceSum += delta * (observation - this.average + (oldObservation - oldAverage))
		}
	}
}
