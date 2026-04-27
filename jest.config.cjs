module.exports = {
	testEnvironment: 'jsdom',
	roots: ['<rootDir>/tests'],
	testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
	testPathIgnorePatterns: ['/node_modules/'],
	setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
	collectCoverage: false,
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
	coverageThreshold: {
		// Core domain services — enforced
		'src/services/db/contracts.ts': { branches: 60, functions: 60, lines: 60, statements: 60 },
		'src/services/db/installments.ts': { branches: 60, functions: 60, lines: 60, statements: 60 },
		'src/services/db/people.ts': { branches: 60, functions: 60, lines: 60, statements: 60 },
		'src/services/db/properties.ts': { branches: 60, functions: 60, lines: 60, statements: 60 },
		'src/services/db/financial.ts': { branches: 60, functions: 60, lines: 60, statements: 60 },
		'src/services/storage.ts': { branches: 60, functions: 60, lines: 60, statements: 60 },
		// Excluded — facades/desktop-only/stubs (TODO: raise gradually)
		// 'src/services/mockDb.ts' — facade, stubs intentional
		// 'src/services/domainQueries.ts' — desktop IPC only
		// 'src/services/db/system/marquee.ts' — low priority
		// 'src/services/db/backgroundScans.ts' — integration only
		// 'src/services/db/system/followups.ts' — TODO
		// 'src/services/db/system/sales_agreements.ts' — TODO
	},
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
