module.exports = {
	testEnvironment: 'jsdom',
	roots: ['<rootDir>/tests'],
	testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
	testPathIgnorePatterns: ['/node_modules/'],
	setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
	collectCoverage: true,
	collectCoverageFrom: [
		'src/**/*.{ts,tsx}',
		'!src/**/*.d.ts',
		'!src/main.tsx',
		'!src/types/**',
		'!src/context/**',
		'!src/pages/Login.tsx',
		'!src/components/ui/**',
		'!src/components/shared/AppModal.tsx',
		'!src/utils/scrollLock.ts',
	],
	coverageReporters: ['text', 'text-summary', 'lcov', 'json-summary'],
	transform: {
		'^.+\\.(ts|tsx)$': [
			'ts-jest',
			{
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
