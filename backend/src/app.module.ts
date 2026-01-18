import { Module, Controller, Get } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { UniversitiesModule } from './universities/universities.module';
import { CoursesModule } from './courses/courses.module';
import { TutorsModule } from './tutors/tutors.module';
import { PaymentsModule } from './payments/payments.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { EmailModule } from './email/email.module';
import * as entities from './database/entities';
import { LandingModule } from './landing/landing.module';
import { SubjectsModule } from './subjects/subjects.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReschedulesModule } from './reschedules/reschedules.module';

@Controller()
export class AppController {
  @Get()
  getRoot() {
    return {
      message: 'TutorLink API is running!',
      version: '1.0.0',
      endpoints: {
        auth: '/api/auth',
        courses: '/api/courses',
        universities: '/api/universities',
        tutors: '/api/tutors',
        payments: '/api/payments',
        dashboard: '/api/dashboard',
        email: '/api/email'
      }
    };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: Object.values(entities),
      synchronize: process.env.NODE_ENV !== 'production', // Only synchronize in development
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    UniversitiesModule,
    CoursesModule,
    TutorsModule,
    PaymentsModule,
    DashboardModule,
    LandingModule,
    SubjectsModule,
    EmailModule,
    NotificationsModule,
    ReschedulesModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule { }
