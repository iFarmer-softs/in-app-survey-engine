import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('survey_responses')
export class SurveyResponseEntity {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  id: string;

  @Column({ type: 'varchar', length: 128 })
  surveyId: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  versionId?: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  respondentId?: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  surveyorId?: string;

  @Column({ type: 'int', default: 1 })
  groupNumber: number;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  answers: any;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  mediaUrls: string[];

  @Column({ type: 'float', nullable: true })
  latitude?: number;

  @Column({ type: 'float', nullable: true })
  longitude?: number;

  @Column({ type: 'boolean', default: false })
  isGroupJumped: boolean;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata: any;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: string;
}

