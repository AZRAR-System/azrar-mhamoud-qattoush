/**
 * � 2025 � Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System � All Rights Reserved
 * 
 * Centralized Service Exports - Phase 2
 */

// Main Database Service (aggregator)
export { DbService } from './mockDb';

// Phase 3A: Domain-Specific Services
export * as PeopleService from './peopleService';
export * as PropertiesService from './propertiesService';

// Utility Services
export { buildCache, DbCache } from './dbCache';
export { SmartEngine } from './smartEngine';
export { SearchEngine } from './searchEngine';
export { audioService } from './audioService';
export { notificationService } from './notificationService';

// Note: mockDb.ts remains as the main aggregator for now
// Individual domain services can be imported directly if needed
