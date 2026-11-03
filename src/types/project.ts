import type { Node, Edge } from '@xyflow/react';
import type { GroupMeta } from '../utils/schemaCompiler';

export interface FlowchartVersion {
  id: string;
  version: string; // e.g. "1.0.0", "1.1.0"
  title: string;
  description?: string;
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
  createdBy?: string;
  nodeCount: number;
  edgeCount: number;
  questionCount: number;
  groupCount: number;
  nodes: Node[];
  edges: Edge[];
  groupMeta: GroupMeta;
}

export interface FlowchartProject {
  id: string;
  title: string;
  titleBn?: string;
  description: string;
  status: 'draft' | 'published' | 'archived';
  currentVersion: string; // e.g. "1.0.0"
  publishedVersionId?: string; // ID of the currently published snapshot
  versions: FlowchartVersion[];
  createdAt: string;
  updatedAt: string;
  groupMeta: GroupMeta;
  nodes: Node[];
  edges: Edge[];
}
