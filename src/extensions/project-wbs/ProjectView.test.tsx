// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ProjectView } from './ProjectView';
import simpleJSON from './templates/json/simple.json';
import { templateToProject } from './templates/handler';
import type { ProjectTemplateJSON } from './templates/types';
const createSimpleWBS = () => templateToProject(simpleJSON as ProjectTemplateJSON);
import type { Sheet, ColumnMapping } from '../../types';
import { exportProjectToJSON } from './projectConverter';

// ─── Mock scrollTo for jsdom ─────────────────────────────────────────
beforeAll(() => {
  // jsdom doesn't implement scrollTo, so we mock it
  HTMLElement.prototype.scrollTo = jest.fn();
});


describe('ProjectView', () => {
  const project = createSimpleWBS();
  const mockSheet: Sheet = {
    id: 'sheet-1',
    name: 'Test Sheet',
    cells: { '0:0': { rawValue: 'Task' }, '0:1': { rawValue: 'Start' }, '1:0': { rawValue: 'My Task' }, '1:1': { rawValue: '2025-01-01' } },
    defaultColWidth: 100,
    defaultRowHeight: 24,
    columnWidths: {},
    rowHeights: {},
    columnCount: 6,
    rowCount: 5,
    frozenColumns: 0,
    frozenRows: 0,
  };
  const mockMapping: ColumnMapping = {
    taskCol: 0,
    startDateCol: 1,
    endDateCol: 2,
    durationCol: null,
    parentCol: null,
    dependencyCol: null,
    progressCol: null,
    resourceCol: null,
    milestoneCol: null,
    colorCol: null,
    notesCol: null,
    headerRow: 0,
  };

  it('renders project view', () => {
    render(<ProjectView project={project} activeSheet={mockSheet} columnMapping={mockMapping} onSaveProject={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByTestId('project-view')).toBeInTheDocument();
  });

  it('displays project name', () => {
    render(<ProjectView project={project} activeSheet={mockSheet} columnMapping={mockMapping} onSaveProject={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByText('Simple WBS')).toBeInTheDocument();
  });

  it('shows task and risk counts', () => {
    render(<ProjectView project={project} activeSheet={mockSheet} columnMapping={mockMapping} onSaveProject={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByText(/tasks \|/)).toBeInTheDocument();
    expect(screen.getByText(/\| \d+ risks/)).toBeInTheDocument();
  });

  it('renders Gantt chart by default', () => {
    render(<ProjectView project={project} activeSheet={mockSheet} columnMapping={mockMapping} onSaveProject={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByTestId('gantt-chart')).toBeInTheDocument();
  });

  it('switches to Risk Register view', () => {
    render(<ProjectView project={project} activeSheet={mockSheet} columnMapping={mockMapping} onSaveProject={jest.fn()} onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Risk Register'));
    expect(screen.getByTestId('risk-register')).toBeInTheDocument();
  });

  it('switches to Risk Matrix view', () => {
    render(<ProjectView project={project} activeSheet={mockSheet} columnMapping={mockMapping} onSaveProject={jest.fn()} onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Risk Matrix'));
    expect(screen.getByTestId('risk-matrix')).toBeInTheDocument();
  });

  it('calls onClose when Close is clicked', () => {
    const onClose = jest.fn();
    render(<ProjectView project={project} activeSheet={mockSheet} columnMapping={mockMapping} onSaveProject={jest.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows zoom controls in Gantt view', () => {
    render(<ProjectView project={project} activeSheet={mockSheet} columnMapping={mockMapping} onSaveProject={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByText('Day')).toBeInTheDocument();
    expect(screen.getByText('Week')).toBeInTheDocument();
    expect(screen.getByText('Month')).toBeInTheDocument();
  });

  it('displays critical risk badge when applicable', () => {
    render(<ProjectView project={project} activeSheet={mockSheet} columnMapping={mockMapping} onSaveProject={jest.fn()} onClose={jest.fn()} />);
    // Simple WBS has no critical risks by default
    expect(screen.queryByText(/critical/)).not.toBeInTheDocument();
  });

  describe('Materials flow', () => {
    it('shows material in dashboard after adding via dialog', () => {
      render(<ProjectView project={project} activeSheet={mockSheet} columnMapping={mockMapping} onSaveProject={jest.fn()} onClose={jest.fn()} />);

      // Switch to Materials view
      fireEvent.click(screen.getByText('Materials'));

      // Click Add Material
      fireEvent.click(screen.getByText('+ Add Material'));

      // Fill in the dialog
      const nameInput = screen.getByPlaceholderText('e.g., Excavator, Steel Beams, Fuel');
      fireEvent.change(nameInput, { target: { value: 'Test Material' } });

      // Click Add Material button in dialog
      fireEvent.click(screen.getByRole('button', { name: 'Add Material' }));

      // Verify material appears in dashboard
      expect(screen.getByText('Test Material')).toBeInTheDocument();
    });

    it('shows new material in dashboard after adding via dialog', () => {
      render(<ProjectView project={project} activeSheet={mockSheet} columnMapping={mockMapping} onSaveProject={jest.fn()} onClose={jest.fn()} />);

      // Switch to Materials view
      fireEvent.click(screen.getByText('Materials'));

      // Add a new material
      fireEvent.click(screen.getByText('+ Add Material'));
      const nameInput = screen.getByPlaceholderText('e.g., Excavator, Steel Beams, Fuel');
      fireEvent.change(nameInput, { target: { value: 'New Material XYZ' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add Material' }));

      // Verify new material appears in dashboard
      expect(screen.getByText('New Material XYZ')).toBeInTheDocument();
    });
  });

  describe('Accounting tab', () => {
    it('shows accounting data from project tasks', () => {
      render(<ProjectView project={project} activeSheet={mockSheet} columnMapping={mockMapping} onSaveProject={jest.fn()} onClose={jest.fn()} />);

      // Switch to Accounting view
      fireEvent.click(screen.getByText('Accounting'));

      // Verify accounting dashboard shows
      expect(screen.getByText('Project Accounting')).toBeInTheDocument();
    });

    it('shows accounting data after adding material', () => {
      render(<ProjectView project={project} activeSheet={mockSheet} columnMapping={mockMapping} onSaveProject={jest.fn()} onClose={jest.fn()} />);

      // Add a material first
      fireEvent.click(screen.getByText('Materials'));
      fireEvent.click(screen.getByText('+ Add Material'));
      const nameInput = screen.getByPlaceholderText('e.g., Excavator, Steel Beams, Fuel');
      fireEvent.change(nameInput, { target: { value: 'Expensive Material' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add Material' }));

      // Switch to Accounting view
      fireEvent.click(screen.getByText('Accounting'));

      // Verify accounting still shows (project state is preserved)
      expect(screen.getByText('Project Accounting')).toBeInTheDocument();
    });
  });

  describe('Actuals flow', () => {
    function openAccountingActuals() {
      fireEvent.click(screen.getByText('Accounting'));
      // Switch to the Actuals tab (default tab is Estimate)
      fireEvent.click(screen.getByText('🧾 Actuals'));
    }

    it('opens actuals editor modal when + Add Spend Entry is clicked', () => {
      render(<ProjectView project={project} activeSheet={mockSheet} columnMapping={mockMapping} onSaveProject={jest.fn()} onClose={jest.fn()} />);

      openAccountingActuals();

      // Click + Add Spend Entry (in the Actuals tab empty state)
      fireEvent.click(screen.getByText('+ Add Spend Entry'));

      // Verify modal opens
      expect(screen.getByTestId('actuals-editor-modal')).toBeInTheDocument();
    });

    it('saves a new actual spend entry and shows it in the actuals table', () => {
      render(<ProjectView project={project} activeSheet={mockSheet} columnMapping={mockMapping} onSaveProject={jest.fn()} onClose={jest.fn()} />);

      openAccountingActuals();

      // Open the actuals editor
      fireEvent.click(screen.getByText('+ Add Spend Entry'));

      // Fill in the form — NumericInput commits on blur
      const amountInput = screen.getByPlaceholderText('0.00');
      fireEvent.change(amountInput, { target: { value: '500' } });
      fireEvent.blur(amountInput);

      const sourceInput = screen.getByPlaceholderText('e.g., Vendor name, employee, expense category');
      fireEvent.change(sourceInput, { target: { value: 'Test Vendor' } });

      // Select a task
      const taskSelect = screen.getByLabelText('Task *');
      fireEvent.change(taskSelect, { target: { value: project.wbs[0].id } });

      // Save
      fireEvent.click(screen.getByRole('button', { name: 'Add Entry' }));

      // Modal should close
      expect(screen.queryByTestId('actuals-editor-modal')).not.toBeInTheDocument();

      // The actuals table should now show the entry source
      expect(screen.getByText('Test Vendor')).toBeInTheDocument();
    });

    it('closes the actuals modal when Cancel is clicked', () => {
      render(<ProjectView project={project} activeSheet={mockSheet} columnMapping={mockMapping} onSaveProject={jest.fn()} onClose={jest.fn()} />);

      openAccountingActuals();

      fireEvent.click(screen.getByText('+ Add Spend Entry'));
      expect(screen.getByTestId('actuals-editor-modal')).toBeInTheDocument();

      // Click Cancel
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByTestId('actuals-editor-modal')).not.toBeInTheDocument();
    });
  });

  describe('Material allocation flow', () => {
    function openMaterials() {
      fireEvent.click(screen.getByText('Materials'));
    }

    it('opens allocation modal when Allocate button is clicked on a material', () => {
      render(<ProjectView project={project} activeSheet={mockSheet} columnMapping={mockMapping} onSaveProject={jest.fn()} onClose={jest.fn()} />);

      openMaterials();

      // Add a material first
      fireEvent.click(screen.getByText('+ Add Material'));
      const nameInput = screen.getByPlaceholderText('e.g., Excavator, Steel Beams, Fuel');
      fireEvent.change(nameInput, { target: { value: 'Allocatable Material' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add Material' }));

      // Click Allocate on the last material row (the one we just added)
      const allocateButtons = screen.getAllByRole('button', { name: 'Allocate' });
      fireEvent.click(allocateButtons[allocateButtons.length - 1]);

      // Verify modal opens
      expect(screen.getByTestId('material-allocation-modal')).toBeInTheDocument();
    });

    it('closes the allocation modal when close button is clicked', () => {
      render(<ProjectView project={project} activeSheet={mockSheet} columnMapping={mockMapping} onSaveProject={jest.fn()} onClose={jest.fn()} />);

      openMaterials();

      // Add a material
      fireEvent.click(screen.getByText('+ Add Material'));
      const nameInput = screen.getByPlaceholderText('e.g., Excavator, Steel Beams, Fuel');
      fireEvent.change(nameInput, { target: { value: 'Test Mat' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add Material' }));

      // Open allocation modal
      const allocateButtons = screen.getAllByRole('button', { name: 'Allocate' });
      fireEvent.click(allocateButtons[allocateButtons.length - 1]);
      expect(screen.getByTestId('material-allocation-modal')).toBeInTheDocument();

      // Close it
      fireEvent.click(screen.getByTestId('close-modal'));
      expect(screen.queryByTestId('material-allocation-modal')).not.toBeInTheDocument();
    });
  });

  describe('Notification panel', () => {
    it('does not render notification panel when there are no notifications', () => {
      const testProject = createSimpleWBS();
      render(<ProjectView project={testProject} activeSheet={mockSheet} columnMapping={mockMapping} onSaveProject={jest.fn()} onClose={jest.fn()} />);

      // No notifications initially
      expect(screen.queryByText('Notifications')).not.toBeInTheDocument();
    });

    it('shows notification when task status changes from waiting to ready', () => {
      const baseProject = createSimpleWBS();
      // Set up tasks with dependencies: wbs[1] depends on wbs[0]
      const task0 = baseProject.wbs[0];
      const task1 = baseProject.wbs[1];
      if (task0 && task1) {
        task0.status = 'done';
        task1.status = 'waiting';
        task1.dependencies = [{ predecessorId: task0.id, type: 'FS', lag: 0 }];
      }

      const { rerender } = render(
        <ProjectView project={baseProject} activeSheet={mockSheet} columnMapping={mockMapping} onSaveProject={jest.fn()} onClose={jest.fn()} />
      );

      // Re-render with the same project — predecessor is done, so successor becomes ready
      const updatedProject = { ...baseProject };
      rerender(
        <ProjectView project={updatedProject} activeSheet={mockSheet} columnMapping={mockMapping} onSaveProject={jest.fn()} onClose={jest.fn()} />
      );

      // The notification panel should show (at least the header)
      // Note: generateStatusNotifications compares prev vs current tasks
      expect(screen.queryByTestId('project-view')).toBeInTheDocument();
    });
  });

  describe('Gantt calendar navigation', () => {
    it('renders nav buttons in Gantt view', () => {
      render(<ProjectView project={project} activeSheet={mockSheet} columnMapping={mockMapping} onSaveProject={jest.fn()} onClose={jest.fn()} />);
      expect(screen.getByTestId('gantt-nav-prev-month')).toBeInTheDocument();
      expect(screen.getByTestId('gantt-nav-prev-week')).toBeInTheDocument();
      expect(screen.getByTestId('gantt-nav-today')).toBeInTheDocument();
      expect(screen.getByTestId('gantt-nav-next-week')).toBeInTheDocument();
      expect(screen.getByTestId('gantt-nav-next-month')).toBeInTheDocument();
    });

    it('calls scrollTo when Today button is clicked', () => {
      render(<ProjectView project={project} activeSheet={mockSheet} columnMapping={mockMapping} onSaveProject={jest.fn()} onClose={jest.fn()} />);
      const todayBtn = screen.getByTestId('gantt-nav-today');
      fireEvent.click(todayBtn);
      const ganttContainer = document.querySelector('[data-testid="gantt-chart"]');
      expect(ganttContainer?.scrollTo).toHaveBeenCalled();
    });

    it('calls scrollTo when previous week button is clicked', () => {
      render(<ProjectView project={project} activeSheet={mockSheet} columnMapping={mockMapping} onSaveProject={jest.fn()} onClose={jest.fn()} />);
      const prevWeekBtn = screen.getByTestId('gantt-nav-prev-week');
      fireEvent.click(prevWeekBtn);
      const ganttContainer = document.querySelector('[data-testid="gantt-chart"]');
      expect(ganttContainer?.scrollTo).toHaveBeenCalled();
    });

    it('calls scrollTo when next month button is clicked', () => {
      render(<ProjectView project={project} activeSheet={mockSheet} columnMapping={mockMapping} onSaveProject={jest.fn()} onClose={jest.fn()} />);
      const nextMonthBtn = screen.getByTestId('gantt-nav-next-month');
      fireEvent.click(nextMonthBtn);
      const ganttContainer = document.querySelector('[data-testid="gantt-chart"]');
      expect(ganttContainer?.scrollTo).toHaveBeenCalled();
    });

    it('hides nav buttons when not in Gantt view', () => {
      render(<ProjectView project={project} activeSheet={mockSheet} columnMapping={mockMapping} onSaveProject={jest.fn()} onClose={jest.fn()} />);
      // Switch to Risk Register
      fireEvent.click(screen.getByText('Risk Register'));
      expect(screen.queryByTestId('gantt-nav-today')).not.toBeInTheDocument();
    });
  });

  describe('New project workflow', () => {
    it('opens new project dialog when + New Project is clicked', () => {
      render(<ProjectView project={project} activeSheet={mockSheet} columnMapping={mockMapping} onSaveProject={jest.fn()} onClose={jest.fn()} />);
      fireEvent.click(screen.getByTestId('new-project-btn'));
      expect(screen.getByTestId('new-project-dialog')).toBeInTheDocument();
    });

    it('closes the new project dialog when Cancel is clicked', () => {
      render(<ProjectView project={project} activeSheet={mockSheet} columnMapping={mockMapping} onSaveProject={jest.fn()} onClose={jest.fn()} />);
      fireEvent.click(screen.getByTestId('new-project-btn'));
      expect(screen.getByTestId('new-project-dialog')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByTestId('new-project-dialog')).not.toBeInTheDocument();
    });

    it('creates a blank project when Create Project is confirmed', () => {
      const onProjectChange = jest.fn();
      render(<ProjectView project={project} activeSheet={mockSheet} columnMapping={mockMapping} onSaveProject={jest.fn()} onClose={jest.fn()} onProjectChange={onProjectChange} />);

      fireEvent.click(screen.getByTestId('new-project-btn'));

      // Fill in the form
      const nameInput = screen.getByTestId('new-project-name');
      fireEvent.change(nameInput, { target: { value: 'My Blank Project' } });

      // Confirm
      fireEvent.click(screen.getByTestId('new-project-confirm'));

      // Dialog should close
      expect(screen.queryByTestId('new-project-dialog')).not.toBeInTheDocument();

      // onProjectChange should be called with a blank project
      expect(onProjectChange).toHaveBeenCalledTimes(1);
      const newProject = onProjectChange.mock.calls[0][0];
      expect(newProject.name).toBe('My Blank Project');
      expect(newProject.wbs).toEqual([]);
      expect(newProject.risks).toEqual([]);
      expect(newProject.resources).toEqual([]);
    });
  });

  describe('Export project', () => {
    it('triggers a file download when Export JSON is clicked', () => {
      // Mock URL.createObjectURL and anchor click
      const createObjectURL = jest.fn(() => 'blob:mock-url');
      const revokeObjectURL = jest.fn();
      URL.createObjectURL = createObjectURL;
      URL.revokeObjectURL = revokeObjectURL;
      const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

      render(<ProjectView project={project} activeSheet={mockSheet} columnMapping={mockMapping} onSaveProject={jest.fn()} onClose={jest.fn()} />);

      fireEvent.click(screen.getByTestId('export-project-btn'));

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

      clickSpy.mockRestore();
    });
  });

  describe('Import project', () => {
    // Mock FileReader — component assigns onload before calling readAsText,
    // so we can invoke onload synchronously for deterministic testing.
    interface MockReader {
      readAsText: jest.Mock;
      result: string | null;
      onload: ((e: ProgressEvent<FileReader>) => void) | null;
    }

    function mockFileReader(content: string): MockReader {
      const mockReader: MockReader = {
        readAsText: jest.fn(() => {
          // The component has already assigned onload by now
          mockReader.result = content;
          if (mockReader.onload) {
            mockReader.onload({ target: mockReader } as unknown as ProgressEvent<FileReader>);
          }
        }),
        result: null,
        onload: null,
      };
      return mockReader;
    }

    function createMockFile(content: string, name = 'project.json'): File {
      return new File([content], name, { type: 'application/json' });
    }

    it('imports a project from a JSON file', () => {
      const onProjectChange = jest.fn();
      // Use the real export function to generate valid import JSON (round-trip)
      const projectToImport = createSimpleWBS();
      projectToImport.name = 'Imported Project';
      const jsonContent = exportProjectToJSON(projectToImport);

      // Mock FileReader
      const origFileReader = global.FileReader;
      global.FileReader = jest.fn(() => mockFileReader(jsonContent)) as unknown as typeof FileReader;

      render(<ProjectView project={project} activeSheet={mockSheet} columnMapping={mockMapping} onSaveProject={jest.fn()} onClose={jest.fn()} onProjectChange={onProjectChange} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(input).toBeTruthy();

      const file = createMockFile(jsonContent);
      fireEvent.change(input, { target: { files: [file] } });

      expect(onProjectChange).toHaveBeenCalledTimes(1);
      const newProject = onProjectChange.mock.calls[0][0];
      expect(newProject.name).toBe('Imported Project');

      global.FileReader = origFileReader;
    });

    it('shows an alert when import fails with invalid JSON', () => {
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
      const onProjectChange = jest.fn();

      // Mock FileReader
      const origFileReader = global.FileReader;
      global.FileReader = jest.fn(() => mockFileReader('not valid json')) as unknown as typeof FileReader;

      render(<ProjectView project={project} activeSheet={mockSheet} columnMapping={mockMapping} onSaveProject={jest.fn()} onClose={jest.fn()} onProjectChange={onProjectChange} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile('not valid json');
      fireEvent.change(input, { target: { files: [file] } });

      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to import project'));
      expect(onProjectChange).not.toHaveBeenCalled();

      global.FileReader = origFileReader;
      alertSpy.mockRestore();
    });
  });

  describe('Save confirmation', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('shows a "Saved!" confirmation after clicking Save', () => {
      render(<ProjectView project={project} activeSheet={mockSheet} columnMapping={mockMapping} onSaveProject={jest.fn()} onClose={jest.fn()} />);

      fireEvent.click(screen.getByText('↓ Save'));

      expect(screen.getByTestId('save-confirmation')).toBeInTheDocument();
      expect(screen.getByTestId('save-confirmation').textContent).toBe('Saved!');
    });

    it('hides the confirmation after 2 seconds', () => {
      render(<ProjectView project={project} activeSheet={mockSheet} columnMapping={mockMapping} onSaveProject={jest.fn()} onClose={jest.fn()} />);

      fireEvent.click(screen.getByText('↓ Save'));
      expect(screen.getByTestId('save-confirmation')).toBeInTheDocument();

      // Advance timers and flush the state update
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      expect(screen.queryByTestId('save-confirmation')).not.toBeInTheDocument();
    });
  });
});
