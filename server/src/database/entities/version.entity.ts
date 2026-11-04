import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import type { ProjectEntity } from './project.entity';
import type { GroupMeta } from '../../types';

@Entity('flowchart_versions')
export class VersionEntity {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  id: string;

  @Column({ type: 'varchar', length: 128 })
  projectId: string;

  @Column({ type: 'varchar', length: 32, default: '1.0.0' })
  version: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 32, default: 'draft' })
  status: 'draft' | 'published' | 'archived';

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  createdBy?: string;

  @Column({ type: 'int', default: 0 })
  nodeCount: number;

  @Column({ type: 'int', default: 0 })
  edgeCount: number;

  @Column({ type: 'int', default: 0 })
  questionCount: number;

  @Column({ type: 'int', default: 1 })
  groupCount: number;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  groupMeta: GroupMeta;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  nodes: any[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  edges: any[];

  @ManyToOne('ProjectEntity', 'versions', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project?: ProjectEntity;
}

