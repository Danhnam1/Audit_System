import { lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ROUTES } from "../constants";
import useAuthStore from "../store/useAuthStore";
import { ProtectedRoute } from "../components";

// Lazy load all pages
const LoginPage = lazy(() => import("../pages/Auth/LoginPage"));

// Admin pages
const AdminUserManagement = lazy(() => import("../pages/Admin/UserManagement"));
const AdminDepartmentManagement = lazy(() => import("../pages/Admin/DepartmentManagement"));
const AdminBackupRestore = lazy(() => import("../pages/Admin/BackupRestore"));
const AdminCriteriaManagement = lazy(() => import("../pages/Admin/CriteriaManagement"));
const AdminChecklistManagement = lazy(() => import("../pages/Admin/ChecklistManagement"));
const AdminSensitiveAreaManagement = lazy(() => import("../pages/Admin/SensitiveAreaManagement"));
const AdminPassThreshold = lazy(() => import("../pages/Admin/PassThreshold"));
const AdminSettingDemo = lazy(() => import("../pages/Admin/SettingDemo"));

// Auditor pages
const SQAStaffAuditPlanning = lazy(() => import("../pages/Auditor/AuditPlanning"));
const SQAStaffAuditTeam = lazy(() => import("../pages/Auditor/AuditTeam"));
const SQAStaffFindingManagement = lazy(() => import("../pages/Auditor/FindingManagement"));
const SQAStaffAuditExecutionDetail = lazy(() => import("../pages/Auditor/FindingManagement/AuditExecutionDetail"));
const SQAStaffDepartmentChecklist = lazy(() => import("../pages/Auditor/FindingManagement/DepartmentChecklist"));
const SQAStaffAuditDepartments = lazy(() => import("../pages/Auditor/FindingManagement/AuditDepartments"));
const SQAStaffReports = lazy(() => import("../pages/Auditor/Reports"));
const SQAStaffAuditReview = lazy(() => import("../pages/Auditor/AuditReview"));
// const SQAStaffRequests = lazy(() => import("../pages/Auditor/Requests"));
// const SQAStaffReviewFindingDetail = lazy(() => import("../pages/Auditor/Requests/ReviewFindingDetail"));
const SQAStaffHistoryUpload = lazy(() => import("../pages/Auditor/HistoryUpload"));
const SQAStaffSchedule = lazy(() => import("../pages/Auditor/Schedule"));
const SQAStaffMyQR = lazy(() => import("../pages/Auditor/MyQR"));
const AuditorFinalSummaryPage = lazy(() => import("../pages/Auditor/FinalSummary"));

// Lead Auditor pages
const LeadAuditorAuditAssignment = lazy(() => import("../pages/LeadAuditor/AuditAssignment"));
const LeadAuditorAuditPlanning = lazy(() => import("../pages/LeadAuditor/auditplanning"));
const LeadAuditorAuditDetail = lazy(() => import("../pages/LeadAuditor/auditplanning/AuditDetail"));
const LeadAuditorSpecifyCreatePlan = lazy(() => import("../pages/LeadAuditor/SpecifyCreatePlan"));
const AuditorPlanAssignments = lazy(() => import("../pages/Auditor/PlanAssignments"));
const LeadAuditorLeadReports = lazy(() => import("../pages/LeadAuditor/LeadReports"));
const LeadAuditorActionReview = lazy(() => import("../pages/LeadAuditor/ActionReview"));
const LeadAuditorDashboard = lazy(() => import("../pages/LeadAuditor/Dashboard"));
const SQAStaffLeadFinalReview = lazy(() => import("../pages/Auditor/LeadFinalReview/LeadFinalReview"));
const LeadAuditorFinalSummaryReviewPage = lazy(
    () => import("../pages/LeadAuditor/FinalSummaryReview")
);
const LeadAuditorRequestManagement = lazy(
    () => import("../pages/LeadAuditor/RequestManagement")
);

// CAPA Owner pages (formerly Department Staff)
// Import without explicit /index để tương thích cả file Dashboard.tsx hoặc Dashboard/index.tsx
const CAPAOwnerDashboard = lazy(() => import("../pages/CAPAOwner/Dashboard"));
const CAPAOwnerAuditList = lazy(() => import("../pages/CAPAOwner/AuditList"));
const CAPAOwnerMyWitnessed = lazy(() => import("../pages/CAPAOwner/MyWitnessed"));
const CAPAOwnerWitnessedAuditFindings = lazy(() => import("../pages/CAPAOwner/WitnessedAuditFindings"));
const DepartmentStaffAssignedTasks = lazy(() => import("../pages/CAPAOwner/AssignedTasks"));
const DepartmentStaffTaskDetail = lazy(() => import("../pages/CAPAOwner/TaskDetail"));
const DepartmentStaffUploadEvidence = lazy(() => import("../pages/CAPAOwner/UploadEvidence"));
const DepartmentStaffTodoList = lazy(() => import("../pages/CAPAOwner/TodoList"));
const DepartmentStaffFindingsProgress = lazy(() => import("../pages/CAPAOwner/FindingsProgress"));
const DepartmentStaffCheckDeadlines = lazy(() => import("../pages/CAPAOwner/CheckDeadlines"));

// Auditee Owner pages (formerly Department Head)
// Removed DepartmentHeadWelcome (file deleted)
const AuditeeOwnerDashboard = lazy(() => import("../pages/AuditeeOwner/Dashboard"));
const DepartmentHeadAuditPlans = lazy(() => import("../pages/AuditeeOwner/auditplan/AuditPlans"));
const DepartmentHeadAuditPlanDetail = lazy(() => import("../pages/AuditeeOwner/auditplan/AuditPlanDetail"));
const DepartmentHeadAuditPlanConfirm = lazy(() => import("../pages/AuditeeOwner/auditplan/AuditPlanConfirm"));
const DepartmentHeadAssignTasks = lazy(() => import("../pages/AuditeeOwner/taskasign/AssignTasks"));
const DepartmentHeadFindingsList = lazy(() => import("../pages/AuditeeOwner/findings/FindingsList"));
const AuditeeOwnerAuditList = lazy(() => import("../pages/AuditeeOwner/findings/AuditList"));
const DepartmentHeadAssignStaff = lazy(() => import("../pages/AuditeeOwner/taskasign/AssignStaff"));
const DepartmentHeadReviewEvidence = lazy(() => import("../pages/AuditeeOwner/ReviewEvidence"));
const DepartmentHeadEvidenceDetail = lazy(() => import("../pages/AuditeeOwner/EvidenceDetail"));
const DepartmentHeadFindingsProgress = lazy(() => import("../pages/AuditeeOwner/findings/FindingsProgress"));
const DepartmentHeadCAPAManagement = lazy(() => import("../pages/AuditeeOwner/CAPAManagement"));
const AuditeeOwnerScanQR = lazy(() => import("../pages/AuditeeOwner/ScanQR"));
const AuditScheduleCalendar = lazy(() => import("../pages/AuditeeOwner/AuditScheduleCalendar"));
const AuditeeOwnerAuditChecklist = lazy(() => import("../pages/AuditeeOwner/checklist/AuditChecklist"));
const AuditeeOwnerMyWitnessed = lazy(() => import("../pages/AuditeeOwner/MyWitnessed"));
const AuditeeOwnerWitnessedAuditFindings = lazy(() => import("../pages/AuditeeOwner/WitnessedAuditFindings"));

// Director pages
const DirectorDashboard = lazy(() => import("../pages/Director/Dashboard"));
const DirectorReviewAuditPlans = lazy(() => import("../pages/Director/ReviewAuditPlans"));
const DirectorAuditPlanDetail = lazy(() => import("../pages/Director/AuditPlanDetail"));
const DirectorReviewAuditResults = lazy(() => import("../pages/Director/ReviewAuditResults"));
const DirectorSummaryReport = lazy(() => import("../pages/Director/SummaryReport"));
const DirectorFinalSummaryPage = lazy(() => import("../pages/Director/FinalSummary"));
const DirectorExtensionRequests = lazy(() => import("../pages/Director/ExtensionRequests"));
const DirectorResultHistory = lazy(() => import("../pages/Director/ResultHistory"));

// Shared pages
const ArchivedHistory = lazy(() => import("../pages/Shared/ArchivedHistory"));
const Profile = lazy(() => import("../pages/Profile"));


// AppRoutes component - contains only route definitions
export function AppRoutes() {
    const { token, user } = useAuthStore();
    const isAuthenticated = !!token;

    // Redirect to appropriate dashboard based on role
    const getDefaultRoute = () => {
        if (!user) return ROUTES.LOGIN;

        // Use normalized keys (lowercase, no spaces) to be tolerant of different role string formats
        const roleRouteMap: Record<string, string> = {
            admin: ROUTES.ADMIN,
            auditor: ROUTES.AUDITOR,
            capaowner: '/capa-owner/tasks',
            auditeeowner: '/auditee-owner/dashboard',
            director: '/director/dashboard',
            leadauditor: '/lead-auditor/auditplanning',
        };

        // Debug log to inspect user role
        const rawRole = (user?.role || user?.roleName || '');
        const normalized = String(rawRole).toLowerCase().replace(/\s+/g, '');

        return roleRouteMap[normalized] || ROUTES.LOGIN;
    };

    return (
        <Routes>
            {/* Public route - Login */}
            <Route
                path={ROUTES.LOGIN}
                element={
                    isAuthenticated ? (
                        <Navigate to={getDefaultRoute()} replace />
                    ) : (
                        <LoginPage />
                    )
                }
            />

            {/* Protected routes - Admin */}
            <Route
                path={ROUTES.ADMIN}
                element={
                    <ProtectedRoute allowedRoles={["Admin"]}>
                        <Navigate to="/admin/departments" replace />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/users"
                element={
                    <ProtectedRoute allowedRoles={["Admin"]}>
                        <AdminUserManagement />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/departments"
                element={
                    <ProtectedRoute allowedRoles={["Admin"]}>
                        <AdminDepartmentManagement />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/criteria"
                element={
                    <ProtectedRoute allowedRoles={["Admin"]}>
                        <AdminCriteriaManagement />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/checklists"
                element={
                    <ProtectedRoute allowedRoles={["Admin"]}>
                        <AdminChecklistManagement />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/archived-history"
                element={
                    <ProtectedRoute allowedRoles={["Admin"]}>
                        <ArchivedHistory />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/backup"
                element={
                    <ProtectedRoute allowedRoles={["Admin"]}>
                        <AdminBackupRestore />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/sensitive-areas"
                element={
                    <ProtectedRoute allowedRoles={["Admin"]}>
                        <AdminSensitiveAreaManagement />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/pass-threshold"
                element={
                    <ProtectedRoute allowedRoles={["Admin"]}>
                        <AdminPassThreshold />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/setting-demo"
                element={
                    <ProtectedRoute allowedRoles={["Admin"]}>
                        <AdminSettingDemo />

                    </ProtectedRoute>
                }
            />

            {/* Protected routes - Auditor */}
            <Route
                path={ROUTES.AUDITOR}
                element={
                    <ProtectedRoute allowedRoles={["Auditor"]}>
                        <Navigate to="/auditor/planning" replace />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/auditor/planning"
                element={
                    <ProtectedRoute allowedRoles={["Auditor"]}>
                        <SQAStaffAuditPlanning />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/auditor/team"
                element={
                    <ProtectedRoute allowedRoles={["Auditor"]}>
                        <SQAStaffAuditTeam />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/auditor/findings"
                element={
                    <ProtectedRoute allowedRoles={["Auditor"]}>
                        <SQAStaffFindingManagement />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/auditor/findings/audit/:auditId"
                element={
                    <ProtectedRoute allowedRoles={["Auditor"]}>
                        <SQAStaffAuditDepartments />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/auditor/findings/:id"
                element={
                    <ProtectedRoute allowedRoles={["Auditor"]}>
                        <SQAStaffAuditExecutionDetail />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/auditor/findings/department/:deptId"
                element={
                    <ProtectedRoute allowedRoles={["Auditor"]}>
                        <SQAStaffDepartmentChecklist />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/auditor/reports"
                element={
                    <ProtectedRoute allowedRoles={["Auditor"]}>
                        <SQAStaffReports />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/auditor/audit-review"
                element={
                    <ProtectedRoute allowedRoles={["Auditor"]}>
                        <SQAStaffAuditReview />
                    </ProtectedRoute>
                }
            />
            {/* <Route
                path="/auditor/requests"
                element={
                    <ProtectedRoute allowedRoles={["Auditor"]}>
                        <SQAStaffRequests />
                    </ProtectedRoute>
                }
            />
    
            <Route
                path="/auditor/review-findings/:findingId"
                element={
                    <ProtectedRoute allowedRoles={["Auditor"]}>
                        <SQAStaffReviewFindingDetail />
                    </ProtectedRoute>
                }
            /> */}
            <Route
                path="/auditor/history-upload"
                element={
                    <ProtectedRoute allowedRoles={["Auditor"]}>
                        <SQAStaffHistoryUpload />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/auditor/schedule"
                element={
                    <ProtectedRoute allowedRoles={["Auditor"]}>
                        <SQAStaffSchedule />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/auditor/my-qr"
                element={
                    <ProtectedRoute allowedRoles={["Auditor"]}>
                        <SQAStaffMyQR />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/auditor/final-summary"
                element={
                    <ProtectedRoute allowedRoles={["Auditor"]}>
                        <AuditorFinalSummaryPage />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/auditor/audit-assignment"
                element={
                    <ProtectedRoute allowedRoles={["Auditor", "Lead Auditor"]}>
                        <LeadAuditorAuditAssignment />
                    </ProtectedRoute>
                }
            />
<Route
  path="/auditor/lead-final-review"
  element={
    <ProtectedRoute allowedRoles={["Auditor"]}>
      <SQAStaffLeadFinalReview />
    </ProtectedRoute>
  }
/>
<Route
  path="/auditor/lead-final-review/:auditId"
  element={
    <ProtectedRoute allowedRoles={["Auditor"]}>
      <SQAStaffLeadFinalReview />
    </ProtectedRoute>
  }
/>

            {/* Protected routes - CAPA Owner */}
            <Route
                path={ROUTES.CAPA_OWNER}
                element={
                    <ProtectedRoute allowedRoles={["CAPAOwner"]}>
                        <Navigate to="/capa-owner/dashboard" replace />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/capa-owner/dashboard"
                element={
                    <ProtectedRoute allowedRoles={["CAPAOwner"]}>
                        <CAPAOwnerDashboard />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/capa-owner/tasks"
                element={
                    <ProtectedRoute allowedRoles={["CAPAOwner"]}>
                        <CAPAOwnerAuditList />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/capa-owner/tasks/audit/:auditId"
                element={
                    <ProtectedRoute allowedRoles={["CAPAOwner"]}>
                        <DepartmentStaffAssignedTasks />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/capa-owner/tasks/:taskId"
                element={
                    <ProtectedRoute allowedRoles={["CAPAOwner"]}>
                        <DepartmentStaffTaskDetail />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/capa-owner/upload-evidence"
                element={
                    <ProtectedRoute allowedRoles={["CAPAOwner"]}>
                        <DepartmentStaffUploadEvidence />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/capa-owner/upload-evidence/:taskId"
                element={
                    <ProtectedRoute allowedRoles={["CAPAOwner"]}>
                        <DepartmentStaffUploadEvidence />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/capa-owner/todo"
                element={
                    <ProtectedRoute allowedRoles={["CAPAOwner"]}>
                        <DepartmentStaffTodoList />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/capa-owner/progress"
                element={
                    <ProtectedRoute allowedRoles={["CAPAOwner"]}>
                        <DepartmentStaffFindingsProgress />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/capa-owner/deadlines"
                element={
                    <ProtectedRoute allowedRoles={["CAPAOwner"]}>
                        <DepartmentStaffCheckDeadlines />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/capa-owner/my-witnessed"
                element={
                    <ProtectedRoute allowedRoles={["CAPAOwner"]}>
                        <CAPAOwnerMyWitnessed />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/capa-owner/my-witnessed/audit/:auditId"
                element={
                    <ProtectedRoute allowedRoles={["CAPAOwner"]}>
                        <CAPAOwnerWitnessedAuditFindings />
                    </ProtectedRoute>
                }
            />
        

            {/* Protected routes - Auditee Owner */}
            {/* Removed AuditeeOwner welcome route (component deleted) */}
            <Route
                path="/auditee-owner/dashboard"
                element={
                    <ProtectedRoute allowedRoles={["AuditeeOwner"]}>
                        <AuditeeOwnerDashboard />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/auditee-owner/audit-plans"
                element={
                    <ProtectedRoute allowedRoles={["AuditeeOwner"]}>
                        <DepartmentHeadAuditPlans />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/auditee-owner/audit-plans/:id/detail"
                element={
                    <ProtectedRoute allowedRoles={["AuditeeOwner"]}>
                        <DepartmentHeadAuditPlanDetail />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/auditee-owner/audit-plans/:id/confirm"
                element={
                    <ProtectedRoute allowedRoles={["AuditeeOwner"]}>
                        <DepartmentHeadAuditPlanConfirm />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/auditee-owner/assign-tasks"
                element={
                    <ProtectedRoute allowedRoles={["AuditeeOwner"]}>
                        <DepartmentHeadAssignTasks />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/auditee-owner/assign-tasks/findings"
                element={
                    <ProtectedRoute allowedRoles={["AuditeeOwner"]}>
                        <DepartmentHeadFindingsList />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/auditee-owner/assign-tasks/:id/assign"
                element={
                    <ProtectedRoute allowedRoles={["AuditeeOwner"]}>
                        <DepartmentHeadAssignStaff />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/auditee-owner/review-evidence"
                element={
                    <ProtectedRoute allowedRoles={["AuditeeOwner"]}>
                        <DepartmentHeadReviewEvidence />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/auditee-owner/evidence-detail/:findingId"
                element={
                    <ProtectedRoute allowedRoles={["AuditeeOwner"]}>
                        <DepartmentHeadEvidenceDetail />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/auditee-owner/findings"
                element={
                    <ProtectedRoute allowedRoles={["AuditeeOwner"]}>
                        <AuditeeOwnerAuditList />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/auditee-owner/findings/audit/:auditId"
                element={
                    <ProtectedRoute allowedRoles={["AuditeeOwner"]}>
                        <DepartmentHeadFindingsProgress />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/auditee-owner/checklist/audit/:auditId/dept/:deptId"
                element={
                    <ProtectedRoute allowedRoles={["AuditeeOwner"]}>
                        <AuditeeOwnerAuditChecklist />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/auditee-owner/capa-management"
                element={
                    <ProtectedRoute allowedRoles={["AuditeeOwner"]}>
                        <DepartmentHeadCAPAManagement />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/auditee-owner/scan-qr"
                element={
                    <ProtectedRoute allowedRoles={["AuditeeOwner"]}>
                        <AuditeeOwnerScanQR />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/auditee-owner/audit-schedule"
                element={
                    <ProtectedRoute allowedRoles={["AuditeeOwner"]}>
                        <AuditScheduleCalendar />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/auditee-owner/my-witnessed"
                element={
                    <ProtectedRoute allowedRoles={["AuditeeOwner"]}>
                        <AuditeeOwnerMyWitnessed />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/auditee-owner/my-witnessed/audit/:auditId"
                element={
                    <ProtectedRoute allowedRoles={["AuditeeOwner"]}>
                        <AuditeeOwnerWitnessedAuditFindings />
                    </ProtectedRoute>
                }
            />

            {/* Protected routes - Director */}
            <Route
                path={ROUTES.DIRECTOR}
                element={
                    <ProtectedRoute allowedRoles={["Director"]}>
                        <Navigate to="/director/dashboard" replace />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/director/dashboard"
                element={
                    <ProtectedRoute allowedRoles={["Director"]}>
                        <DirectorDashboard />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/director/review-plans"
                element={
                    <ProtectedRoute allowedRoles={["Director"]}>
                        <DirectorReviewAuditPlans />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/director/review-plans/:planId"
                element={
                    <ProtectedRoute allowedRoles={["Director"]}>
                        <DirectorAuditPlanDetail />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/director/review-results"
                element={
                    <ProtectedRoute allowedRoles={["Director"]}>
                        <DirectorReviewAuditResults />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/director/summary-report"
                element={
                    <ProtectedRoute allowedRoles={["Director"]}>
                        <DirectorSummaryReport />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/director/final-summary"
                element={
                    <ProtectedRoute allowedRoles={["Director"]}>
                        <DirectorFinalSummaryPage />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/director/extension-requests"
                element={
                    <ProtectedRoute allowedRoles={["Director"]}>
                        <DirectorExtensionRequests />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/director/archived-history"
                element={
                    <ProtectedRoute allowedRoles={["Director"]}>
                        <ArchivedHistory />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/director/result-history"
                element={
                    <ProtectedRoute allowedRoles={["Director"]}>
                        <DirectorResultHistory />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/lead-auditor/auditplanning"
                element={
                    <ProtectedRoute allowedRoles={["Lead Auditor"]}>
                        <LeadAuditorAuditPlanning />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/lead-auditor/dashboard"
                element={
                    <ProtectedRoute allowedRoles={["Lead Auditor"]}>
                        <LeadAuditorDashboard />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/lead-auditor/auditplanning/:auditId"
                element={
                    <ProtectedRoute allowedRoles={["Lead Auditor"]}>
                        <LeadAuditorAuditDetail />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/lead-auditor/specify-create-plan"
                element={
                    <ProtectedRoute allowedRoles={["Lead Auditor"]}>
                        <LeadAuditorSpecifyCreatePlan />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/auditor/plan-assignments"
                element={
                    <ProtectedRoute allowedRoles={["Auditor"]}>
                        <AuditorPlanAssignments />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/lead-auditor/lead-reports"
                element={
                    <ProtectedRoute allowedRoles={["Lead Auditor"]}>
                        <LeadAuditorLeadReports />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/lead-auditor/action-review"
                element={
                    <ProtectedRoute allowedRoles={["Lead Auditor"]}>
                        <LeadAuditorActionReview />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/lead-auditor/archived-history"
                element={
                    <ProtectedRoute allowedRoles={["Lead Auditor"]}>
                        <ArchivedHistory />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/lead-auditor/final-summary-review"
                element={
                    <ProtectedRoute allowedRoles={["Lead Auditor"]}>
                        <LeadAuditorFinalSummaryReviewPage />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/lead-auditor/request-management"
                element={
                    <ProtectedRoute allowedRoles={["Lead Auditor"]}>
                        <LeadAuditorRequestManagement />
                    </ProtectedRoute>
                }
            />

            {/* Profile - accessible to all authenticated users */}
            <Route
                path="/profile"
                element={
                    <ProtectedRoute>
                        <Profile />
                    </ProtectedRoute>
                }
            />

            {/* Root route - redirect to login or user's dashboard */}
            <Route
                path={ROUTES.HOME}
                element={<Navigate to={getDefaultRoute()} replace />}
            />

            {/* Catch all - redirect to login or user's dashboard */}
            <Route path="*" element={<Navigate to={getDefaultRoute()} replace />} />
        </Routes>
    );
}
