import { MainLayout } from "../../../layouts";
import { useAuth } from "../../../contexts";
import { AuditorAssignmentsView } from "../../LeadAuditor/SpecifyCreatePlan/components/AuditorAssignmentsView";

const AuditorPlanAssignments = () => {
  const { user } = useAuth();
  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  return (
    <MainLayout user={layoutUser}>
      <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <div className="rounded-2xl bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-md p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-white/80 font-semibold">
                  Auditor Workspace
                </p>
                <h1 className="text-2xl font-bold mt-1">Plan Assignments</h1>
                <p className="text-sm text-white/90 mt-2">
                  Nhận và phản hồi các yêu cầu tạo audit plan từ Lead Auditor.
                </p>
              </div>
              <div className="hidden sm:flex items-center gap-2 bg-white/15 px-3 py-2 rounded-lg text-sm font-semibold">
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-300 animate-pulse"></span>
                Trạng thái: Sẵn sàng
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 sm:p-6">
          <AuditorAssignmentsView />
        </div>
      </div>
    </MainLayout>
  );
};

export default AuditorPlanAssignments;

