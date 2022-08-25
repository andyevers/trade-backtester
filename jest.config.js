/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	coverageReporters: ['html-spa'],
	collectCoverage: true,
	verbose: true,
	testMatch: ['/**/*.test.ts'],
	moduleNameMapper: {
		'^@src(.*)$': '<rootDir>/src$1'
	}
}
