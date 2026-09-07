// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson

/**
 * Supported project domains for Creator Canvas projects.
 */
export type CreatorProjectType =
  | 'film-video'
  | 'writing'
  | 'design-graphic'
  | 'design-app'
  | 'design-web'
  | 'design-motion'
  | 'photography'
  | 'marketing'
  | 'game-development'
  | 'architecture'
  | 'interiors'
  | 'home-renovation'
  | 'diy'
  | 'art'
  | 'craft'
  | 'fashion-design'
  | 'music-production'
  | 'content-creation'
  | 'other';

/**
 * Supported creative techniques.
 */
export type CreatorTechnique =
  | 'moodboarding'
  | 'note-taking'
  | 'brainstorming'
  | 'storyboarding'
  | 'creative-writing'
  | 'creative-brief'
  | 'research'
  | 'reference-collection'
  | 'shot-list'
  | 'character-development'
  | 'concept-mapping'
  | 'project-planning';

/**
 * Status of a Creator Canvas project.
 */
export type CreatorProjectStatus = 'draft' | 'in-progress' | 'review' | 'completed' | 'archived';

/**
 * Node types available on the canvas.
 */
export type CanvasNodeType =
  | 'note'
  | 'link'
  | 'image'
  | 'video'
  | 'sketch'
  | 'task'
  | 'brief'
  | 'swatch'
  | 'quote'
  | 'storyboard-frame';

/**
 * 2D point / vector.
 */
export interface CanvasPosition {
  x: number;
  y: number;
}

/**
 * 2D rectangle / bounding box.
 */
export interface CanvasBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Canvas workspace settings and viewport.
 */
export interface CanvasSettings {
  zoom: number;
  panX: number;
  panY: number;
  gridSnap: boolean;
  gridSize: number;
  backgroundColor: string;
}

/**
 * Base visual style for canvas nodes.
 */
export interface CanvasNodeStyle {
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  textColor?: string;
  fontSize?: number;
  borderRadius?: number;
  opacity?: number;
}

/**
 * Content payload for note nodes.
 */
export interface NoteNodePayload {
  text: string;
  format?: 'plain' | 'markdown';
}

/**
 * Content payload for link / reference nodes.
 */
export interface LinkNodePayload {
  url: string;
  siteName?: string;
  description?: string;
  thumbnailUrl?: string;
}

/**
 * Content payload for image nodes.
 */
export interface ImageNodePayload {
  url: string;
  altText?: string;
  caption?: string;
  credit?: string;
  thumbnailUrl?: string;
  aspectRatio?: number;
}

/**
 * Content payload for video reference nodes.
 */
export interface VideoNodePayload {
  url: string;
  embedType?: 'youtube' | 'vimeo' | 'direct' | 'other';
  title?: string;
  durationSeconds?: number;
  thumbnailUrl?: string;
}

/**
 * Content payload for sketch / drawing nodes.
 */
export interface SketchNodePayload {
  strokes: Array<{
    points: CanvasPosition[];
    color: string;
    width: number;
  }>;
  svgData?: string;
}

/**
 * Content payload for creative brief nodes.
 */
export interface BriefNodePayload {
  objective: string;
  targetAudience?: string;
  deliverables?: string[];
  tone?: string[];
  keyMessages?: string[];
}

/**
 * Content payload for color swatch nodes.
 */
export interface SwatchNodePayload {
  hex: string;
  rgb?: string;
  name?: string;
  role?: string;
}

/**
 * Content payload for quote nodes.
 */
export interface QuoteNodePayload {
  quote: string;
  speaker?: string;
  context?: string;
}

/**
 * Content payload for storyboard frame nodes.
 */
export interface StoryboardFramePayload {
  scene: string;
  shot: string;
  action: string;
  dialogue?: string;
  camera?: string;
  imageUrl?: string;
  durationSeconds?: number;
}

/**
 * Unified node payload union.
 */
export type CanvasNodePayload =
  | { type: 'note'; data: NoteNodePayload }
  | { type: 'link'; data: LinkNodePayload }
  | { type: 'image'; data: ImageNodePayload }
  | { type: 'video'; data: VideoNodePayload }
  | { type: 'sketch'; data: SketchNodePayload }
  | { type: 'brief'; data: BriefNodePayload }
  | { type: 'swatch'; data: SwatchNodePayload }
  | { type: 'quote'; data: QuoteNodePayload }
  | { type: 'storyboard-frame'; data: StoryboardFramePayload }
  | { type: 'task'; data: { taskId: string } }
  | { type: 'generic'; data: Record<string, unknown> };

/**
 * Single item placed on the canvas.
 */
export interface CanvasNode {
  id: string;
  type: CanvasNodeType;
  title: string;
  description?: string;
  position: CanvasPosition;
  width: number;
  height: number;
  zIndex: number;
  rotation?: number;
  locked?: boolean;
  collapsed?: boolean;
  style?: CanvasNodeStyle;
  tagIds?: string[];
  collectionId?: string;
  payload?: CanvasNodePayload;
  /** Explicit opt-in link to a Project/WBS task ID for task nodes. */
  linkedWbsTaskId?: string;
  createdDate: string;
  modifiedDate: string;
}

/**
 * Relationship / connector between canvas nodes.
 */
export interface CanvasConnection {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  relationship: 'sequence' | 'inspiration' | 'dependency' | 'reference' | 'custom';
  label?: string;
  style?: {
    color?: string;
    strokeWidth?: number;
    strokeDash?: 'solid' | 'dashed' | 'dotted';
    arrowStart?: boolean;
    arrowEnd?: boolean;
  };
}

/**
 * Lightweight project / delivery task.
 */
export interface CreatorTaskRow {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in-progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
  startDate?: string;
  assignee?: string;
  estimatedHours?: number;
  actualHours?: number;
  cost?: number;
  linkedNodeId?: string;
  /** Explicit opt-in link to a Project/WBS task ID. */
  linkedWbsTaskId?: string;
  tagIds?: string[];
  createdDate: string;
  modifiedDate: string;
}

/**
 * Collection / Frame for grouping nodes.
 */
export interface CanvasCollection {
  id: string;
  name: string;
  description?: string;
  category?: 'moodboard' | 'storyboard' | 'research' | 'ideas' | 'production' | 'assets' | 'custom';
  bounds: CanvasBounds;
  color?: string;
  locked?: boolean;
  collapsed?: boolean;
}

/**
 * Reusable tag for categorization.
 */
export interface CanvasTag {
  id: string;
  name: string;
  color: string;
}

/**
 * Top-level normalized Creator Canvas model.
 */
export interface CreatorCanvasModel {
  id: string;
  schemaVersion: '1.0.0';
  name: string;
  description: string;
  projectType: CreatorProjectType;
  techniques: CreatorTechnique[];
  status: CreatorProjectStatus;
  startDate?: string;
  targetDate?: string;
  createdDate: string;
  modifiedDate: string;
  canvas: CanvasSettings;
  nodes: CanvasNode[];
  connections: CanvasConnection[];
  tasks: CreatorTaskRow[];
  collections: CanvasCollection[];
  tags: CanvasTag[];
  metadata?: Record<string, unknown>;
}

/**
 * Workbook extension payload format.
 */
export interface CreatorCanvasExtensionData {
  extensionId: 'creator-canvas';
  schemaVersion: '1.0.0';
  data: {
    project: CreatorCanvasModel | null;
    sourceSheetIds?: {
      project?: string | null;
      items?: string | null;
      tasks?: string | null;
      links?: string | null;
      collections?: string | null;
      tags?: string | null;
    };
  };
}
