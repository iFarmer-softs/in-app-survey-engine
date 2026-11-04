import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { GroupCategory, GroupQuestionTemplate } from '../../types';

@Entity('reusable_question_groups')
export class QuestionGroupEntity {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  id: string;

  @Column({ type: 'int', nullable: true })
  groupId?: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  nameBn?: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ type: 'varchar', length: 64, default: 'custom' })
  category: GroupCategory;

  @Column({ type: 'varchar', length: 32, default: '#0284c7' })
  color: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  questions: GroupQuestionTemplate[];

  @Column({ type: 'jsonb', nullable: true })
  flowNodes?: any[];

  @Column({ type: 'jsonb', nullable: true })
  flowEdges?: any[];
}

