import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Student } from './student.entity';
import { Tutor } from './tutor.entity';
import { Subject } from './subject.entity';
import { Rating } from './rating.entity';

@Entity('session_history')
export class Session {
  @PrimaryGeneratedColumn()
  session_id: number;

  @ManyToOne(() => Student, (student) => student.sessions)
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @ManyToOne(() => Tutor, (tutor) => tutor.sessions)
  @JoinColumn({ name: 'tutor_id' })
  tutor: Tutor;

  @ManyToOne(() => Subject)
  @JoinColumn({ name: 'subject_id' })
  subject: Subject;

  @Column({ type: 'timestamp' })
  start_time: Date;

  @Column({ type: 'timestamp' })
  end_time: Date;

  @Column({
    type: 'enum',
    enum: ['scheduled', 'completed', 'cancelled'],
    default: 'scheduled',
  })
  status: 'scheduled' | 'completed' | 'cancelled';

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => Rating, (rating) => rating.session)
  ratings: Rating[];
}
