// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Template Types
 *
 * Defines types for both JSON data templates and code-based templates.
 */

/** Template definition used by the registry */
export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  create: () => import('../../types').Project;
}

// ─── JSON Template Format ──────────────────────────────────────────────────

/** JSON representation of a project template */
export interface ProjectTemplateJSON {
  /** Unique template identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description of the template */
  description: string;
  /** Category for grouping (e.g., 'Software', 'Construction') */
  category: string;
  /** Project start date (ISO format) */
  startDate: string;
  /** Project end date (ISO format) */
  endDate?: string;
  /** Calendar configuration */
  calendar?: {
    /** Working days (0=Sun, 6=Sat). Default: [1,2,3,4,5] */
    workingDays?: number[];
    /** Holiday dates (ISO format) */
    holidays?: string[];
    /** Hours per day. Default: 8 */
    hoursPerDay?: number;
  };
  /** Task definitions (flat or nested) */
  tasks: TaskJSON[];
  /** Risk definitions */
  risks?: RiskJSON[];
  /** Resource definitions */
  resources?: ResourceJSON[];
  /** Material/asset definitions */
  materials?: MaterialJSON[];
}

/** JSON task definition (supports nested children) */
export interface TaskJSON {
  /** Unique task ID */
  id: string;
  /** Task name */
  name: string;
  /** Start date (ISO format) */
  startDate: string;
  /** End date (ISO format) */
  endDate: string;
  /** Task description/notes */
  description?: string;
  /** Progress percentage (0-100) */
  progress?: number;
  /** Resource ID assignment */
  resourceId?: string | null;
  /** Milestone flag */
  isMilestone?: boolean;
  /** Task color (hex) */
  color?: string;
  /** Dependency IDs */
  dependencies?: string[];
  /** Nested child tasks */
  children?: TaskJSON[];
}

/** JSON risk definition */
export interface RiskJSON {
  /** Unique risk ID */
  id: string;
  /** Risk title */
  title: string;
  /** Risk category */
  category: 'technical' | 'schedule' | 'cost' | 'resource' | 'external' | 'quality' | 'scope' | 'other';
  /** Probability (1-5) */
  probability: number;
  /** Impact (1-5) */
  impact: number;
  /** Risk status */
  status?: 'identified' | 'assessing' | 'mitigating' | 'monitoring' | 'occurred' | 'closed';
  /** Owner resource ID */
  ownerId?: string | null;
  /** Mitigation plan description */
  mitigationPlan?: string;
  /** Notes */
  notes?: string;
  /** Identified date (ISO format) */
  identifiedDate?: string;
  /** Review date (ISO format) */
  reviewDate?: string;
}

/** JSON resource definition */
export interface ResourceJSON {
  /** Unique resource ID */
  id: string;
  /** Resource name */
  name: string;
  /** Role/title */
  role?: string;
  /** Cost rate (per hour/day) */
  costRate?: number;
  /** Currency code */
  costCurrency?: string;
  /** Availability percentage (0-100) */
  availability?: number;
  /** Color (hex) */
  color?: string;
}

/** JSON material definition */
export interface MaterialJSON {
  /** Unique material ID */
  id: string;
  /** Material name */
  name: string;
  /** Classification: 'capex', 'opex', or 'consumable' */
  classification: string;
  /** Unit of measure (each, kg, hours, etc.) */
  unit?: string;
  /** Cost per unit */
  unitCost: number;
  /** Quantity */
  quantity?: number;
  /** Vendor/supplier name */
  vendor?: string | null;
  /** Depreciation method (CapEx) */
  depreciationMethod?: string;
  /** Useful life in months (CapEx) */
  usefulLifeMonths?: number;
  /** Salvage value (CapEx) */
  salvageValue?: number;
  /** Billing period (OpEx) */
  billingPeriod?: string;
  /** Rental rate per billing period (OpEx) */
  rentalRate?: number;
  /** Lease start date (ISO) */
  leaseStartDate?: string | null;
  /** Lease end date (ISO) */
  leaseEndDate?: string | null;
  /** Wastage percentage (Consumable) */
  wastageRate?: number;
  /** Reorder point (Consumable) */
  reorderPoint?: number;
  /** Carrying cost per unit per month */
  carryingCostPerUnit?: number;
  /** Currency code */
  currency?: string;
  /** Status */
  status?: string;
}
