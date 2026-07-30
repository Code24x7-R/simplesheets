import { runBenchmark, logBenchmark } from './benchmark';

// Mock evaluateWorkbook to avoid expensive computation in tests
jest.mock('./formulaEngine', () => ({
  evaluateWorkbook: jest.fn(() => ({
    cells: {},
    circularRefs: [],
    success: true,
  })),
}));

describe('Benchmark', () => {
  it('runs benchmark with default size', () => {
    const result = runBenchmark(100);
    expect(result).toBeDefined();
    expect(result.cellCount).toBe(100);
    expect(result.evalTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.cellsPerMs).toBeGreaterThanOrEqual(0);
    expect(result.success).toBe(true);
  });

  it('runs benchmark with custom size', () => {
    const result = runBenchmark(50);
    expect(result.cellCount).toBe(50);
  });

  it('measures reasonable time for small workbooks', () => {
    const result = runBenchmark(10);
    expect(result.evalTimeMs).toBeLessThan(1000); // Should be very fast with mock
  });

  it('returns circular count of 0 for valid sheets', () => {
    const result = runBenchmark(50);
    expect(result.circularCount).toBe(0);
  });

  it('logBenchmark outputs to console', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    logBenchmark();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('SimpleSheet'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Benchmark'));
    consoleSpy.mockRestore();
  });

  it('createTestWorkbook handles large row counts efficiently', () => {
    // Verify the benchmark can create sheets with many rows without performance issues
    const result = runBenchmark(10000);
    expect(result.cellCount).toBe(10000);
    expect(result.success).toBe(true);
  });

  it('logBenchmark outputs WARN status for slow evaluation', () => {
    // Mock performance.now to simulate slow evaluation (> 10ms)
    let callCount = 0;
    const nowSpy = jest.spyOn(performance, 'now').mockImplementation(() => {
      callCount++;
      // Return 0 on first call (start), 100 on second call (end) → 100ms elapsed
      return callCount === 1 ? 0 : 100;
    });
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    logBenchmark();
    // With 100ms elapsed, the status should be WARN
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('⚠️'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('WARN'));
    consoleSpy.mockRestore();
    nowSpy.mockRestore();
  });

  it('runBenchmark handles zero elapsed time', () => {
    // Mock performance.now to return same value → 0ms elapsed
    jest.spyOn(performance, 'now').mockReturnValue(42);
    const result = runBenchmark(100);
    expect(result.evalTimeMs).toBe(0);
    expect(result.cellsPerMs).toBe(Infinity); // 100 / 0 = Infinity
  });

  it('runBenchmark uses default size of 5000 when called with no args', () => {
    const result = runBenchmark();
    expect(result.cellCount).toBe(5000);
    expect(result.success).toBe(true);
  });
});
