import { useState } from "react";
import { MainLayout } from "../../../layouts";
import { useAuth } from "../../../contexts";

type AccuracyDecision = "ACCURATE" | "NEED_REVISION";

// Mock summary data – will be replaced by API response later
const mockFinalSummary = {
  auditId: "ASM-2025-FT-01",
  title: "Flight Training Safety & Quality Internal Audit 2025",
  department: "Flight Training Department",
  type: "Safety & Quality",
  period: "01 Mar 2025 – 15 Mar 2025",
  objectives:
    "To assess compliance with ICAO Annex 1 and national regulations for flight crew training, and evaluate the effectiveness of the Academy's internal safety management arrangements in the training environment.",
  scope:
    "ATPL and MPL training programmes, instructor qualification and recurrent training, training records management and simulator training oversight.",
  standards:
    "ICAO Annex 1, national CAA regulations on flight crew licensing and training, Academy Flight Training Manual and SMS Manual.",
  findingsSummary:
    "18 findings: 2 Major, 9 Minor, 7 Observations. Major findings relate to incomplete training records and overdue recurrent training for two instructors.",
  recommendations:
    "Introduce automated reminders for recurrent training, improve digital record completeness checks and provide additional training to instructors on documentation quality.",
  conclusion:
    "The training organisation is broadly compliant, but documentation discipline and proactive safety assurance require improvement to fully meet best practice expectations.",
};

export default function LeadAuditorFinalSummaryReviewPage() {
  const { user } = useAuth();
  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  const [decision, setDecision] = useState<AccuracyDecision | null>(null);
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!decision) return;
    setSubmitting(true);
    try {
      // TODO: POST /api/audits/{auditId}/final-summary/lead-review
      await new Promise(resolve => setTimeout(resolve, 600));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MainLayout user={layoutUser} title="Final Summary Review (Stream 5)">
      <div className="space-y-6">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 shadow-sm">
          <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Lead Auditor – Final Summary Accuracy Review</h1>
              <p className="mt-1 text-sm text-gray-500 max-w-2xl">
                Check that the final summary report is accurate and fully reflects the audit evidence before sending it to
                the Director.
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
                  Preview of the final summary prepared by the Auditor. This section currently shows mock data.
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
        </section>

        <aside className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800 uppercase">Accuracy decision</h2>
            </div>
            <div className="p-4 space-y-3 text-sm text-gray-700">
              <div className="space-y-2">
                <p className="text-xs text-gray-500">
                  Select your conclusion on whether the report is accurate compared with the audit file and applicable standards.
                </p>
                <div className="flex flex-col gap-2">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="decision"
                      value="ACCURATE"
                      checked={decision === "ACCURATE"}
                      onChange={() => setDecision("ACCURATE")}
                      className="text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span>Report is accurate</span>
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="decision"
                      value="NEED_REVISION"
                      checked={decision === "NEED_REVISION"}
                      onChange={() => setDecision("NEED_REVISION")}
                      className="text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span>Needs revision</span>
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-700 uppercase">
                  Lead auditor comments
                </label>
                <textarea
                  rows={5}
                  value={comments}
                  onChange={e => setComments(e.target.value)}
                  className="block w-full mt-1 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Comments on figures, severity classification, alignment with ICAO/national regulations and completeness of scope."
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
                  : decision === "ACCURATE"
                  ? "Confirm accurate & forward to Director"
                  : "Send revision request to Auditor"}
              </button>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-xs text-blue-900">
            <p className="font-semibold">Lead Auditor role in Stream 5</p>
            <p className="mt-1">
              Ensure the final summary fairly represents audit evidence, aligns with aviation accreditation standards and
              does not omit significant safety or quality risks before submission to the Director.
            </p>
          </div>
        </aside>
      </div>
      </div>
    </MainLayout>
  );
}
