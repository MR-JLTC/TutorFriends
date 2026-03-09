import React, { useEffect, useMemo, useState } from 'react';
import Card from '../ui/Card';
import apiClient from '../../services/api';
import { Users, UserCheck, FileText, CheckCircle2, TrendingUp, University, BarChart3, Layers, BookOpen, Info } from 'lucide-react';
import PesoSignIcon from '../icons/PesoSignIcon';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { Payment } from '../../types';

interface PaymentTrendPoint {
  label: string;
  amount: number;
}

interface Stats {
  totalUsers: number;
  totalTutors: number;
  pendingApplications: number;
  totalRevenue: number;
  confirmedSessions: number;
  mostInDemandSubjects: { subjectId: number; subjectName: string; sessions: number }[];
  paymentOverview: { byStatus: Record<string, number>; recentConfirmedRevenue: number; trends: PaymentTrendPoint[] };
}

// Helper function to format numbers with K/M suffixes for large values
const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    const millions = num / 1000000;
    return millions % 1 === 0
      ? `${millions.toFixed(0)}M`
      : `${millions.toFixed(1)}M`;
  } else if (num >= 1000) {
    const thousands = num / 1000;
    return thousands % 1 === 0
      ? `${thousands.toFixed(0)}K`
      : `${thousands.toFixed(1)}K`;
  }
  return num.toLocaleString('en-US');
};

const StatCard: React.FC<{ icon: React.ElementType, title: string, value: string | number, color: string, showActualValue?: boolean, className?: string }> = ({ icon: Icon, title, value, color, showActualValue = false, className = '' }) => {
  const isRevenue = typeof value === 'string' && value.includes('₱');

  // Format numeric values for better readability (unless showActualValue is true)
  let displayValue: string | number = value;
  if (typeof value === 'number' && !showActualValue) {
    displayValue = formatNumber(value);
  } else if (typeof value === 'number' && showActualValue) {
    displayValue = value.toLocaleString('en-US');
  }

  return (
    <Card className={`relative overflow-visible bg-white/80 backdrop-blur-md rounded-2xl shadow-sm border border-slate-200/60 hover:shadow-xl hover:-translate-y-1 hover:bg-white transition-all duration-300 group h-full flex flex-col ${className}`}>
      {/* Decorative gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-50/0 to-primary-100/0 group-hover:from-primary-50/30 group-hover:to-primary-100/20 transition-all duration-300 pointer-events-none"></div>

      <div className="relative p-4 sm:p-5 flex-1 flex flex-col min-w-0">
        <div className="flex items-start justify-between gap-3 mb-3 flex-shrink-0">
          <div className={`p-2.5 sm:p-3 rounded-xl flex-shrink-0 shadow-lg group-hover:shadow-xl transition-all duration-300 ${color}`}>
            <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          </div>
          {/* Optional badge or indicator */}
          <div className="flex-shrink-0">
            <div className="w-2 h-2 rounded-full bg-primary-400/50 group-hover:bg-primary-500 transition-colors"></div>
          </div>
        </div>

        <div className="space-y-1.5 min-w-0 w-full flex-1 flex flex-col justify-end">
          <p className="text-xs sm:text-sm font-semibold text-slate-500 uppercase tracking-wider leading-tight">
            {title}
          </p>
          {isRevenue ? (
            <div className="flex flex-col min-w-0 w-full">
              <p className="text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-extrabold text-slate-900 leading-tight break-words hyphens-auto">
                {value}
              </p>
              <p className="text-[10px] sm:text-xs text-slate-500 font-medium mt-0.5">
                Platform Fee
              </p>
            </div>
          ) : (
            <p className="text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-extrabold text-slate-900 leading-tight break-words hyphens-auto">
              {displayValue}
            </p>
          )}
        </div>
      </div>

      {/* Bottom accent bar */}
      <div className={`absolute bottom-0 left-0 right-0 h-1 ${color} opacity-60 group-hover:opacity-100 transition-opacity`}></div>
    </Card>
  );
}

import ErrorBoundary from '../ErrorBoundary';

const DashboardContent: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uniDistribution, setUniDistribution] = useState<{ university: string; tutors: number; tutees: number }[]>([]);
  const [userTypeTotals, setUserTypeTotals] = useState<{ tutors: number; tutees: number } | null>(null);
  const [courseDistribution, setCourseDistribution] = useState<{ courseName: string; tutors: number; tutees: number }[]>([]);
  const [subjectSessions, setSubjectSessions] = useState<{ subjectName: string; sessions: number }[]>([]);
  const [universityMap, setUniversityMap] = useState<Map<string, string>>(new Map());
  const [courseMap, setCourseMap] = useState<Map<string, string>>(new Map());
  const [payments, setPayments] = useState<Payment[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [monthsFilter, setMonthsFilter] = useState(6); // Default to 6 months

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get('/dashboard/stats');
        console.log('Dashboard stats response:', response.data);
        console.log('Total Revenue:', response.data?.totalRevenue);
        console.log('Payment Overview:', response.data?.paymentOverview);
        setStats(response.data);
      } catch (e) {
        setError('Failed to fetch dashboard statistics.');
        console.error('Dashboard fetch error:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);


  useEffect(() => {
    const fetchPayouts = async () => {
      try {
        const response = await apiClient.get('/payments/payouts');
        // Filter to only include payouts with status "released" that have a payment_id reference
        const releasedPayouts = (response.data || []).filter((payout: any) => {
          return payout.status === 'released' && payout.payment_id != null;
        });
        setPayouts(releasedPayouts);
      } catch (e) {
        console.error('Failed to fetch payouts:', e);
      }
    };
    fetchPayouts();
  }, []);

  // Fetch payments to get payment amounts for released payouts
  useEffect(() => {
    const fetchPaymentsForPayouts = async () => {
      try {
        const response = await apiClient.get('/payments');
        setPayments(response.data || []);
      } catch (e) {
        console.error('Failed to fetch payments:', e);
      }
    };
    fetchPaymentsForPayouts();
  }, []);


  useEffect(() => {
    // Fetch universities to get acronyms
    const fetchUniversities = async () => {
      try {
        const response = await apiClient.get('/universities');
        const universities = response.data || [];
        const map = new Map<string, string>();
        universities.forEach((uni: any) => {
          if (uni.name && uni.acronym) {
            map.set(uni.name, uni.acronym);
          }
        });
        setUniversityMap(map);
      } catch (e) {
        console.error('Failed to fetch universities:', e);
      }
    };
    fetchUniversities();
  }, []);

  useEffect(() => {
    // Fetch courses to get acronyms
    const fetchCourses = async () => {
      try {
        const response = await apiClient.get('/courses');
        const courses = response.data || [];
        const map = new Map<string, string>();
        courses.forEach((course: any) => {
          if (course.course_name && course.acronym) {
            map.set(course.course_name, course.acronym);
          }
        });
        setCourseMap(map);
      } catch (e) {
        console.error('Failed to fetch courses:', e);
      }
    };
    fetchCourses();
  }, []);

  useEffect(() => {
    // Prefer data embedded in /dashboard/stats if backend provides it
    if (!stats) return;
    const uniRows = (stats as any).universityDistribution || [];
    if (Array.isArray(uniRows)) {
      const normalized = uniRows.map((r: any) => ({
        university: r.university || r.name || r.university_name || 'Unknown',
        tutors: Number(r.tutors ?? r.numTutors ?? r.tutorCount ?? 0),
        tutees: Number(r.tutees ?? r.numTutees ?? r.tuteeCount ?? 0)
      }));
      setUniDistribution(normalized);
    } else {
      setUniDistribution([]);
    }

    const totals = (stats as any).userTypeTotals;
    if (totals && (typeof totals === 'object')) {
      setUserTypeTotals({ tutors: Number(totals.tutors ?? totals.numTutors ?? 0), tutees: Number(totals.tutees ?? totals.numTutees ?? 0) });
    } else {
      setUserTypeTotals(null);
    }

    const courseRows = (stats as any).courseDistribution || [];
    if (Array.isArray(courseRows)) {
      const normalizedCourses = courseRows.map((r: any) => ({
        courseName: r.courseName || r.course || r.name || 'Unknown',
        tutors: Number(r.tutors ?? r.numTutors ?? r.tutorCount ?? 0),
        tutees: Number(r.tutees ?? r.numTutees ?? r.tuteeCount ?? 0)
      }));
      setCourseDistribution(normalizedCourses);
    } else {
      setCourseDistribution([]);
    }

    const subjectRows = (stats as any).subjectSessions || (stats as any).mostInDemandSubjects || [];
    if (Array.isArray(subjectRows)) {
      console.log('Subject rows from backend:', subjectRows);
      const normalizedSubjects = subjectRows.map((r: any) => {
        // Try multiple possible field names to get the subject name
        const subjectName = r.subjectName || r.subject || r.subject_name || r.name || null;
        console.log('Processing subject row:', r, 'Extracted name:', subjectName);

        // If we still don't have a name, log it for debugging
        if (!subjectName || subjectName === 'Unknown') {
          console.warn('Subject name not found for row:', r);
        }

        return {
          subjectName: subjectName || 'Unknown',
          sessions: Number(r.sessions ?? r.count ?? r.sessionsCount ?? 0)
        };
      }).filter(s => s.subjectName && s.subjectName !== 'Unknown'); // Filter out Unknown subjects

      console.log('Normalized subjects:', normalizedSubjects);
      setSubjectSessions(normalizedSubjects);
    } else {
      setSubjectSessions([]);
    }
  }, [stats]);

  const maxUniRow = useMemo(() => {
    return uniDistribution.reduce((m, r) => Math.max(m, r.tutors + r.tutees), 0);
  }, [uniDistribution]);

  const maxCourseRow = useMemo(() => {
    return courseDistribution.reduce((m, r) => Math.max(m, r.tutors + r.tutees), 0);
  }, [courseDistribution]);

  const maxSubjectSessions = useMemo(() => {
    return subjectSessions.reduce((m, r) => Math.max(m, r.sessions), 0);
  }, [subjectSessions]);

  // Prepare chart data for payment trends
  const paymentChartData = useMemo(() => {
    if (!stats?.paymentOverview?.trends) return [];

    return stats.paymentOverview.trends.map((trend) => ({
      month: trend.label,
      'Platform Revenue': trend.amount
    }));
  }, [stats]);

  // Calculate most-in-demand subjects from payments
  const mostDemandedSubjects = useMemo(() => {
    const subjectCounts: Record<string, number> = {};
    payments.forEach(payment => {
      // Try multiple sources for subject name:
      // 1. payment.subject.subject_name (if subject relation is loaded)
      // 2. payment.bookingRequest.subject (if bookingRequest relation is loaded)
      // 3. payment.subject (if it's a string directly)
      let subjectName: string | null = null;

      if ((payment as any).subject) {
        if (typeof (payment as any).subject === 'string') {
          subjectName = (payment as any).subject;
        } else if ((payment as any).subject.subject_name) {
          subjectName = (payment as any).subject.subject_name;
        }
      }

      if (!subjectName && (payment as any).bookingRequest) {
        if (typeof (payment as any).bookingRequest === 'object' && (payment as any).bookingRequest.subject) {
          subjectName = (payment as any).bookingRequest.subject;
        }
      }

      // Only count if we have a valid subject name
      if (subjectName && subjectName.trim() !== '') {
        subjectCounts[subjectName] = (subjectCounts[subjectName] || 0) + 1;
      }
    });
    return Object.entries(subjectCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
  }, [payments]);

  // Calculate total revenue: payment amount - amount_released (for released payouts only)
  // This represents the 13% platform fee
  const calculatedTotalRevenue = useMemo(() => {
    if (!payouts || payouts.length === 0 || !payments || payments.length === 0) {
      return 0;
    }

    // Create a map of payment_id to payment amount for quick lookup
    const paymentMap = new Map<number, number>();
    payments.forEach((p: any) => {
      const paymentId = p.payment_id || p.id;
      if (paymentId) {
        paymentMap.set(Number(paymentId), Number(p.amount || 0));
      }
    });

    // Calculate total revenue: sum of (payment amount - amount_released) for all released payouts
    const totalRevenue = payouts.reduce((sum, payout: any) => {
      const paymentId = payout.payment_id || (payout.payment as any)?.payment_id;
      if (!paymentId) return sum;

      const paymentAmount = paymentMap.get(Number(paymentId)) || 0;
      const amountReleased = Number(payout.amount_released || 0);

      // Platform revenue = payment amount - amount released (13% of payment)
      const platformRevenue = paymentAmount - amountReleased;

      return sum + platformRevenue;
    }, 0);

    return Number(totalRevenue.toFixed(2));
  }, [payouts, payments]);


  // Calculate payment activity overview (from released payouts only)
  const paymentActivity = useMemo(() => {
    if (!payouts || payouts.length === 0 || !payments || payments.length === 0) {
      return {
        totalPayments: 0,
        pendingPayments: 0,
        confirmedPayments: 0,
        rejectedPayments: 0,
        totalAmount: 0,
        confirmedAmount: 0
      };
    }

    // Create a map of payment_id to payment amount for quick lookup
    const paymentMap = new Map<number, number>();
    payments.forEach((p: any) => {
      const paymentId = p.payment_id || p.id;
      if (paymentId) {
        paymentMap.set(Number(paymentId), Number(p.amount || 0));
      }
    });

    // Calculate platform revenue from released payouts: payment amount - amount_released
    const platformRevenue = payouts.reduce((sum, payout: any) => {
      const paymentId = payout.payment_id || (payout.payment as any)?.payment_id;
      if (!paymentId) return sum;

      const paymentAmount = paymentMap.get(Number(paymentId)) || 0;
      const amountReleased = Number(payout.amount_released || 0);

      // Platform revenue = payment amount - amount released (13% of payment)
      return sum + (paymentAmount - amountReleased);
    }, 0);

    const totalPayments = payments.length;
    const pendingPayments = payments.filter(p => p.status === 'pending').length;
    const confirmedPayments = payments.filter(p => p.status === 'confirmed').length;
    const rejectedPayments = payments.filter(p => p.status === 'rejected').length;

    return {
      totalPayments,
      pendingPayments,
      confirmedPayments,
      rejectedPayments,
      totalAmount: Number(platformRevenue.toFixed(2)),
      confirmedAmount: Number(platformRevenue.toFixed(2))
    };
  }, [payouts, payments]);

  // Calculate payment trends chart data (from released payouts only)
  const paymentTrendsData = useMemo(() => {
    if (!payouts || payouts.length === 0 || !payments || payments.length === 0) {
      const lastNMonths = Array.from({ length: monthsFilter }, (_, i) => {
        const date = new Date();
        date.setMonth(date.getMonth() - (monthsFilter - 1 - i));
        return {
          month: date.toLocaleDateString('en-US', { month: 'short' }),
          'Platform Revenue': 0
        };
      });
      return lastNMonths;
    }

    // Create a map of payment_id to payment amount for quick lookup
    const paymentMap = new Map<number, number>();
    payments.forEach((p: any) => {
      const paymentId = p.payment_id || p.id;
      if (paymentId) {
        paymentMap.set(Number(paymentId), Number(p.amount || 0));
      }
    });

    const lastNMonths = Array.from({ length: monthsFilter }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (monthsFilter - 1 - i));
      return {
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        monthIndex: date.getMonth(),
        year: date.getFullYear()
      };
    });

    return lastNMonths.map(({ month, monthIndex, year }) => {
      // Filter released payouts for this month
      const monthPayouts = payouts.filter((payout: any) => {
        if (!payout.created_at) return false;
        const payoutDate = new Date(payout.created_at);
        return payoutDate.getMonth() === monthIndex && payoutDate.getFullYear() === year;
      });

      // Calculate platform revenue: payment amount - amount_released for each payout
      const platformRevenue = monthPayouts.reduce((sum, payout: any) => {
        const paymentId = payout.payment_id || (payout.payment as any)?.payment_id;
        if (!paymentId) return sum;

        const paymentAmount = paymentMap.get(Number(paymentId)) || 0;
        const amountReleased = Number(payout.amount_released || 0);

        // Platform revenue = payment amount - amount released (13% of payment)
        return sum + (paymentAmount - amountReleased);
      }, 0);

      return {
        month,
        'Platform Revenue': Number(platformRevenue.toFixed(2))
      };
    });
  }, [payouts, payments, monthsFilter]);

  const tutorGradient = 'linear-gradient(90deg, #6366f1, #8b5cf6)';
  const tuteeGradient = 'linear-gradient(90deg, #06b6d4, #22d3ee)';
  const positiveGradient = 'linear-gradient(90deg, #10b981, #34d399)';
  const barBaseClass = 'h-3 transition-[width] duration-700 ease-out';
  const cardLegend = (
    <div className="flex items-center gap-3 text-xs text-slate-600">
      <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: tutorGradient }} /> Tutors</span>
      <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: tuteeGradient }} /> Tutees</span>
    </div>
  );

  // ---------- Pie/Donut chart utilities (pure SVG, no lib) ----------
  const PIE_COLORS = [
    '#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#22c55e', '#0ea5e9', '#f97316', '#a78bfa'
  ];

  const buildTopN = <T,>(rows: T[], getLabel: (r: T) => string, getValue: (r: T) => number, topN = 6) => {
    const sorted = [...rows].sort((a, b) => getValue(b) - getValue(a));
    const top = sorted.slice(0, topN);
    const rest = sorted.slice(topN);
    const otherSum = rest.reduce((s, r) => s + getValue(r), 0);
    const items = top.map((r, i) => ({ label: getLabel(r), value: Math.max(0, getValue(r)), color: PIE_COLORS[i % PIE_COLORS.length] }));
    if (otherSum > 0) items.push({ label: 'Other', value: otherSum, color: '#cbd5e1' });
    const total = items.reduce((s, it) => s + it.value, 0) || 1;
    return { items, total };
  };

  const Donut: React.FC<{ items: { label: string; value: number; color: string }[]; size?: number; thickness?: number; total?: number; centerLabel?: string; centerSub?: string }>
    = ({ items, size = 200, thickness = 20, total, centerLabel, centerSub }) => {
      const r = (size / 2) - thickness / 2;
      const C = size / 2;
      const circumference = 2 * Math.PI * r;
      const sum = (total ?? items.reduce((s, x) => s + x.value, 0)) || 1;
      let offset = 0;
      const segments = items.map((it, idx) => {
        const frac = it.value / sum;
        const len = circumference * frac;
        const seg = (
          <circle
            key={idx}
            cx={C}
            cy={C}
            r={r}
            fill="transparent"
            stroke={it.color}
            strokeWidth={thickness}
            strokeDasharray={`${len} ${circumference - len}`}
            strokeDashoffset={-offset}
            strokeLinecap="butt"
            style={{ transition: 'stroke-dashoffset 700ms ease-out' }}
          />
        );
        offset += len;
        return seg;
      });
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <defs>
            <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#0f172a" floodOpacity="0.15" />
            </filter>
          </defs>
          <circle cx={C} cy={C} r={r} fill="transparent" stroke="#e2e8f0" strokeWidth={thickness} filter="url(#softShadow)" />
          {segments}
          {(centerLabel || centerSub) && (
            <>
              {centerLabel && (
                <text x={C} y={C} textAnchor="middle" dominantBaseline="central" fontSize={16} fontWeight={700} fill="#0f172a">
                  {centerLabel}
                </text>
              )}
              {centerSub && (
                <text x={C} y={C + 16} textAnchor="middle" dominantBaseline="hanging" fontSize={11} fill="#475569">
                  {centerSub}
                </text>
              )}
            </>
          )}
        </svg>
      );
    };

  if (loading) return <div>Loading dashboard...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="-mt-2 sm:-mt-4 lg:-mt-5 bg-sky-600 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 text-white shadow-xl relative overflow-hidden -mx-2 sm:-mx-3 md:mx-0 border border-primary-500/30">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full -mr-20 -mt-20 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full -ml-16 -mb-16 blur-3xl"></div>
        </div>
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="min-w-0 flex-1 flex items-center gap-2 bg-white/10 p-1.5 sm:p-2 rounded-lg backdrop-blur-md border border-white/20 shadow-inner">
            <div className="p-1 bg-white/20 rounded-md shadow-sm shrink-0">
              <Info className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-white drop-shadow-md" />
            </div>
            <p className="text-xs sm:text-sm md:text-base text-white font-medium leading-snug tracking-wide text-shadow-sm">
              Overview of platform statistics and revenue
            </p>
          </div>
        </div>
      </div>

      {stats && (
        <Card className="relative overflow-hidden bg-white/90 backdrop-blur-xl rounded-2xl border border-slate-200/60 shadow-sm mt-2">
          {/* Top colored accent bar */}
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-400 via-indigo-500 to-emerald-500 rounded-t-2xl"></div>
          {/* Decorative background glow */}
          <div className="absolute top-0 right-0 w-72 h-72 bg-indigo-100/40 rounded-full -mr-36 -mt-36 blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-100/30 rounded-full -ml-24 -mb-24 blur-3xl pointer-events-none"></div>

          <div className="relative p-4 sm:p-6 md:p-8 w-full flex flex-col">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6 sm:mb-8 lg:mb-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-primary-700 rounded-xl shadow-lg shadow-indigo-500/20 ring-1 ring-indigo-400/30">
                  <BarChart3 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg md:text-xl font-bold text-slate-800 tracking-tight">Platform Performance Pipeline</h2>
                  <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5">Unified view of your core platform metrics</p>
                </div>
              </div>
            </div>

            {/* Desktop Connecting Line */}
            <div className="relative w-full">
              <div className="hidden lg:block absolute top-[32px] left-[10%] right-[10%] h-[2px] rounded-full overflow-hidden z-0">
                <div className="w-full h-full bg-gradient-to-r from-sky-300 via-indigo-300 to-emerald-300 opacity-50"></div>
              </div>

              {/* Stats Grid — fully responsive */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 relative z-10">

                {/* Node 1: Users */}
                <div className="group relative flex flex-row sm:flex-col items-center sm:items-center gap-4 sm:gap-0 p-4 sm:p-5 rounded-xl bg-gradient-to-br from-sky-50/80 to-white border border-sky-100/80 hover:border-sky-200 hover:shadow-md hover:shadow-sky-500/5 transition-all duration-300">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-sky-600 text-white flex items-center justify-center sm:mb-3.5 shadow-lg shadow-sky-500/25 group-hover:-translate-y-1 transition-transform duration-300 ring-2 ring-sky-400/20 flex-shrink-0">
                    <Users className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="flex flex-col sm:items-center">
                    <p className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-800 tracking-tight group-hover:text-sky-600 transition-colors tabular-nums">{formatNumber(stats.totalUsers)}</p>
                    <p className="text-[10px] sm:text-[10px] lg:text-xs font-bold text-slate-400 uppercase tracking-[0.1em] mt-0.5 sm:mt-1 sm:text-center">Total Users</p>
                  </div>
                </div>

                {/* Node 2: Tutors */}
                <div className="group relative flex flex-row sm:flex-col items-center sm:items-center gap-4 sm:gap-0 p-4 sm:p-5 rounded-xl bg-gradient-to-br from-indigo-50/80 to-white border border-indigo-100/80 hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-500/5 transition-all duration-300">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white flex items-center justify-center sm:mb-3.5 shadow-lg shadow-indigo-500/25 group-hover:-translate-y-1 transition-transform duration-300 ring-2 ring-indigo-400/20 flex-shrink-0">
                    <UserCheck className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="flex flex-col sm:items-center">
                    <p className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-800 tracking-tight group-hover:text-indigo-600 transition-colors tabular-nums">{formatNumber(stats.totalTutors)}</p>
                    <p className="text-[10px] sm:text-[10px] lg:text-xs font-bold text-slate-400 uppercase tracking-[0.1em] mt-0.5 sm:mt-1 sm:text-center">Verified Tutors</p>
                  </div>
                </div>

                {/* Node 3: Pending Applications */}
                <div className="group relative flex flex-row sm:flex-col items-center sm:items-center gap-4 sm:gap-0 p-4 sm:p-5 rounded-xl bg-gradient-to-br from-amber-50/80 to-white border border-amber-100/80 hover:border-amber-200 hover:shadow-md hover:shadow-amber-500/5 transition-all duration-300">
                  <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center sm:mb-3.5 shadow-lg shadow-amber-500/25 group-hover:-translate-y-1 transition-transform duration-300 ring-2 ring-amber-400/20 flex-shrink-0">
                    {stats.pendingApplications > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500 border-2 border-white"></span>
                      </span>
                    )}
                    <FileText className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="flex flex-col sm:items-center">
                    <p className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-800 tracking-tight group-hover:text-amber-600 transition-colors tabular-nums">{stats.pendingApplications.toLocaleString('en-US')}</p>
                    <p className="text-[10px] sm:text-[10px] lg:text-xs font-bold text-slate-400 uppercase tracking-[0.1em] mt-0.5 sm:mt-1 sm:text-center">Pending Apps</p>
                  </div>
                </div>

                {/* Node 4: Sessions */}
                <div className="group relative flex flex-row sm:flex-col items-center sm:items-center gap-4 sm:gap-0 p-4 sm:p-5 rounded-xl bg-gradient-to-br from-teal-50/80 to-white border border-teal-100/80 hover:border-teal-200 hover:shadow-md hover:shadow-teal-500/5 transition-all duration-300">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 text-white flex items-center justify-center sm:mb-3.5 shadow-lg shadow-teal-500/25 group-hover:-translate-y-1 transition-transform duration-300 ring-2 ring-teal-400/20 flex-shrink-0">
                    <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="flex flex-col sm:items-center">
                    <p className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-800 tracking-tight group-hover:text-teal-600 transition-colors tabular-nums">{stats.confirmedSessions ?? 0}</p>
                    <p className="text-[10px] sm:text-[10px] lg:text-xs font-bold text-slate-400 uppercase tracking-[0.1em] mt-0.5 sm:mt-1 sm:text-center">Sessions</p>
                  </div>
                </div>

                {/* Node 5: Revenue */}
                <div className="group relative flex flex-row sm:flex-col items-center sm:items-center gap-4 sm:gap-0 p-4 sm:p-5 rounded-xl bg-gradient-to-br from-emerald-50/80 to-white border border-emerald-100/80 hover:border-emerald-200 hover:shadow-md hover:shadow-emerald-500/5 transition-all duration-300 sm:col-span-2 md:col-span-1">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center sm:mb-3.5 shadow-lg shadow-emerald-500/25 group-hover:-translate-y-1 transition-transform duration-300 ring-2 ring-emerald-400/20 flex-shrink-0">
                    <PesoSignIcon className="h-6 w-6 sm:h-7 sm:w-7" />
                  </div>
                  <div className="flex flex-col sm:items-center">
                    <p className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-800 tracking-tight group-hover:text-emerald-600 transition-colors tabular-nums">
                      <span className="text-lg sm:text-xl lg:text-2xl text-slate-400 font-semibold mr-0.5">₱</span>
                      {calculatedTotalRevenue >= 1000000
                        ? (calculatedTotalRevenue / 1000000).toFixed(2) + 'M'
                        : calculatedTotalRevenue >= 1000
                          ? (calculatedTotalRevenue / 1000).toFixed(1) + 'k'
                          : calculatedTotalRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-[10px] sm:text-[10px] lg:text-xs font-bold text-slate-400 uppercase tracking-[0.1em] mt-0.5 sm:mt-1 sm:text-center">Platform Revenue</p>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Most-in-Demand Subjects and Payment Activity Overview */}
      <div className="mt-6 sm:mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Most-in-Demand Subjects */}
        <Card className="p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl shadow-lg">
              <BookOpen className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800">Most-in-Demand Subjects</h2>
          </div>
          <div className="space-y-3">
            {mostDemandedSubjects.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">No subject data available</p>
            ) : (
              mostDemandedSubjects.map(([subject, count], index) => (
                <div key={subject} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-100 text-primary-700 font-bold text-sm">
                      {index + 1}
                    </div>
                    <span className="font-medium text-slate-900">{subject}</span>
                  </div>
                  <span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-semibold">
                    {count} {count === 1 ? 'payment' : 'payments'}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Payment Activity Overview */}
        <Card className="p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl shadow-lg">
              <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-800">Platform Revenue Overview (From Released Payouts)</h2>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs text-blue-600 font-semibold mb-1">Total Payments</p>
                <p className="text-lg sm:text-xl font-bold text-blue-900">{paymentActivity.totalPayments}</p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="text-xs text-yellow-600 font-semibold mb-1">Pending</p>
                <p className="text-lg sm:text-xl font-bold text-yellow-900">{paymentActivity.pendingPayments}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-xs text-green-600 font-semibold mb-1">Confirmed</p>
                <p className="text-lg sm:text-xl font-bold text-green-900">{paymentActivity.confirmedPayments}</p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                <p className="text-xs text-red-600 font-semibold mb-1">Rejected</p>
                <p className="text-lg sm:text-xl font-bold text-red-900">{paymentActivity.rejectedPayments}</p>
              </div>
            </div>
            <div className="pt-3 border-t border-slate-200">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-600">Platform Revenue (From Released Payouts)</span>
                <span className="text-base sm:text-lg font-bold text-slate-900">₱{paymentActivity.confirmedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Released Payouts Revenue</span>
                <span className="text-base sm:text-lg font-bold text-green-700">₱{paymentActivity.confirmedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Payment Trends */}
      <Card className="mt-4 sm:mt-6 mb-4 sm:mb-6 p-4 sm:p-6 relative overflow-hidden">
        {/* Decorative top accent bar */}
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-primary-500 rounded-t-xl"></div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-5 pt-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-700 rounded-xl shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-400/30">
              <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">Platform Revenue Trends</h2>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5">Monthly revenue from released payouts</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-full px-3 py-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500"></div>
              <span className="text-[11px] sm:text-xs text-slate-600 font-semibold tracking-wide">Revenue</span>
            </div>
            <select
              id="months-filter"
              value={monthsFilter}
              onChange={(e) => setMonthsFilter(Number(e.target.value))}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all shadow-sm cursor-pointer"
            >
              <option value={3}>3 Months</option>
              <option value={6}>6 Months</option>
              <option value={12}>12 Months</option>
            </select>
          </div>
        </div>
        <div className="bg-gradient-to-b from-slate-50/50 to-white rounded-xl border border-slate-100 p-2 sm:p-3">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={paymentTrendsData} margin={{ top: 20, right: 15, left: 5, bottom: 5 }}>
              <defs>
                <linearGradient id="revenueBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.65} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: '#64748b', fontWeight: 500 }}
                stroke="#e2e8f0"
                axisLine={{ strokeWidth: 1 }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 500 }}
                stroke="#e2e8f0"
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                cursor={{ fill: 'rgba(16, 185, 129, 0.06)', radius: 6 }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0];
                    return (
                      <div className="bg-white/95 backdrop-blur-md p-3.5 rounded-xl shadow-xl border border-slate-200/60 min-w-[160px]">
                        <p className="font-semibold text-slate-800 text-sm mb-2">{payload[0].payload.month}</p>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                          <span className="text-xs text-slate-500 font-medium">Revenue</span>
                          <span className="text-sm font-bold text-emerald-700">₱{(data.value as number)?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar
                dataKey="Platform Revenue"
                fill="url(#revenueBarGrad)"
                radius={[6, 6, 0, 0]}
                maxBarSize={52}
                label={({ x, y, width, value }: any) => {
                  if (!value) return null;
                  return (
                    <text
                      x={x + width / 2}
                      y={y - 8}
                      textAnchor="middle"
                      fontSize={9}
                      fontWeight={700}
                      fill="#10b981"
                    >
                      ₱{value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
                    </text>
                  );
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* University distribution: tutors vs tutees */}
      <div className="mt-6 sm:mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <h2 className="text-lg sm:text-xl font-semibold truncate">Top Universities (Total Users)</h2>
            </div>
            <University className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400 flex-shrink-0" />
          </div>
          {uniDistribution.length > 0 ? (
            (() => {
              // Build items with acronyms included in labels
              const itemsWithAcronyms = uniDistribution
                .map(r => {
                  const acronym = universityMap.get(r.university);
                  const displayLabel = acronym ? `${r.university} (${acronym})` : r.university;
                  return {
                    ...r,
                    displayLabel,
                    value: r.tutors + r.tutees
                  };
                })
                .sort((a, b) => b.value - a.value)
                .slice(0, 6);

              const total = itemsWithAcronyms.reduce((sum, r) => sum + r.value, 0);
              const colors = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
              const items = itemsWithAcronyms.map((r, i) => ({
                label: r.displayLabel,
                value: r.value,
                color: colors[i % colors.length]
              }));

              return (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                  <div className="flex-shrink-0 mx-auto sm:mx-0">
                    <Donut items={items} size={180} centerLabel={String(total)} centerSub={'Total Users'} />
                  </div>
                  <div className="w-full sm:flex-1 space-y-2 min-w-0">
                    {items.map((it, i) => (
                      <div key={i} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 sm:py-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="inline-block h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: it.color }} />
                          <span className="text-sm text-slate-900 font-medium break-words" title={it.label}>{it.label}</span>
                        </div>
                        <div className="flex items-center justify-end sm:justify-start gap-1.5 sm:ml-auto flex-shrink-0">
                          <span className="text-sm sm:text-base text-slate-700 font-semibold whitespace-nowrap">{it.value}</span>
                          <span className="text-xs sm:text-sm text-slate-400 font-normal whitespace-nowrap">({Math.round((it.value / (total || 1)) * 100)}%)</span>
                        </div>
                      </div>
                    ))}
                    <p className="text-xs text-slate-500 pt-1">Total: {total}</p>
                  </div>
                </div>
              );
            })()
          ) : (
            <p className="text-slate-500">No university distribution data.</p>
          )}
        </Card>

        {/* Overall user type totals */}
        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-lg sm:text-xl font-semibold">Overall Users by Type</h2>
            <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400 flex-shrink-0" />
          </div>
          {userTypeTotals ? (
            (() => {
              const items = [
                { label: 'Approved Tutors', value: userTypeTotals.tutors, color: '#6366f1' },
                { label: 'Tutees', value: userTypeTotals.tutees, color: '#06b6d4' },
              ];
              const total = Math.max(1, items[0].value + items[1].value);
              return (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                  <div className="flex-shrink-0 mx-auto sm:mx-0">
                    <Donut items={items} size={180} centerLabel={String(total)} centerSub={'Users'} />
                  </div>
                  <div className="w-full sm:flex-1 space-y-2 min-w-0">
                    {items.map((it, i) => (
                      <div key={i} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 sm:py-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="inline-block h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: it.color }} />
                          <span className="text-sm text-slate-900 font-medium">{it.label}</span>
                        </div>
                        <div className="flex items-center justify-end sm:justify-start gap-1.5 sm:ml-auto flex-shrink-0">
                          <span className="text-sm sm:text-base text-slate-700 font-semibold whitespace-nowrap">{it.value}</span>
                          <span className="text-xs sm:text-sm text-slate-400 font-normal whitespace-nowrap">({Math.round((it.value / total) * 100)}%)</span>
                        </div>
                      </div>
                    ))}
                    <p className="text-xs text-slate-500 pt-1">Total: {total}</p>
                  </div>
                </div>
              );
            })()
          ) : (
            <p className="text-slate-500">No user totals available.</p>
          )}
        </Card>
      </div>

      {/* Courses and Sessions Charts - Separated */}
      <div className="mt-6 sm:mt-8 grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        {/* Top Courses Chart */}
        <Card className="p-4 sm:p-6 relative overflow-hidden">
          {/* Decorative top accent bar */}
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-primary-500 to-violet-500 rounded-t-xl"></div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5 sm:mb-7 pt-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-primary-700 rounded-xl shadow-lg shadow-indigo-500/20 ring-1 ring-indigo-400/30">
                <Layers className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">Top Courses</h2>
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5">Ranked by total enrolled users</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-full px-3 py-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500"></div>
              <span className="text-[11px] sm:text-xs text-slate-600 font-semibold tracking-wide">Total Users</span>
            </div>
          </div>

          {(() => {
            // Aggregate courses with the same name
            const aggregatedCourses = courseDistribution.reduce((acc, course) => {
              const courseName = course.courseName || 'Unknown';
              if (!acc[courseName]) {
                acc[courseName] = {
                  courseName: courseName,
                  tutors: 0,
                  tutees: 0
                };
              }
              acc[courseName].tutors += course.tutors || 0;
              acc[courseName].tutees += course.tutees || 0;
              return acc;
            }, {} as Record<string, { courseName: string; tutors: number; tutees: number }>);

            const aggregatedArray = Object.values(aggregatedCourses);
            const topCourses = buildTopN(aggregatedArray, (r: any) => r.courseName, (r: any) => (r.tutors + r.tutees), 10);

            if (topCourses.items.length === 0 || topCourses.total === 0) {
              return (
                <div className="text-center py-16">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100 mb-4">
                    <Layers className="h-6 w-6 text-slate-400" />
                  </div>
                  <p className="text-slate-500 font-medium">No course distribution data available.</p>
                  <p className="text-xs text-slate-400 mt-1">Data will appear once courses have enrolled users.</p>
                </div>
              );
            }

            // Gradient palettes for the bars
            const barGradients = [
              'linear-gradient(90deg, #6366f1, #818cf8)',
              'linear-gradient(90deg, #7c3aed, #a78bfa)',
              'linear-gradient(90deg, #8b5cf6, #c4b5fd)',
              'linear-gradient(90deg, #6366f1, #93c5fd)',
              'linear-gradient(90deg, #7c3aed, #c084fc)',
              'linear-gradient(90deg, #6d83f2, #a5b4fc)',
              'linear-gradient(90deg, #818cf8, #c7d2fe)',
              'linear-gradient(90deg, #7e8ce6, #bfdbfe)',
              'linear-gradient(90deg, #8e96da, #cbd5e1)',
              'linear-gradient(90deg, #9ea5d1, #e2e8f0)',
            ];

            // Medal colors for top 3
            const medalColors = ['#f59e0b', '#94a3b8', '#cd7f32'];

            const maxValue = Math.max(...topCourses.items.map(i => i.value));

            const chartData = topCourses.items.map((item, idx) => {
              const courseName = item.label;
              const acronym = courseMap.get(courseName) || courseName;
              const pct = Math.round((item.value / topCourses.total) * 100);
              return {
                name: acronym.length > 25 ? acronym.substring(0, 25) + '...' : acronym,
                fullName: courseName,
                value: item.value,
                gradient: barGradients[idx % barGradients.length],
                rank: idx + 1,
                pct,
                barWidth: Math.max(8, (item.value / maxValue) * 100),
              };
            });

            return (
              <div className="w-full">
                {/* Horizontal leaderboard-style chart */}
                <div className="space-y-2.5">
                  {chartData.map((item, idx) => (
                    <div
                      key={idx}
                      className="group relative flex items-center gap-3 sm:gap-4 p-2.5 sm:p-3 rounded-xl border border-slate-100 bg-white hover:bg-slate-50/80 hover:border-slate-200 hover:shadow-sm transition-all duration-200"
                    >
                      {/* Rank badge */}
                      <div className="flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg font-bold text-xs sm:text-sm"
                        style={
                          item.rank <= 3
                            ? { background: `linear-gradient(135deg, ${medalColors[item.rank - 1]}, ${medalColors[item.rank - 1]}dd)`, color: 'white', boxShadow: `0 2px 8px ${medalColors[item.rank - 1]}40` }
                            : { background: '#f1f5f9', color: '#64748b' }
                        }
                      >
                        {item.rank <= 3 ? (
                          <span className="drop-shadow-sm">{item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : '🥉'}</span>
                        ) : (
                          <span>#{item.rank}</span>
                        )}
                      </div>

                      {/* Course info & bar */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-xs sm:text-sm font-semibold text-slate-800 truncate pr-2" title={item.fullName}>
                            {item.name}
                          </p>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs font-semibold text-slate-400">{item.pct}%</span>
                            <span className="text-xs sm:text-sm font-bold text-slate-800 tabular-nums">{item.value.toLocaleString()}</span>
                          </div>
                        </div>
                        {/* Progress bar */}
                        <div className="relative h-2.5 sm:h-3 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out group-hover:brightness-110"
                            style={{
                              width: `${item.barWidth}%`,
                              background: item.gradient,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Summary Stat Footer */}
                <div className="mt-5 pt-4 border-t border-slate-200/80">
                  <div className="relative overflow-hidden bg-gradient-to-br from-primary-50 via-indigo-50/80 to-violet-50/60 rounded-xl p-4 sm:p-5 border border-primary-200/60 shadow-sm">
                    {/* Decorative background circles */}
                    <div className="absolute -top-6 -right-6 w-24 h-24 bg-primary-200/30 rounded-full blur-2xl pointer-events-none"></div>
                    <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-violet-200/30 rounded-full blur-2xl pointer-events-none"></div>
                    <div className="relative flex items-center justify-between">
                      <div>
                        <p className="text-[10px] sm:text-xs font-bold text-primary-600/80 uppercase tracking-[0.12em] mb-1.5">
                          Total Course Users
                        </p>
                        <p className="text-2xl sm:text-3xl font-extrabold text-primary-900 tracking-tight">
                          {formatNumber(topCourses.total)}
                        </p>
                      </div>
                      <div className="p-2.5 bg-white/60 rounded-xl border border-primary-200/40 shadow-sm">
                        <Layers className="h-7 w-7 sm:h-8 sm:w-8 text-primary-500/70" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </Card>

        {/* Sessions per Subject Chart */}
        <Card className="p-4 sm:p-6 relative overflow-hidden">
          {/* Decorative top accent bar */}
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-500 via-primary-500 to-cyan-500 rounded-t-xl"></div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5 sm:mb-7 pt-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-teal-500 to-primary-700 rounded-xl shadow-lg shadow-teal-500/20 ring-1 ring-teal-400/30">
                <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">Sessions per Subject</h2>
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5">Ranked by confirmed session count</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-full px-3 py-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-teal-500 to-primary-600"></div>
              <span className="text-[11px] sm:text-xs text-slate-600 font-semibold tracking-wide">Sessions</span>
            </div>
          </div>

          {(() => {
            const topSubjects = buildTopN(subjectSessions, (r: any) => r.subjectName, (r: any) => r.sessions, 10);

            if (topSubjects.items.length === 0 || topSubjects.total === 0) {
              return (
                <div className="text-center py-16">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100 mb-4">
                    <TrendingUp className="h-6 w-6 text-slate-400" />
                  </div>
                  <p className="text-slate-500 font-medium">No subject sessions data available.</p>
                  <p className="text-xs text-slate-400 mt-1">Data will appear once sessions are confirmed.</p>
                </div>
              );
            }

            // Rank-based color palette for bars
            const subjectBarColors = [
              '#0d9488', '#0891b2', '#0ea5e9', '#6366f1', '#8b5cf6',
              '#14b8a6', '#22d3ee', '#38bdf8', '#818cf8', '#a78bfa'
            ];

            const chartData = topSubjects.items.map((item, idx) => ({
              name: item.label.length > 20 ? item.label.substring(0, 20) + '...' : item.label,
              fullName: item.label,
              value: item.value,
              fill: subjectBarColors[idx % subjectBarColors.length],
              rank: idx + 1,
            }));

            return (
              <div className="w-full">
                {/* Chart container with subtle background */}
                <div className="bg-gradient-to-b from-slate-50/50 to-white rounded-xl border border-slate-100 p-2 sm:p-3">
                  <ResponsiveContainer width="100%" height={360}>
                    <BarChart
                      data={chartData}
                      margin={{ top: 30, right: 20, left: 10, bottom: 60 }}
                    >
                      <defs>
                        {chartData.map((entry, index) => (
                          <linearGradient key={`sgrad-${index}`} id={`subjectBarGrad-${index}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={entry.fill} stopOpacity={1} />
                            <stop offset="100%" stopColor={entry.fill} stopOpacity={0.7} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis
                        dataKey="name"
                        angle={-45}
                        textAnchor="end"
                        height={100}
                        tick={{ fontSize: 10, fill: '#64748b', fontWeight: 500 }}
                        stroke="#e2e8f0"
                        axisLine={{ strokeWidth: 1 }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 500 }}
                        stroke="#e2e8f0"
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => formatNumber(value)}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(13, 148, 136, 0.06)', radius: 6 }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white/95 backdrop-blur-md p-3.5 rounded-xl shadow-xl border border-slate-200/60 min-w-[180px]">
                                <div className="flex items-center gap-2 mb-2.5">
                                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-md text-[10px] font-bold text-white" style={{ backgroundColor: data.fill }}>
                                    {data.rank}
                                  </span>
                                  <p className="font-semibold text-slate-800 text-sm leading-tight">{data.fullName}</p>
                                </div>
                                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                  <span className="text-xs text-slate-500 font-medium">Sessions</span>
                                  <span className="text-sm font-bold text-slate-900">{data.value?.toLocaleString()}</span>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar
                        dataKey="value"
                        name="Sessions"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={52}
                        label={({ x, y, width, index }: any) => {
                          const rank = chartData[index]?.rank;
                          if (!rank) return null;
                          return (
                            <text
                              x={x + width / 2}
                              y={y - 8}
                              textAnchor="middle"
                              fontSize={9}
                              fontWeight={700}
                              fill="#0d9488"
                            >
                              #{rank}
                            </text>
                          );
                        }}
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={`url(#subjectBarGrad-${index})`} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Summary Stat Footer */}
                <div className="mt-5 pt-4 border-t border-slate-200/80">
                  <div className="relative overflow-hidden bg-gradient-to-br from-teal-50 via-primary-50/80 to-cyan-50/60 rounded-xl p-4 sm:p-5 border border-teal-200/60 shadow-sm">
                    {/* Decorative background circles */}
                    <div className="absolute -top-6 -right-6 w-24 h-24 bg-teal-200/30 rounded-full blur-2xl pointer-events-none"></div>
                    <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-cyan-200/30 rounded-full blur-2xl pointer-events-none"></div>
                    <div className="relative flex items-center justify-between">
                      <div>
                        <p className="text-[10px] sm:text-xs font-bold text-teal-600/80 uppercase tracking-[0.12em] mb-1.5">
                          Total Sessions
                        </p>
                        <p className="text-2xl sm:text-3xl font-extrabold text-teal-900 tracking-tight">
                          {formatNumber(topSubjects.total)}
                        </p>
                      </div>
                      <div className="p-2.5 bg-white/60 rounded-xl border border-teal-200/40 shadow-sm">
                        <TrendingUp className="h-7 w-7 sm:h-8 sm:w-8 text-teal-500/70" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </Card>
      </div>
    </div>
  );
};

const Dashboard: React.FC = () => {
  return (
    <ErrorBoundary>
      <DashboardContent />
    </ErrorBoundary>
  );
};

export default Dashboard;
