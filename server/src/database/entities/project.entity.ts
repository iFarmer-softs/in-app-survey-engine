import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { VersionEntity } from './version.entity';
import type { GroupMeta } from '../../types';

@Entity('flowchart_projects')
export class ProjectEntity {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  titleBn?: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ type: 'varchar', length: 32, default: 'draft' })
  status: 'draft' | 'published' | 'archived';

  @Column({ type: 'varchar', length: 32, default: '0.1.0' })
  currentVersion: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  publishedVersionId?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  groupMeta: GroupMeta;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  nodes: any[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  edges: any[];

  @OneToMany(() => VersionEntity, (version) => version.project, {
    cascade: true,
    eager: true,
  })
  versions: VersionEntity[];
}

