import type { Node, Edge } from '@xyflow/react';
import type { GroupMeta } from '../utils/schemaCompiler';

export interface FlowchartProject {
  id: string;
  title: string;
  titleBn?: string;
  description: string;
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
  updatedAt: string;
  groupMeta: GroupMeta;
  nodes: Node[];
  edges: Edge[];
}
