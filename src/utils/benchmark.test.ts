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
});
