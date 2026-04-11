module.exports = {
	testEnvironment: 'jsdom',
	roots: ['<rootDir>/tests'],
	testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
	testPathIgnorePatterns: ['/node_modules/'],
	setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
	extensionsToTreatAsEsm: ['.ts', '.tsx'],
	collectCoverage: true,
	collectCoverageFrom: [
		'src/**/*.{ts,tsx}',
		'!src/**/*.d.ts',
		'!src/main.tsx',
		'!src/types/**'
	],
	coverageReporters: ['text-summary', 'lcov', 'json-summary'],
	transform: {
		'^.+\\.(ts|tsx)$': [
			'ts-jest',
			{
				useESM: true,
				tsconfig: '<rootDir>/tsconfig.json',
			},
		],
	},
	moduleNameMapper: {
		'^@/(.*)$': '<rootDir>/src/$1',
		'^(\\.{1,2}/.*)\\.js$': '$1',
		'\\.(css)$': 'identity-obj-proxy',
		'\\.(svg)$': '<rootDir>/tests/__mocks__/fileMock.js',
	},
	verbose: true,
};
