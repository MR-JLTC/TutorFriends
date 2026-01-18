import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('email_verification_registry')
export class EmailVerificationRegistry {
  @PrimaryGeneratedColumn()
  registry_id: number;

  @Index({ unique: true })
  @Column()
  email: string;

  @Column({
    type: 'enum',
    enum: ['tutor', 'tutee', 'admin'],
  })
  user_type: 'tutor' | 'tutee' | 'admin';

  @Column({ nullable: true })
  verification_code: string;

  @Column({ type: 'timestamp', nullable: true })
  verification_expires: Date;

  @Column({ default: false })
  is_verified: boolean;

  @CreateDateColumn()
  created_at: Date;
}
