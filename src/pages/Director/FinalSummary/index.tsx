import { useState } from "react";
import { MainLayout } from "../../../layouts";
import { useAuth } from "../../../contexts";

type ApprovalDecision = "APPROVED" | "REJECTED";

type EffectivenessScores = {
  coverage: number;
  qualityOfFindings: number;
  safetyImpact: number;
  cooperation: number;
};

const defaultScores: EffectivenessScores = {
  coverage: 3,
  qualityOfFindings: 3,
  safetyImpact: 3,
  cooperation: 3,
};

// Mock summary data – should be replaced by API call in the future
const mockFinalSummary = {
  auditId: "ASM-2025-FT-01",
  title: "Flight Training Safety & Quality Internal Audit 2025",
  department: "Flight Training Department",
  type: "Safety & Quality",
  period: "01 Mar 2025 – 15 Mar 2025",
  objectives:
    "To assess compliance with ICAO Annex 1 and national regulations for flight crew training, and evaluate the effectiveness of the Academy's internal safety management system within flight training.",
  scope:
    "ATPL and MPL training programmes, instructor qualification and recurrent training, training records, simulator oversight and SMS integration in training operations.",
  standards:
    "ICAO Annex 1, national civil aviation regulations on flight crew training and licensing, Academy Flight Training Manual and SMS Manual.",
  findingsSummary:
    "18 findings: 2 Major, 9 Minor, 7 Observations. Major findings concerned incomplete training records and overdue recurrent training for two simulator instructors.",
  recommendations:
    "Upgrade the electronic training record system, implement systematic internal quality checks for training documentation and strengthen recurrent SMS training for instructors.",
  conclusion:
    "The Flight Training Department remains largely compliant and effective, but strengthening documentation and proactive safety assurance is necessary to reach best‑practice level expected for accreditation.",
};

export default function DirectorFinalSummaryPage() {
  const { user } = useAuth();
  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  const [decision, setDecision] = useState<ApprovalDecision | null>(null);
  const [comments, setComments] = useState("");
  const [scores, setScores] = useState<EffectivenessScores>(defaultScores);
  const [submitting, setSubmitting] = useState(false);

  const overallScore = Math.round(
    (scores.coverage + scores.qualityOfFindings + scores.safetyImpact + scores.cooperation) / 4
  );

  const handleSubmit = async () => {
    if (!decision) return;
    setSubmitting(true);
    try {
      // TODO: POST /api/audits/{auditId}/final-summary/director-approval
      await new Promise(resolve => setTimeout(resolve, 700));
    } finally {
      setSubmitting(false);
    }
  };

  const scoreOptions = [1, 2, 3, 4, 5];

  return (
    <MainLayout user={layoutUser} title="Final Summary Approval (Stream 5)">
      <div className="space-y-6">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 shadow-sm">
          <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Director – Final Summary Review & Effectiveness</h1>
              <p className="mt-1 text-sm text-gray-500 max-w-2xl">
                Review the final summary, take the formal approval decision and evaluate the effectiveness of the audit.
              </p>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="px-4 sm:px-6 lg:px-8 grid gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-800 uppercase">Final audit summary report</h2>
                <p className="mt-1 text-xs text-gray-500">
                  Final report prepared by the Auditor and confirmed as accurate by the Lead Auditor. The content below is mock data.
                </p>
              </div>
            </div>
            <div className="p-4 space-y-4 text-sm text-gray-700">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">Audit</p>
                  <p className="text-sm font-medium text-gray-900">{mockFinalSummary.auditId}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">Department / Unit</p>
                  <p className="text-sm text-gray-900">{mockFinalSummary.department}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">Title</p>
                  <p className="text-sm text-gray-900">{mockFinalSummary.title}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">Type / Period</p>
                  <p className="text-sm text-gray-900">
                    {mockFinalSummary.type} · {mockFinalSummary.period}
                  </p>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-3 space-y-3 text-xs leading-relaxed">
                <div>
                  <p className="font-semibold text-gray-700 uppercase">Objectives</p>
                  <p className="text-gray-700">{mockFinalSummary.objectives}</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-700 uppercase">Scope</p>
                  <p className="text-gray-700">{mockFinalSummary.scope}</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-700 uppercase">Standards / References</p>
                  <p className="text-gray-700">{mockFinalSummary.standards}</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-700 uppercase">Summary of findings</p>
                  <p className="text-gray-700">{mockFinalSummary.findingsSummary}</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-700 uppercase">Key recommendations</p>
                  <p className="text-gray-700">{mockFinalSummary.recommendations}</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-700 uppercase">Overall conclusion</p>
                  <p className="text-gray-700">{mockFinalSummary.conclusion}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800 uppercase">Audit effectiveness evaluation</h2>
              <p className="mt-1 text-xs text-gray-500">
                Evaluate how effective this audit was against key aviation accreditation criteria.
              </p>
            </div>
            <div className="p-4 space-y-4 text-sm text-gray-700">
              {([
                {
                  key: "coverage",
                  label: "Coverage of critical processes",
                  description:
                    "Extent to which critical processes (flight training, maintenance interface, SMS, examinations, etc.) were adequately covered.",
                },
                {
                  key: "qualityOfFindings",
                  label: "Quality & depth of findings",
                  description:
                    "Depth, relevance and usefulness of findings for improving safety and quality performance.",
                },
                {
                  key: "safetyImpact",
                  label: "Potential safety / quality impact",
                  description:
                    "Potential impact of this audit on improving safety risk control and quality of operations.",
                },
                {
                  key: "cooperation",
                  label: "Cooperation of auditee",
                  description: "Level of cooperation, openness and responsiveness from the audited organisation.",
                },
              ] as const).map(item => (
                <div key={item.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-xs text-gray-500">{item.description}</p>
                    </div>
                    <div className="flex gap-1">
                      {scoreOptions.map(value => (
                        <button
                          key={value}
                          type="button"
                          onClick={() =>
                            setScores(prev => ({
                              ...prev,
                              [item.key]: value,
                            }))
                          }
                          className={
                            "w-8 h-8 rounded-full text-xs font-semibold border " +
                            (scores[item.key as keyof EffectivenessScores] === value
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50")
                          }
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}

              <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase">Overall effectiveness score</p>
                  <p className="text-sm font-semibold text-gray-900">{overallScore} / 5</p>
                </div>
                <p
                  className={
                    "px-3 py-1 rounded-full text-xs font-semibold " +
                    (overallScore >= 4
                      ? "bg-green-100 text-green-800"
                      : overallScore >= 3
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-red-100 text-red-800")
                  }
                >
                  {overallScore >= 4 ? "High effectiveness" : overallScore >= 3 ? "Moderate" : "Needs improvement"}
                </p>
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800 uppercase">Approval decision</h2>
            </div>
            <div className="p-4 space-y-3 text-sm text-gray-700">
              <div className="space-y-2">
                <div className="flex flex-col gap-2">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="approval"
                      value="APPROVED"
                      checked={decision === "APPROVED"}
                      onChange={() => setDecision("APPROVED")}
                      className="text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span>Approve final summary report</span>
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="approval"
                      value="REJECTED"
                      checked={decision === "REJECTED"}
                      onChange={() => setDecision("REJECTED")}
                      className="text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span>Reject & request rework</span>
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-700 uppercase">
                  Director comments
                </label>
                <textarea
                  rows={5}
                  value={comments}
                  onChange={e => setComments(e.target.value)}
                  className="block w-full mt-1 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Approval rationale or rework instructions, including any link to accreditation or regulatory requirements."
                />
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={!decision || submitting}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-700 disabled:opacity-60"
              >
                {submitting
                  ? "Submitting..."
                  : decision === "APPROVED"
                  ? "Approve & save final summary report"
                  : "Reject & send back for rework"}
              </button>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-xs text-blue-900">
            <p className="font-semibold">System behaviour after approval</p>
            <p className="mt-1">
              Once the Director approves, the system will permanently store the final summary, record the approver and
              timestamp, and attach it to the Aviation Academy&apos;s accreditation evidence set.
            </p>
          </div>
        </aside>
      </div>
      </div>
    </MainLayout>
  );
}
