import { MainLayout } from '../../layouts';
import { useNavigate } from 'react-router-dom';

const SummaryReport = () => {
  const navigate = useNavigate();

  // Mock data
  const complianceData = {
    overall: 94,
    byDepartment: [
      { name: 'IT Department', rate: 96, audits: 8 },
      { name: 'HR Department', rate: 92, audits: 6 },
      { name: 'Finance Department', rate: 95, audits: 7 },
      { name: 'Operations', rate: 91, audits: 5 },
      { name: 'Marketing', rate: 93, audits: 4 },
    ],
    trend: '+2.5% from last quarter',
  };

  const riskAssessment = {
    critical: 2,
    high: 5,
    medium: 12,
    low: 18,
    total: 37,
  };

  const auditSummary = {
    totalAudits: 30,
    completedAudits: 28,
    pendingAudits: 2,
    totalFindings: 85,
    resolvedFindings: 72,
    pendingFindings: 13,
  };

  const getComplianceColor = (rate: number) => {
    if (rate >= 95) return 'text-green-600';
    if (rate >= 90) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getComplianceBarColor = (rate: number) => {
    if (rate >= 95) return 'bg-green-600';
    if (rate >= 90) return 'bg-yellow-600';
    return 'bg-red-600';
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Summary Report</h1>
            <p className="text-gray-600 mt-1">Compliance rates and risk assessment overview</p>
          </div>
          <button
            onClick={() => navigate('/director')}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>

        {/* Quick Navigation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => document.getElementById('compliance-section')?.scrollIntoView({ behavior: 'smooth' })}
            className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow text-left border-l-4 border-blue-500"
          >
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <div>
                <h3 className="font-semibold text-gray-800">Compliance Rate</h3>
                <p className="text-sm text-gray-600">View compliance metrics</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => document.getElementById('risk-section')?.scrollIntoView({ behavior: 'smooth' })}
            className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow text-left border-l-4 border-red-500"
          >
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h3 className="font-semibold text-gray-800">Risk Assessment</h3>
                <p className="text-sm text-gray-600">View risk analysis</p>
              </div>
            </div>
          </button>
        </div>

        {/* Audit Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Audits</p>
                <p className="text-3xl font-bold text-gray-800">{auditSummary.totalAudits}</p>
                <p className="text-sm text-green-600 mt-1">{auditSummary.completedAudits} completed</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Findings</p>
                <p className="text-3xl font-bold text-gray-800">{auditSummary.totalFindings}</p>
                <p className="text-sm text-green-600 mt-1">{auditSummary.resolvedFindings} resolved</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Overall Compliance</p>
                <p className="text-3xl font-bold text-green-600">{complianceData.overall}%</p>
                <p className="text-sm text-green-600 mt-1">{complianceData.trend}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Compliance Rate Section */}
        <div id="compliance-section" className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-6">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h2 className="text-2xl font-bold text-gray-800">Compliance Rate by Department</h2>
          </div>

          <div className="space-y-6">
            {complianceData.byDepartment.map((dept, index) => (
              <div key={index}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3 flex-1">
                    <span className="font-semibold text-gray-800 min-w-[150px]">{dept.name}</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-6 overflow-hidden">
                      <div
                        className={`h-6 rounded-full flex items-center justify-end px-2 transition-all ${getComplianceBarColor(dept.rate)}`}
                        style={{ width: `${dept.rate}%` }}
                      >
                        <span className="text-white text-xs font-semibold">{dept.rate}%</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-sm text-gray-600 ml-4">{dept.audits} audits</span>
                </div>
              </div>
            ))}
          </div>

          {/* Compliance Summary */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Overall Compliance Rate</p>
                <p className={`text-4xl font-bold ${getComplianceColor(complianceData.overall)}`}>
                  {complianceData.overall}%
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Trend</p>
                <p className="text-lg font-semibold text-green-600">{complianceData.trend}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Risk Assessment Section */}
        <div id="risk-section" className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-6">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className="text-2xl font-bold text-gray-800">Risk Assessment</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-600 font-medium">Critical Risks</p>
                  <p className="text-4xl font-bold text-red-600 mt-2">{riskAssessment.critical}</p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                  </svg>
                </div>
              </div>
              <p className="text-xs text-red-600 mt-2">Immediate action required</p>
            </div>

            <div className="bg-orange-50 border-l-4 border-orange-500 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-orange-600 font-medium">High Risks</p>
                  <p className="text-4xl font-bold text-orange-600 mt-2">{riskAssessment.high}</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              </div>
              <p className="text-xs text-orange-600 mt-2">Priority attention needed</p>
            </div>

            <div className="bg-yellow-50 border-l-4 border-yellow-500 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-yellow-600 font-medium">Medium Risks</p>
                  <p className="text-4xl font-bold text-yellow-600 mt-2">{riskAssessment.medium}</p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-xs text-yellow-600 mt-2">Monitor and plan mitigation</p>
            </div>

            <div className="bg-green-50 border-l-4 border-green-500 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600 font-medium">Low Risks</p>
                  <p className="text-4xl font-bold text-green-600 mt-2">{riskAssessment.low}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-xs text-green-600 mt-2">Continue current controls</p>
            </div>
          </div>

          {/* Risk Distribution Chart (Simple Visual) */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-800 mb-4">Risk Distribution</h3>
            <div className="flex items-center gap-2 h-8">
              <div 
                className="bg-red-600 h-full rounded-l flex items-center justify-center text-white text-xs font-semibold"
                style={{ width: `${(riskAssessment.critical / riskAssessment.total) * 100}%` }}
              >
                {riskAssessment.critical}
              </div>
              <div 
                className="bg-orange-600 h-full flex items-center justify-center text-white text-xs font-semibold"
                style={{ width: `${(riskAssessment.high / riskAssessment.total) * 100}%` }}
              >
                {riskAssessment.high}
              </div>
              <div 
                className="bg-yellow-600 h-full flex items-center justify-center text-white text-xs font-semibold"
                style={{ width: `${(riskAssessment.medium / riskAssessment.total) * 100}%` }}
              >
                {riskAssessment.medium}
              </div>
              <div 
                className="bg-green-600 h-full rounded-r flex items-center justify-center text-white text-xs font-semibold"
                style={{ width: `${(riskAssessment.low / riskAssessment.total) * 100}%` }}
              >
                {riskAssessment.low}
              </div>
            </div>
            <div className="flex justify-between text-xs text-gray-600 mt-2">
              <span>Critical</span>
              <span>High</span>
              <span>Medium</span>
              <span>Low</span>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default SummaryReport;
