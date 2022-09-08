export interface IncrementalCalculatorArgs {
	useStoreNumbers?: boolean
}

//TODO: Break this into separate calculations (may not need min/max and stdDev etc...)
export default class IncrementalCalculator {
	private sumDifferences = 0
	private sumDifferences2 = 0
	private count = 0
	private sum = 0
	private min = 0
	private max = 0
	private firstNum = 0
	private lastNum = 0
	private nums: number[] = []

	private countNegative = 0
	private countPositive = 0

	private readonly useStoreNumbers: boolean
	constructor(args: IncrementalCalculatorArgs = {}) {
		const { useStoreNumbers = false } = args
		this.useStoreNumbers = useStoreNumbers
	}

	public add(num: number) {
		if (this.count === 0) {
			this.firstNum = num
			this.min = num
			this.max = num
			if (this.useStoreNumbers) this.nums = []
		}

		this.count++
		this.lastNum = num
		this.sumDifferences += num - this.firstNum
		this.sumDifferences2 += (num - this.firstNum) ** 2
		this.sum += num

		if (num > this.max) this.max = num
		else if (num < this.min) this.min = num

		if (num < 0) this.countNegative++
		else if (num > 0) this.countPositive++

		if (this.useStoreNumbers) this.nums.push(num)
	}

	public getNums() {
		if (!this.useStoreNumbers) {
			throw new Error('IncrementalCalculator was not initialized with useStoreNumbers')
		}
		return this.nums
	}

	public getVariance(usePopulationCalc: boolean = false) {
		const denominator = usePopulationCalc ? this.count : this.count - 1
		return (this.sumDifferences2 - this.sumDifferences ** 2 / this.count) / denominator
	}

	public getStdDev(usePopulationCalc: boolean = false) {
		return Math.sqrt(this.getVariance(usePopulationCalc))
	}

	public getMin() {
		return this.min
	}

	public getMax() {
		return this.max
	}

	public getCount() {
		return this.count
	}

	public getCountNegative() {
		return this.countNegative
	}

	public getCountPositive() {
		return this.countPositive
	}

	public getAverage() {
		return this.sum / this.count
	}

	public getFirstNum() {
		return this.firstNum
	}

	public getLastNum() {
		return this.lastNum
	}

	public getSumDifferences() {
		return this.sumDifferences
	}

	public getSumDifferences2() {
		return this.sumDifferences2
	}
}
