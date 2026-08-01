// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen } from '@testing-library/react';
import { ChartRenderer } from './ChartRenderer';
import type { ChartConfig } from '../../types';

function createChartConfig(overrides: Partial<ChartConfig> = {}): ChartConfig {
  return {
    id: 'test-chart',
    type: 'bar',
    title: 'Test Chart',
    dataRange: 'A1:C5',
    series: [{ label: 'Sales', dataRange: 'B1:B5' }],
    legendPosition: 'bottom',
    width: 400,
    height: 300,
    row: 0,
    col: 0,
    ...overrides,
  };
}

const sampleData = {
  categories: ['Jan', 'Feb', 'Mar'],
  series: [
    { label: 'Sales', values: [100, 150, 200] },
    { label: 'Profit', values: [20, 30, 50] },
  ],
};

describe('ChartRenderer', () => {
  it('renders SVG element', () => {
    const { container } = render(
      <ChartRenderer config={createChartConfig()} width={400} height={300} data={sampleData} />,
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('width', '400');
    expect(svg).toHaveAttribute('height', '300');
  });

  it('renders chart title', () => {
    render(
      <ChartRenderer config={createChartConfig({ title: 'My Chart' })} width={400} height={300} data={sampleData} />,
    );
    expect(screen.getByText('My Chart')).toBeInTheDocument();
  });

  describe('Bar Chart', () => {
    it('renders correct number of bars', () => {
      const { container } = render(
        <ChartRenderer config={createChartConfig({ type: 'bar', legendPosition: 'none' })} width={400} height={300} data={sampleData} />,
      );
      const bars = container.querySelectorAll('rect');
      // 3 categories * 2 series = 6 bars
      expect(bars.length).toBe(6);
    });
  });

  describe('Line Chart', () => {
    it('renders paths', () => {
      const { container } = render(
        <ChartRenderer config={createChartConfig({ type: 'line' })} width={400} height={300} data={sampleData} />,
      );
      const paths = container.querySelectorAll('path');
      expect(paths.length).toBeGreaterThan(0);
    });

    it('renders data point markers', () => {
      const { container } = render(
        <ChartRenderer config={createChartConfig({ type: 'line' })} width={400} height={300} data={sampleData} />,
      );
      const circles = container.querySelectorAll('circle');
      expect(circles.length).toBe(6);
    });
  });

  describe('Pie Chart', () => {
    const pieData = { categories: ['A', 'B', 'C'], series: [{ label: 'Value', values: [30, 20, 50] }] };

    it('renders slices', () => {
      const { container } = render(
        <ChartRenderer config={createChartConfig({ type: 'pie' })} width={400} height={300} data={pieData} />,
      );
      const paths = container.querySelectorAll('path');
      expect(paths.length).toBe(3);
    });

    it('renders tooltips with percentages', () => {
      render(
        <ChartRenderer config={createChartConfig({ type: 'pie' })} width={400} height={300} data={pieData} />,
      );
      const titles = document.querySelectorAll('svg title');
      expect(titles.length).toBeGreaterThan(0);
    });

    it('shows No data for empty', () => {
      render(
        <ChartRenderer config={createChartConfig({ type: 'pie' })} width={400} height={300} data={{ categories: [], series: [] }} />,
      );
      expect(screen.getByText('No data')).toBeInTheDocument();
    });
  });

  describe('Scatter Chart', () => {
    const xyData = {
      categories: ['1', '2', '3'],
      series: [
        { label: 'X', values: [1, 2, 3] },
        { label: 'Y', values: [10, 20, 30] },
      ],
    };

    it('renders circles', () => {
      const { container } = render(
        <ChartRenderer config={createChartConfig({ type: 'scatter' })} width={400} height={300} data={xyData} />,
      );
      const circles = container.querySelectorAll('circle');
      expect(circles.length).toBe(3);
    });

    it('shows message for single series', () => {
      render(
        <ChartRenderer
          config={createChartConfig({ type: 'scatter' })}
          width={400}
          height={300}
          data={{ categories: ['A'], series: [{ label: 'Only', values: [1] }] }}
        />,
      );
      expect(screen.getByText('Need 2+ series')).toBeInTheDocument();
    });
  });

  describe('Axes', () => {
    it('renders x-axis category labels', () => {
      render(
        <ChartRenderer config={createChartConfig({ type: 'bar' })} width={400} height={300} data={sampleData} />,
      );
      expect(screen.getByText('Jan')).toBeInTheDocument();
    });

    it('renders custom axis labels', () => {
      render(
        <ChartRenderer
          config={createChartConfig({ xAxisLabel: 'Month', yAxisLabel: 'Revenue' })}
          width={400}
          height={300}
          data={sampleData}
        />,
      );
      expect(screen.getByText('Month')).toBeInTheDocument();
      expect(screen.getByText('Revenue')).toBeInTheDocument();
    });
  });

  describe('Legend', () => {
    it('renders legend when position is right', () => {
      render(
        <ChartRenderer config={createChartConfig({ legendPosition: 'right' })} width={400} height={300} data={sampleData} />,
      );
      expect(screen.getByText('Sales')).toBeInTheDocument();
      expect(screen.getByText('Profit')).toBeInTheDocument();
    });

    it('does not render legend for single series', () => {
      render(
        <ChartRenderer
          config={createChartConfig({ legendPosition: 'right' })}
          width={400}
          height={300}
          data={{ categories: ['A', 'B'], series: [{ label: 'Solo', values: [1, 2] }] }}
        />,
      );
      expect(screen.queryByText('Solo')).not.toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('handles empty data', () => {
      render(
        <ChartRenderer config={createChartConfig()} width={400} height={300} data={{ categories: [], series: [] }} />,
      );
      expect(screen.getByText('No data')).toBeInTheDocument();
    });

    it('handles null values', () => {
      const { container } = render(
        <ChartRenderer
          config={createChartConfig({ type: 'bar' })}
          width={400}
          height={300}
          data={{ categories: ['A', 'B'], series: [{ label: 'S1', values: [10, null] }] }}
        />,
      );
      const bars = container.querySelectorAll('rect');
      expect(bars.length).toBe(2);
    });

    it('handles negative values', () => {
      const { container } = render(
        <ChartRenderer
          config={createChartConfig({ type: 'bar', legendPosition: 'none' })}
          width={400}
          height={300}
          data={{ categories: ['A', 'B'], series: [{ label: 'S1', values: [-10, 20] }] }}
        />,
      );
      const bars = container.querySelectorAll('rect');
      expect(bars.length).toBe(2);
    });
  });
});
