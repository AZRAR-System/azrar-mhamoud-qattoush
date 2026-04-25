import { createHandleSmartEngine } from '@/services/db/smartEngineBridge';
import { SmartEngine } from '@/services/smartEngine';
import * as alertsCore from '@/services/db/alertsCore';

jest.mock('@/services/smartEngine', () => ({
  SmartEngine: {
    track: jest.fn(),
    detectAnomalies: jest.fn(),
  },
}));

jest.mock('@/services/db/alertsCore', () => ({
  buildContractAlertContext: jest.fn(),
  stableAlertId: jest.fn(),
  upsertAlert: jest.fn(),
}));

describe('smartEngineBridge', () => {
  const mockAsUnknownRecord = jest.fn((data) => data as Record<string, unknown>);
  const handleSmartEngine = createHandleSmartEngine(mockAsUnknownRecord);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should track and detect anomalies without creating alerts if none found', () => {
    (SmartEngine.detectAnomalies as jest.Mock).mockReturnValue([]);
    
    const testData = { name: 'Test' };
    handleSmartEngine('person', testData);

    expect(mockAsUnknownRecord).toHaveBeenCalledWith(testData);
    expect(SmartEngine.track).toHaveBeenCalledWith('person', testData);
    expect(SmartEngine.detectAnomalies).toHaveBeenCalledWith('person', testData);
    expect(alertsCore.upsertAlert).not.toHaveBeenCalled();
  });

  it('should create and upsert alert when anomalies are detected', () => {
    const anomalies = ['Anomaly 1', 'Anomaly 2'];
    (SmartEngine.detectAnomalies as jest.Mock).mockReturnValue(anomalies);
    (alertsCore.stableAlertId as jest.Mock).mockReturnValue('stable-id');
    (alertsCore.buildContractAlertContext as jest.Mock).mockReturnValue({ مرجع_المعرف: 'contract-123' });

    const testData = { رقم_العقد: 'contract-123', someField: 'value' };
    handleSmartEngine('contract', testData);

    expect(SmartEngine.track).toHaveBeenCalledWith('contract', testData);
    expect(alertsCore.stableAlertId).toHaveBeenCalledWith(
      expect.any(String),
      'سلوك غير اعتيادي',
      anomalies.join(' '),
      'SmartBehavior'
    );
    expect(alertsCore.buildContractAlertContext).toHaveBeenCalledWith('contract-123');
    expect(alertsCore.upsertAlert).toHaveBeenCalledWith(expect.objectContaining({
      id: 'stable-id',
      الوصف: anomalies.join(' '),
      category: 'SmartBehavior',
      مرجع_المعرف: 'contract-123',
    }));
  });

  it('should handle non-contract categories without building contract context', () => {
    const anomalies = ['Anomaly 1'];
    (SmartEngine.detectAnomalies as jest.Mock).mockReturnValue(anomalies);
    (alertsCore.stableAlertId as jest.Mock).mockReturnValue('stable-id-property');

    const testData = { رقم_العقار: 'prop-456' };
    handleSmartEngine('property', testData);

    expect(alertsCore.buildContractAlertContext).not.toHaveBeenCalled();
    expect(alertsCore.upsertAlert).toHaveBeenCalledWith(expect.objectContaining({
      id: 'stable-id-property',
      الوصف: 'Anomaly 1',
    }));
  });

  it('should handle contract category with missing contract ID', () => {
    const anomalies = ['Anomaly 1'];
    (SmartEngine.detectAnomalies as jest.Mock).mockReturnValue(anomalies);
    
    const testData = { someField: 'value' }; // Missing 'رقم_العقد'
    handleSmartEngine('contract', testData);

    expect(alertsCore.buildContractAlertContext).not.toHaveBeenCalled();
    expect(alertsCore.upsertAlert).toHaveBeenCalled();
  });
});
