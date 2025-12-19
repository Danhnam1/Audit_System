import React, { useState, useEffect } from 'react';
import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { BarChartCard } from '../../../components/charts/BarChartCard';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import axios from 'axios';
import { createPortal } from 'react-dom';
// Department bar data
const barData = [
  { department: 'HR', Findings: 18, 'Finding Open': 15, 'Finding Closed': 8 },
  { department: 'IT', Findings: 3, 'Finding Open': 8, 'Finding Closed': 4 },
  { department: 'Finance', Findings: 60, 'Finding Open': 45, 'Finding Closed': 55 },
  { department: 'Marketing', Findings: 8, 'Finding Open': 12, 'Finding Closed': 10 },
  { department: 'Sales', Findings: 28, 'Finding Open': 24, 'Finding Closed': 22 },
  { department: 'Operations', Findings: 20, 'Finding Open': 14, 'Finding Closed': 18 },
  { department: 'Legal', Findings: 24, 'Finding Open': 38, 'Finding Closed': 34 },
  { department: 'Compliance', Findings: 12, 'Finding Open': 8, 'Finding Closed': 6 },
  { department: 'Quality', Findings: 30, 'Finding Open': 24, 'Finding Closed': 28 },
];

const orderStatusData = [
  { name: 'Sales', value: 68, color: '#0284c7' },
  { name: 'Product', value: 25, color: '#ff6b6b' },
  { name: 'Income', value: 14, color: '#10b981' },
];

const monthlyPie = [
  { name: 'Monthly', value: 65127, color: '#1e90ff' },
];

const yearlyPie = [
  { name: 'Yearly', value: 984246, color: '#fbbf24' },
];

const monthlyData = [
  { name: 'Monday', value: 18 },
  { name: 'Tuesday', value: 24 },
  { name: 'Wednesday', value: 32 },
  { name: 'Thursday', value: 28 },
  { name: 'Friday', value: 22 },
  { name: 'Saturday', value: 19 },
  { name: 'Sunday', value: 15 },
];

const radarData = [
  { subject: 'Completeness', A: 85 },
  { subject: 'Timeliness', A: 72 },
  { subject: 'Accuracy', A: 88 },
  { subject: 'Coverage', A: 70 },
  { subject: 'Responsiveness', A: 78 },
];

const RadarSummary: React.FC = () => {
  const [audits, setAudits] = useState<any[]>([]);
  const [audit1Id, setAudit1Id] = useState<string>('');
  const [audit2Id, setAudit2Id] = useState<string>('');
  const [audit1Data, setAudit1Data] = useState<any>(null);
  const [audit2Data, setAudit2Data] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingAudits, setLoadingAudits] = useState<boolean>(false);

  // Load audits list
  useEffect(() => {
    const fetchAudits = async () => {
      setLoadingAudits(true);
      try {
        const response = await axios.get('https://moca.mom/api/Audits');
        const data = response.data || {};
        const auditsList = (data.$values && data.$values) || (Array.isArray(data) ? data : []);
        setAudits(auditsList);
      } catch (error) {
        console.error('Failed to fetch audits:', error);
        setAudits([]);
      } finally {
        setLoadingAudits(false);
      }
    };
    fetchAudits();
  }, []);

  // Load comparison data when both audits are selected
  useEffect(() => {
    const loadComparisonData = async () => {
      if (!audit1Id || !audit2Id) {
        setAudit1Data(null);
        setAudit2Data(null);
        return;
      }

      setLoading(true);
      try {
        const response = await axios.get(
          `https://moca.mom/api/AuditDashboard/audits/comparison-statistics?auditId1=${audit1Id}&auditId2=${audit2Id}`
        );
        
        const data = response.data || {};
        
        // Extract statistics for audit 1
        if (data.statistics1) {
          setAudit1Data({
            totalFindings: data.statistics1.totalFindings || 0,
            closedFindings: data.statistics1.findingsClosed || 0,
            totalActions: data.statistics1.totalActions || 0,
            completedActions: data.statistics1.actionsComplete || 0,
            overdueActions: data.statistics1.actionsOverdue || 0,
            title: data.auditTitle1 || '',
          });
        } else {
          setAudit1Data(null);
        }

        // Extract statistics for audit 2
        if (data.statistics2) {
          setAudit2Data({
            totalFindings: data.statistics2.totalFindings || 0,
            closedFindings: data.statistics2.findingsClosed || 0,
            totalActions: data.statistics2.totalActions || 0,
            completedActions: data.statistics2.actionsComplete || 0,
            overdueActions: data.statistics2.actionsOverdue || 0,
            title: data.auditTitle2 || '',
          });
        } else {
          setAudit2Data(null);
        }
      } catch (error) {
        console.error('Failed to load comparison statistics:', error);
        setAudit1Data(null);
        setAudit2Data(null);
      } finally {
        setLoading(false);
      }
    };

    loadComparisonData();
  }, [audit1Id, audit2Id]);

  // Prepare radar chart data
  const radarData = [
    { subject: 'Finding', A: audit1Data?.totalFindings || 0, B: audit2Data?.totalFindings || 0 },
    { subject: 'Finding Close', A: audit1Data?.closedFindings || 0, B: audit2Data?.closedFindings || 0 },
    { subject: 'Action', A: audit1Data?.totalActions || 0, B: audit2Data?.totalActions || 0 },
    { subject: 'Action Complete', A: audit1Data?.completedActions || 0, B: audit2Data?.completedActions || 0 },
    { subject: 'Action Overdue', A: audit1Data?.overdueActions || 0, B: audit2Data?.overdueActions || 0 },
  ];

  // Calculate max value for domain
  const maxValue = Math.max(
    ...radarData.flatMap(d => [d.A, d.B]),
    1
  );
  const domainMax = Math.ceil(maxValue / 10) * 10 || 100;

  // Get audit title by ID
  const getAuditTitle = (auditId: string, isAudit1: boolean) => {
    // First try to get from loaded data
    if (isAudit1 && audit1Data?.title) {
      return audit1Data.title;
    }
    if (!isAudit1 && audit2Data?.title) {
      return audit2Data.title;
    }
    // Fallback to audits list
    const audit = audits.find(a => (a.auditId || a.id) === auditId);
    return audit ? (audit.title || `Audit ${auditId.substring(0, 8)}`) : 'Select Audit';
  };

  return (
    <div className="bg-white rounded-xl border border-primary-100 shadow-md p-6 w-full">

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-primary-600">Performance Radar</h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600 font-medium">Audit 1:</label>
            <select
              value={audit1Id}
              onChange={(e) => setAudit1Id(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-[200px]"
              disabled={loadingAudits}
            >
              <option value="">-- Select Audit 1 --</option>
              {audits.map((audit) => (
                <option key={audit.auditId || audit.id} value={audit.auditId || audit.id}>
                  {audit.title || `Audit ${(audit.auditId || audit.id).substring(0, 8)}`}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600 font-medium">Audit 2:</label>
            <select
              value={audit2Id}
              onChange={(e) => setAudit2Id(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-[200px]"
              disabled={loadingAudits}
            >
              <option value="">-- Select Audit 2 --</option>
              {audits.map((audit) => (
                <option key={audit.auditId || audit.id} value={audit.auditId || audit.id}>
                  {audit.title || `Audit ${(audit.auditId || audit.id).substring(0, 8)}`}
                </option>
              ))}
            </select>
          </div>
        </div>

      </div>

      {loading ? (
        <div className="flex items-center justify-center" style={{ height: 450 }}>
          <div className="text-gray-500">Loading data...</div>
        </div>
      ) : (!audit1Id || !audit2Id) ? (
        <div className="flex items-center justify-center" style={{ height: 450 }}>
          <div className="text-gray-500 text-center">
            <p>Please select both audits to compare</p>
          </div>
        </div>
      ) : (
        <>
          <div style={{ width: '100%', height: 450, minWidth: 0, minHeight: 450 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="85%" data={radarData}>
                <defs>
                  <linearGradient id="grad-radar-1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#ff2d95" stopOpacity={0.9} />
                  </linearGradient>
                  <linearGradient id="grad-radar-2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.9} />
                  </linearGradient>
                </defs>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#334155', fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, domainMax]} />
                {audit1Id && audit1Data && (
                  <Radar 
                    name={getAuditTitle(audit1Id, true)} 
                    dataKey="A" 
                    stroke="#7c3aed" 
                    fill="#7c3aed" 
                    fillOpacity={0.5} 
                    strokeWidth={3}
                    dot={{ fill: '#7c3aed', r: 5, strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 7 }}
                  />
                )}
                {audit2Id && audit2Data && (
                  <Radar 
                    name={getAuditTitle(audit2Id, false)} 
                    dataKey="B" 
                    stroke="#06b6d4" 
                    fill="#06b6d4" 
                    fillOpacity={0.5} 
                    strokeWidth={3}
                    dot={{ fill: '#06b6d4', r: 5, strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 7 }}
                  />
                )}
                <Tooltip 
                  wrapperStyle={{ backgroundColor: '#fff', borderRadius: 8, border: '1px solid #e2e8f0' }}
                  formatter={(value: any) => [value, '']}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-6 mt-4">
            {audit1Id && audit1Data && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-gradient-to-r from-purple-500 to-pink-500"></div>
                <span className="text-sm text-gray-700">{getAuditTitle(audit1Id, true)}</span>
              </div>
            )}
            {audit2Id && audit2Data && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-gradient-to-r from-cyan-500 to-green-500"></div>
                <span className="text-sm text-gray-700">{getAuditTitle(audit2Id, false)}</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const MonthlyRevenueCard: React.FC = () => {
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [weeklyData, setWeeklyData] = useState([
    { name: 'Monday', value: 0 },
    { name: 'Tuesday', value: 0 },
    { name: 'Wednesday', value: 0 },
    { name: 'Thursday', value: 0 },
    { name: 'Friday', value: 0 },
    { name: 'Saturday', value: 0 },
    { name: 'Sunday', value: 0 },
  ]);
  const [loading, setLoading] = useState<boolean>(false);

  // Format date to MM-DD-YYYY
  const formatDateForAPI = (date: Date): string => {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}-${day}-${year}`;
  };

  // Initialize dates to current week (last 7 days)
  useEffect(() => {
    const today = new Date();
    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 7);
    
    setStartDate(formatDateForAPI(lastWeek));
    setEndDate(formatDateForAPI(today));
  }, []);

  // Fetch findings when dates change and calculate by day of week
  useEffect(() => {
    const fetchFindingsByRange = async () => {
      if (!startDate || !endDate) return;
      
      setLoading(true);
      try {
        const response = await axios.get(
          `https://moca.mom/api/AuditDashboard/findings/by-range?startDate=${startDate}&endDate=${endDate}`
        );
        
        const data = response.data || {};
        const findingsList = (data.allFindings && data.allFindings.$values) || [];
        
        // Initialize counts for each day of week
        const dayCounts: Record<string, number> = {
          'Monday': 0,
          'Tuesday': 0,
          'Wednesday': 0,
          'Thursday': 0,
          'Friday': 0,
          'Saturday': 0,
          'Sunday': 0,
        };

        // Count findings by day of week based on createdAt
        findingsList.forEach((finding: any) => {
          if (finding.createdAt) {
            const date = new Date(finding.createdAt);
            const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
            if (dayCounts[dayOfWeek] !== undefined) {
              dayCounts[dayOfWeek]++;
            }
          }
        });

        // Update weekly data
        setWeeklyData([
          { name: 'Monday', value: dayCounts['Monday'] },
          { name: 'Tuesday', value: dayCounts['Tuesday'] },
          { name: 'Wednesday', value: dayCounts['Wednesday'] },
          { name: 'Thursday', value: dayCounts['Thursday'] },
          { name: 'Friday', value: dayCounts['Friday'] },
          { name: 'Saturday', value: dayCounts['Saturday'] },
          { name: 'Sunday', value: dayCounts['Sunday'] },
        ]);
      } catch (error) {
        console.error('Failed to fetch findings by range:', error);
        // Reset to zeros on error
        setWeeklyData([
          { name: 'Monday', value: 0 },
          { name: 'Tuesday', value: 0 },
          { name: 'Wednesday', value: 0 },
          { name: 'Thursday', value: 0 },
          { name: 'Friday', value: 0 },
          { name: 'Saturday', value: 0 },
          { name: 'Sunday', value: 0 },
        ]);
      } finally {
        setLoading(false);
      }
    };

    if (startDate && endDate) {
      fetchFindingsByRange();
    }
  }, [startDate, endDate]);

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = new Date(e.target.value);
    setStartDate(formatDateForAPI(date));
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = new Date(e.target.value);
    setEndDate(formatDateForAPI(date));
  };

  // Convert MM-DD-YYYY to YYYY-MM-DD for input[type="date"]
  const convertToInputDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const [month, day, year] = dateStr.split('-');
    return `${year}-${month}-${day}`;
  };

  return (
    <div className="bg-white rounded-xl border border-primary-100 shadow-md p-6 w-full">

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-center text-lg font-medium text-gray-700">Finding weekly</h3>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600">From:</label>
            <input
              type="date"
              value={convertToInputDate(startDate)}
              onChange={handleStartDateChange}
              className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600">To:</label>
            <input
              type="date"
              value={convertToInputDate(endDate)}
              onChange={handleEndDateChange}
              className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

      </div>

      {loading ? (
        <div className="flex items-center justify-center" style={{ height: 220 }}>
          <div className="text-gray-500">Loading...</div>
        </div>
      ) : (
        <div style={{ width: '100%', height: 220, minWidth: 0, minHeight: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }} barGap={2} barCategoryGap="4%">
              <defs>
                <linearGradient id="grad-monthly" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={1} />
                  <stop offset="100%" stopColor="#7ee787" stopOpacity={1} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" axisLine={{ stroke: '#e5e7eb', strokeWidth: 1 }} tickLine={true} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }} interval={0} tickMargin={8} />
              <YAxis axisLine={false} tickLine={false} stroke="#94a3b8" />
              <Tooltip wrapperStyle={{ backgroundColor: '#fff', borderRadius: 8, border: '1px solid #e2e8f0' }} />
              <Bar dataKey="value" fill="url(#grad-monthly)" radius={[8, 8, 0, 0]} barSize={44} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

const ProfitCard: React.FC = () => {
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [weeklyData, setWeeklyData] = useState([
    { name: 'Monday', value: 0 },
    { name: 'Tuesday', value: 0 },
    { name: 'Wednesday', value: 0 },
    { name: 'Thursday', value: 0 },
    { name: 'Friday', value: 0 },
    { name: 'Saturday', value: 0 },
    { name: 'Sunday', value: 0 },
  ]);
  const [loading, setLoading] = useState<boolean>(false);

  // Format date to MM-DD-YYYY
  const formatDateForAPI = (date: Date): string => {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}-${day}-${year}`;
  };

  // Initialize dates to current week (last 7 days)
  useEffect(() => {
    const today = new Date();
    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 7);
    
    setStartDate(formatDateForAPI(lastWeek));
    setEndDate(formatDateForAPI(today));
  }, []);

  // Fetch actions when dates change and calculate by day of week
  useEffect(() => {
    const fetchActionsByRange = async () => {
      if (!startDate || !endDate) return;
      
      setLoading(true);
      try {
        const response = await axios.get(
          `https://moca.mom/api/AuditDashboard/actions/by-range?startDate=${startDate}&endDate=${endDate}`
        );
        
        const data = response.data || {};
        const actionsList = (data.allActions && data.allActions.$values) || [];
        
        // Initialize counts for each day of week
        const dayCounts: Record<string, number> = {
          'Monday': 0,
          'Tuesday': 0,
          'Wednesday': 0,
          'Thursday': 0,
          'Friday': 0,
          'Saturday': 0,
          'Sunday': 0,
        };

        // Count actions by day of week based on createdAt
        actionsList.forEach((action: any) => {
          if (action.createdAt) {
            const date = new Date(action.createdAt);
            const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
            if (dayCounts[dayOfWeek] !== undefined) {
              dayCounts[dayOfWeek]++;
            }
          }
        });

        // Update weekly data
        setWeeklyData([
          { name: 'Monday', value: dayCounts['Monday'] },
          { name: 'Tuesday', value: dayCounts['Tuesday'] },
          { name: 'Wednesday', value: dayCounts['Wednesday'] },
          { name: 'Thursday', value: dayCounts['Thursday'] },
          { name: 'Friday', value: dayCounts['Friday'] },
          { name: 'Saturday', value: dayCounts['Saturday'] },
          { name: 'Sunday', value: dayCounts['Sunday'] },
        ]);
      } catch (error) {
        console.error('Failed to fetch actions by range:', error);
        // Reset to zeros on error
        setWeeklyData([
          { name: 'Monday', value: 0 },
          { name: 'Tuesday', value: 0 },
          { name: 'Wednesday', value: 0 },
          { name: 'Thursday', value: 0 },
          { name: 'Friday', value: 0 },
          { name: 'Saturday', value: 0 },
          { name: 'Sunday', value: 0 },
        ]);
      } finally {
        setLoading(false);
      }
    };

    if (startDate && endDate) {
      fetchActionsByRange();
    }
  }, [startDate, endDate]);

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = new Date(e.target.value);
    setStartDate(formatDateForAPI(date));
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = new Date(e.target.value);
    setEndDate(formatDateForAPI(date));
  };

  // Convert MM-DD-YYYY to YYYY-MM-DD for input[type="date"]
  const convertToInputDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const [month, day, year] = dateStr.split('-');
    return `${year}-${month}-${day}`;
  };

  // Calculate max value for Y-axis domain
  const maxValue = Math.max(...weeklyData.map(d => d.value), 1);
  const yAxisMax = Math.ceil(maxValue / 5) * 5 || 30; // Round up to nearest 5, minimum 30

  return (
    <div className="bg-white rounded-xl border border-primary-100 shadow-md p-6 w-full">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-xl font-semibold text-gray-800">Actions</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600">From:</label>
            <input
              type="date"
              value={convertToInputDate(startDate)}
              onChange={handleStartDateChange}
              className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600">To:</label>
            <input
              type="date"
              value={convertToInputDate(endDate)}
              onChange={handleEndDateChange}
              className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      </div>


      {loading ? (
        <div className="flex items-center justify-center" style={{ height: 221 }}>
          <div className="text-gray-500">Loading...</div>
        </div>
      ) : (
        <div style={{ width: '100%', height: 221, minWidth: 0, minHeight: 221 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData} margin={{ top: 6, right: 0, left: 0, bottom: 0 }} barGap={2} barCategoryGap="2%">
              <defs>
                <linearGradient id="grad-profit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff2d95" stopOpacity={1} />
                  <stop offset="100%" stopColor="#7c3aed" stopOpacity={1} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" axisLine={{ stroke: '#e5e7eb', strokeWidth: 1 }} tickLine={true} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }} interval={0} tickMargin={6} />
              <YAxis axisLine={false} tickLine={false} stroke="#94a3b8" domain={[0, yAxisMax]} />
              <Tooltip wrapperStyle={{ backgroundColor: '#fff', borderRadius: 8, border: '1px solid #e2e8f0' }} />
              <Bar dataKey="value" fill="url(#grad-profit)" radius={[8, 8, 0, 0]} barSize={56} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

const DonutSummary: React.FC<{
  data: { name: string; value: number; color: string }[];
  title: string;
  subtitle?: string;
}> = ({ data, title, subtitle }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  const display = data[0];
  return (
    <div className="bg-white rounded-xl border border-primary-100 shadow-md p-6 w-full">
      <div className="flex items-center gap-6">
        <div style={{ width: 120, height: 120 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                startAngle={90}
                endAngle={-270}
                innerRadius={36}
                outerRadius={48}
                paddingAngle={2}
              >
                {data.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">{title}</div>
              <div className="text-3xl font-semibold">{display.value.toLocaleString()}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-green-600 font-medium">16.5% <span className="text-gray-400 text-sm">55.21 USD</span></div>
            </div>
          </div>
          {subtitle && <div className="mt-3 text-sm text-gray-500">{subtitle}</div>}
        </div>
      </div>
    </div>
  );
};

const OrderStatusCard: React.FC<{ data: { name: string; value: number; color: string }[] }> = ({ data }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  const percentage = Math.round((data.reduce((s, d) => s + d.value, 0) / 100) * 100);

  const gradientData = [
    { name: 'Draft', value: 45, startColor: '#ffb84d', endColor: '#ff7a00' },
    { name: 'Pending', value: 35, startColor: '#60e0ff', endColor: '#0284c7' },
    { name: 'Inprogress', value: 20, startColor: '#7ee787', endColor: '#10b981' },
  ];

  return (
    <div className="bg-white rounded-xl border border-primary-100 shadow-md p-4 w-full h-full flex flex-col">
      <h3 className="text-base font-semibold text-gray-800 mb-4">Audits</h3>
      
      <div className="flex flex-col items-center mb-4">
        <div style={{ width: 150, height: 150 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <defs>
                {gradientData.map((item, idx) => (
                  <linearGradient id={`grad-donut-${idx}`} key={`grad-donut-${idx}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={item.startColor} stopOpacity={1} />
                    <stop offset="100%" stopColor={item.endColor} stopOpacity={1} />
                  </linearGradient>
                ))}
              </defs>
              <Pie
                data={gradientData}
                dataKey="value"
                startAngle={90}
                endAngle={-270}
                innerRadius={45}
                outerRadius={75}
                paddingAngle={2}
              >
                {gradientData.map((entry, idx) => (
                  <Cell key={idx} fill={`url(#grad-donut-${idx})`} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        <div className="text-center mt-3">
          <div className="text-2xl font-bold text-gray-800">{percentage}%</div>
          <div className="text-xs text-gray-500 mt-1">Total</div>
        </div>
      </div>

      <div className="space-y-2 border-t pt-3">
        {gradientData.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.startColor }}></div>
              <span className="text-xs text-gray-700">{item.name}</span>
            </div>
            <span className="text-xs font-medium text-gray-800">{item.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const LeadAuditorDashboard: React.FC = () => {
  const { user } = useAuth();
  const layoutUser = user ? { name: (user as any).fullName, avatar: undefined } : undefined;

  return (
    <MainLayout user={layoutUser}>
      <div className="space-y-3">
        <div className="flex gap-6" style={{ height: 420 }}>
          <div className="w-80 h-full">
            <OrderStatusCard data={orderStatusData} />
          </div>
          <div className="flex-1 h-full">
            <BarChartCard
              title="Findings"
              data={barData}
              xAxisKey="department"
              bars={[
                { dataKey: 'Finding Closed', fill: ['#7ee787', '#10b981'], name: 'Finding Closed' },
                { dataKey: 'Finding Open', fill: ['#60e0ff', '#0284c7'], name: 'Finding Open' },
                { dataKey: 'Findings', fill: ['#ffb84d', '#ff7a00'], name: 'Findings' },
              ]}
              height={280}
              className="h-full"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 items-start" style={{ height: 360 }}>
          <div className="h-full">
            <MonthlyRevenueCard />
          </div>
          <div className="h-full">
            <ProfitCard />
          </div>
        </div>
        <div className="-mt-4">
          <RadarSummary />
        </div>
      </div>
    </MainLayout>
  );
};

export default LeadAuditorDashboard;