import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, Tutor, Payment, Payout } from '../database/entities';
import { Session } from '../database/entities/session.entity';
import { Subject } from '../database/entities/subject.entity';
import { Student } from '../database/entities/student.entity';
import { University } from '../database/entities/university.entity';
import { Course } from '../database/entities/course.entity';
import { BookingRequest } from '../database/entities/booking-request.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Tutor)
    private tutorsRepository: Repository<Tutor>,
    @InjectRepository(Payment)
    private paymentsRepository: Repository<Payment>,
    @InjectRepository(Session)
    private sessionsRepository: Repository<Session>,
    @InjectRepository(Subject)
    private subjectsRepository: Repository<Subject>,
    @InjectRepository(Student)
    private studentsRepository: Repository<Student>,
    @InjectRepository(University)
    private universitiesRepository: Repository<University>,
    @InjectRepository(Course)
    private coursesRepository: Repository<Course>,
    @InjectRepository(Payout)
    private payoutsRepository: Repository<Payout>,
    @InjectRepository(BookingRequest)
    private bookingRequestRepository: Repository<BookingRequest>,
  ) { }

  async getStats() {
    const totalUsers = await this.usersRepository.count();

    const totalTutors = await this.tutorsRepository.count({
      where: { status: 'approved' },
    });

    const pendingApplications = await this.tutorsRepository.count({
      where: { status: 'pending' },
    });

    const PLATFORM_SHARE = 0.13;

    // Calculate total revenue: 13% of payouts with status 'released'
    // Payouts represent money released to tutors, so we calculate 13% of that
    const totalRevenueResult = await this.payoutsRepository
      .createQueryBuilder('payout')
      .select('COALESCE(SUM(payout.amount_released), 0)', 'sum')
      .where('payout.status = :releasedStatus', { releasedStatus: 'released' })
      .getRawOne();

    // Calculate 13% of the total payout amounts
    const totalAmount = Number(parseFloat(totalRevenueResult?.sum || '0') || 0);
    const totalRevenue = Number((totalAmount * PLATFORM_SHARE).toFixed(2));

    console.log(`[Dashboard] Total Revenue Query:`, {
      result: totalRevenueResult,
      sum: totalRevenueResult?.sum,
      totalAmount,
      totalRevenue,
      platformShare: PLATFORM_SHARE,
      filters: 'payouts.status = "released"'
    });

    // Confirmed sessions (completed booking requests)
    const confirmedSessions = await this.bookingRequestRepository.count({
      where: { status: 'completed' },
    });

    // Most in-demand subjects: top 5 by number of completed sessions per subject
    const inDemandSubjectsRaw = await this.sessionsRepository
      .createQueryBuilder('session')
      .select('session.subject_id', 'subject_id')
      .addSelect('COUNT(session.session_id)', 'count')
      .where('session.status = :status', { status: 'completed' })
      .groupBy('session.subject_id')
      .orderBy('count', 'DESC')
      .limit(5)
      .getRawMany();

    const subjectIds = inDemandSubjectsRaw.map((row) => row.subject_id).filter(Boolean);
    let subjectsMap: Record<number, string> = {};
    if (subjectIds.length > 0) {
      const subjects = await this.subjectsRepository.findByIds(subjectIds);
      subjectsMap = subjects.reduce((acc, s) => {
        acc[(s as any).subject_id] = (s as any).name;
        return acc;
      }, {} as Record<number, string>);
    }

    const mostInDemandSubjects = inDemandSubjectsRaw.map((row) => ({
      subjectId: Number(row.subject_id),
      subjectName: subjectsMap[Number(row.subject_id)] || 'Unknown',
      sessions: Number(row.count),
    }));

    // Payment activity overview: totals by status (all payments)
    const paymentStatusCountsRaw = await this.paymentsRepository
      .createQueryBuilder('payment')
      .select('payment.status', 'status')
      .addSelect('COUNT(payment.payment_id)', 'count')
      .groupBy('payment.status')
      .getRawMany();

    const paymentStatusCounts = paymentStatusCountsRaw.reduce((acc, row) => {
      acc[row.status] = Number(row.count);
      return acc;
    }, {} as Record<string, number>);

    // Recent confirmed revenue: 13% of payments (last 30 days)
    const recentPaymentsSumRaw = await this.paymentsRepository
      .createQueryBuilder('payment')
      .select('COALESCE(SUM(payment.amount * :platformShare), 0)', 'sum')
      .where('payment.created_at >= NOW() - INTERVAL \'30 days\'')
      .andWhere('(payment.status = :confirmed OR payment.status = :paid)', {
        confirmed: 'confirmed',
        paid: 'paid',
        platformShare: PLATFORM_SHARE
      })
      .getRawOne();

    const recentConfirmedRevenue = Number((parseFloat(recentPaymentsSumRaw?.sum || '0') || 0).toFixed(2));
    console.log(`[Dashboard] Recent Confirmed Revenue:`, {
      result: recentPaymentsSumRaw,
      sum: recentPaymentsSumRaw?.sum,
      recentConfirmedRevenue
    });

    // Payment trends: 13% of payments (last 6 months)
    const paymentTrendsRaw = await this.paymentsRepository
      .createQueryBuilder('payment')
      .select("TO_CHAR(payment.created_at, 'YYYY-MM')", 'period')
      .addSelect("TO_CHAR(payment.created_at, 'Mon YYYY')", 'label')
      .addSelect('COALESCE(SUM(payment.amount * :platformShare), 0)', 'sum')
      .where('(payment.status = :confirmed OR payment.status = :paid)', {
        confirmed: 'confirmed',
        paid: 'paid',
        platformShare: PLATFORM_SHARE
      })
      .andWhere('payment.created_at >= NOW() - INTERVAL \'6 months\'')
      .groupBy('period')
      .addGroupBy('label')
      .orderBy('period', 'ASC')
      .getRawMany();

    const paymentTrends = paymentTrendsRaw.map((row: any) => ({
      label: row.label || row.period,
      amount: Number((parseFloat(row.sum || '0') || 0).toFixed(2)),
    }));
    console.log(`[Dashboard] Payment Trends:`, paymentTrends);

    // University distribution: tutors vs tutees per university
    const tutorUniRaw = await this.tutorsRepository
      .createQueryBuilder('tutor')
      .select('tutor.university_id', 'university_id')
      .addSelect('COUNT(tutor.tutor_id)', 'tutors')
      .where('tutor.university_id IS NOT NULL')
      .andWhere('tutor.status = :status', { status: 'approved' })
      .groupBy('tutor.university_id')
      .getRawMany();

    const tuteeUniRaw = await this.studentsRepository
      .createQueryBuilder('student')
      .select('student.university_id', 'university_id')
      .addSelect('COUNT(student.student_id)', 'tutees')
      .where('student.university_id IS NOT NULL')
      .groupBy('student.university_id')
      .getRawMany();

    const uniIds = Array.from(new Set([
      ...tutorUniRaw.map((r: any) => Number(r.university_id)),
      ...tuteeUniRaw.map((r: any) => Number(r.university_id)),
    ].filter(Boolean)));
    const uniMap: Record<number, string> = {};
    if (uniIds.length) {
      const universities = await this.universitiesRepository.findByIds(uniIds);
      universities.forEach(u => { (uniMap as any)[(u as any).university_id] = (u as any).name; });
    }
    const uniAgg: Record<number, { university: string; tutors: number; tutees: number }> = {};
    tutorUniRaw.forEach((r: any) => {
      const id = Number(r.university_id);
      if (!id) return;
      uniAgg[id] = uniAgg[id] || { university: uniMap[id] || 'Unknown', tutors: 0, tutees: 0 };
      uniAgg[id].tutors = Number(r.tutors) || 0;
    });
    tuteeUniRaw.forEach((r: any) => {
      const id = Number(r.university_id);
      if (!id) return;
      uniAgg[id] = uniAgg[id] || { university: uniMap[id] || 'Unknown', tutors: 0, tutees: 0 };
      uniAgg[id].tutees = Number(r.tutees) || 0;
    });
    const universityDistribution = Object.values(uniAgg).sort((a, b) => (b.tutors + b.tutees) - (a.tutors + a.tutees));

    // Overall users by type (approved tutors only)
    const tutorsTotal = await this.tutorsRepository.count({ where: { status: 'approved' as any } });
    // Prefer counting active tutee users; fallback to students table if needed
    let tuteesTotal = await this.usersRepository.count({ where: { user_type: 'tutee' as any } });
    if (!tuteesTotal) {
      tuteesTotal = await this.studentsRepository.count();
    }
    const userTypeTotals = { tutors: tutorsTotal, tutees: tuteesTotal };

    // Course distribution: tutors vs tutees per course
    const tutorCourseRaw = await this.tutorsRepository
      .createQueryBuilder('tutor')
      .select('tutor.course_id', 'course_id')
      .addSelect('COUNT(tutor.tutor_id)', 'tutors')
      .where('tutor.course_id IS NOT NULL')
      .andWhere('tutor.status = :status', { status: 'approved' })
      .groupBy('tutor.course_id')
      .getRawMany();
    const tuteeCourseRaw = await this.studentsRepository
      .createQueryBuilder('student')
      .select('student.course_id', 'course_id')
      .addSelect('COUNT(student.student_id)', 'tutees')
      .where('student.course_id IS NOT NULL')
      .groupBy('student.course_id')
      .getRawMany();
    const courseIds = Array.from(new Set([
      ...tutorCourseRaw.map((r: any) => Number(r.course_id)),
      ...tuteeCourseRaw.map((r: any) => Number(r.course_id)),
    ].filter(Boolean)));
    const courseMap: Record<number, string> = {};
    if (courseIds.length) {
      const courses = await this.coursesRepository.findByIds(courseIds);
      courses.forEach(c => { (courseMap as any)[(c as any).course_id] = (c as any).course_name || (c as any).name; });
    }
    const courseAgg: Record<number, { courseName: string; tutors: number; tutees: number }> = {};
    tutorCourseRaw.forEach((r: any) => {
      const id = Number(r.course_id);
      if (!id) return;
      courseAgg[id] = courseAgg[id] || { courseName: courseMap[id] || 'Unknown', tutors: 0, tutees: 0 };
      courseAgg[id].tutors = Number(r.tutors) || 0;
    });
    tuteeCourseRaw.forEach((r: any) => {
      const id = Number(r.course_id);
      if (!id) return;
      courseAgg[id] = courseAgg[id] || { courseName: courseMap[id] || 'Unknown', tutors: 0, tutees: 0 };
      courseAgg[id].tutees = Number(r.tutees) || 0;
    });
    const courseDistribution = Object.values(courseAgg).sort((a, b) => (b.tutors + b.tutees) - (a.tutors + a.tutees));

    // Sessions per subject (from completed booking requests)
    // Use booking requests with status 'completed' or 'admin_payment_pending' to count sessions per subject
    const subjectSessionsRaw = await this.bookingRequestRepository
      .createQueryBuilder('booking')
      .select('booking.subject', 'subject')
      .addSelect('COUNT(booking.id)', 'sessions')
      .where('booking.status IN (:...statuses)', { statuses: ['completed', 'admin_payment_pending'] })
      .groupBy('booking.subject')
      .orderBy('sessions', 'DESC')
      .getRawMany();

    const subjectSessions = subjectSessionsRaw.map((r: any) => {
      const subjectName = r.subject || 'Unknown';
      return {
        subjectId: null, // Booking requests store subject as string, not ID
        subjectName: subjectName,
        sessions: Number(r.sessions) || 0,
      };
    }).filter(s => s.subjectName && s.subjectName !== 'Unknown'); // Filter out Unknown subjects

    return {
      totalUsers,
      totalTutors,
      pendingApplications,
      totalRevenue,
      confirmedSessions,
      mostInDemandSubjects,
      paymentOverview: {
        byStatus: paymentStatusCounts,
        recentConfirmedRevenue,
        trends: paymentTrends,
      },
      universityDistribution,
      userTypeTotals,
      courseDistribution,
      subjectSessions,
    };
  }
}
