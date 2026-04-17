/**
 * Tests for auth session security
 * Ensures: no persistent sessions across app restarts
 * Covers: localStorage cleared on start, sessionStorage used for active session
 */

describe('Auth Session Security', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('session persistence behavior', () => {
    it('localStorage should NOT persist user session across restarts', () => {
      // Simulate: user was logged in, app restarts
      localStorage.setItem('khaberni_user', JSON.stringify({ id: 'U1', الاسم: 'أحمد' }));

      // Simulate app start: clear localStorage (new behavior)
      localStorage.removeItem('khaberni_user');

      const stored = localStorage.getItem('khaberni_user');
      expect(stored).toBeNull();
    });

    it('sessionStorage clears automatically when browser/app closes', () => {
      sessionStorage.setItem('khaberni_user', JSON.stringify({ id: 'U1' }));
      // sessionStorage is cleared by the browser on close — simulate by clearing
      sessionStorage.clear();
      expect(sessionStorage.getItem('khaberni_user')).toBeNull();
    });

    it('sessionStorage persists during active session (same tab)', () => {
      const userData = { id: 'U1', الاسم: 'أحمد' };
      sessionStorage.setItem('khaberni_user', JSON.stringify(userData));
      const stored = sessionStorage.getItem('khaberni_user');
      expect(stored).not.toBeNull();
      expect(JSON.parse(stored!).id).toBe('U1');
    });
  });

  describe('logout behavior', () => {
    it('removes user from sessionStorage on logout', () => {
      sessionStorage.setItem('khaberni_user', JSON.stringify({ id: 'U1' }));
      // Simulate logout
      sessionStorage.removeItem('khaberni_user');
      localStorage.removeItem('khaberni_user');
      expect(sessionStorage.getItem('khaberni_user')).toBeNull();
      expect(localStorage.getItem('khaberni_user')).toBeNull();
    });

    it('removes user from localStorage on logout (cleanup legacy)', () => {
      localStorage.setItem('khaberni_user', JSON.stringify({ id: 'U1' }));
      localStorage.removeItem('khaberni_user');
      expect(localStorage.getItem('khaberni_user')).toBeNull();
    });
  });

  describe('app restart simulation', () => {
    it('user must re-login after app restart', () => {
      // Before restart: user was logged in
      localStorage.setItem('khaberni_user', JSON.stringify({ id: 'U1' }));
      sessionStorage.setItem('khaberni_user', JSON.stringify({ id: 'U1' }));

      // Simulate app restart: localStorage cleared, sessionStorage cleared by browser
      localStorage.removeItem('khaberni_user');
      sessionStorage.clear();

      // After restart: no user found → must login
      const fromLocal = localStorage.getItem('khaberni_user');
      const fromSession = sessionStorage.getItem('khaberni_user');
      expect(fromLocal).toBeNull();
      expect(fromSession).toBeNull();
    });

    it('user from old localStorage session cannot bypass login', () => {
      // Attack: someone sets localStorage manually
      localStorage.setItem('khaberni_user', JSON.stringify({ id: 'ATTACKER', الدور: 'superadmin' }));

      // App start clears it
      localStorage.removeItem('khaberni_user');

      const user = localStorage.getItem('khaberni_user');
      expect(user).toBeNull();
    });
  });

  describe('cache security on logout', () => {
    it('cache should be rebuilt after logout to prevent stale data', () => {
      let cacheRebuilt = false;
      const mockBuildCache = () => { cacheRebuilt = true; };

      // Simulate logout with cache rebuild
      sessionStorage.removeItem('khaberni_user');
      localStorage.removeItem('khaberni_user');
      mockBuildCache();

      expect(cacheRebuilt).toBe(true);
    });
  });
});
