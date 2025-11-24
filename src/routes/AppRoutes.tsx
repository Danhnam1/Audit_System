import { lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ROUTES } from "../constants";
import useAuthStore from "../store/useAuthStore";
import { ProtectedRoute } from "../components";

// Lazy load all pages
const LoginPage = lazy(() => import("../pages/Auth/LoginPage"));

// Admin pages
const AdminDashboard = lazy(() => import("../pages/Admin/Dashboard"));
const AdminUserManagement = lazy(() => import("../pages/Admin/UserManagement"));
const AdminDepartmentManagement = lazy(() => import("../pages/Admin/DepartmentManagement"));
const AdminBackupRestore = lazy(() => import("../pages/Admin/BackupRestore"));

// Auditor pages
const SQAStaffDashboard = lazy(() => import("../pages/Auditor/Dashboard"));
const SQAStaffAuditPlanning = lazy(() => import("../pages/Auditor/AuditPlanning"));
const SQAStaffAuditTeam = lazy(() => import("../pages/Auditor/AuditTeam"));
const SQAStaffFindingManagement = lazy(() => import("../pages/Auditor/FindingManagement"));
const SQAStaffAuditExecutionDetail = lazy(() => import("../pages/Auditor/FindingManagement/AuditExecutionDetail"));
const SQAStaffDepartmentChecklist = lazy(() => import("../pages/Auditor/FindingManagement/DepartmentChecklist"));
const SQAStaffReports = lazy(() => import("../pages/Auditor/Reports"));
const SQAStaffAuditReview = lazy(() => import("../pages/Auditor/AuditReview"));
const SQAStaffLeadReports = lazy(() => import("../pages/Auditor/LeadReports"));
const SQAStaffRequests = lazy(() => import("../pages/Auditor/Requests"));
const SQAStaffReviewFindings = lazy(() => import("../pages/Auditor/Requests/ReviewFindings"));
const SQAStaffReviewFindingDetail = lazy(() => import("../pages/Auditor/Requests/ReviewFindingDetail"));
const SQAStaffHistoryUpload = lazy(() => import("../pages/Auditor/HistoryUpload"));

// Lead Auditor pages
const LeadAuditorAuditAssignment = lazy(() => import("../pages/LeadAuditor/AuditAssignment"));

// CAPA Owner pages (formerly Department Staff)
const DepartmentStaffDashboard = lazy(() => import("../pages/CAPAOwner/Dashboard"));
const DepartmentStaffAssignedTasks = lazy(() => import("../pages/CAPAOwner/AssignedTasks"));
const DepartmentStaffTaskDetail = lazy(() => import("../pages/CAPAOwner/TaskDetail"));
const DepartmentStaffUploadEvidence = lazy(() => import("../pages/CAPAOwner/UploadEvidence"));
const DepartmentStaffTodoList = lazy(() => import("../pages/CAPAOwner/TodoList"));
const DepartmentStaffFindingsProgress = lazy(() => import("../pages/CAPAOwner/FindingsProgress"));
const DepartmentStaffCheckDeadlines = lazy(() => import("../pages/CAPAOwner/CheckDeadlines"));

// Auditee Owner pages (formerly Department Head)
const DepartmentHeadWelcome = lazy(() => import("../pages/AuditeeOwner/Welcome"));
const DepartmentHeadAuditPlans = lazy(() => import("../pages/AuditeeOwner/auditplan/AuditPlans"));
const DepartmentHeadAuditPlanDetail = lazy(() => import("../pages/AuditeeOwner/auditplan/AuditPlanDetail"));
const DepartmentHeadAuditPlanConfirm = lazy(() => import("../pages/AuditeeOwner/auditplan/AuditPlanConfirm"));
const DepartmentHeadAssignTasks = lazy(() => import("../pages/AuditeeOwner/taskasign/AssignTasks"));
const DepartmentHeadFindingsList = lazy(() => import("../pages/AuditeeOwner/findings/FindingsList"));
const DepartmentHeadAssignStaff = lazy(() => import("../pages/AuditeeOwner/taskasign/AssignStaff"));
const DepartmentHeadReviewEvidence = lazy(() => import("../pages/AuditeeOwner/ReviewEvidence"));
const DepartmentHeadEvidenceDetail = lazy(() => import("../pages/AuditeeOwner/EvidenceDetail"));
const DepartmentHeadFindingsProgress = lazy(() => import("../pages/AuditeeOwner/findings/FindingsProgress"));

// Director pages
const DirectorDashboard = lazy(() => import("../pages/Director/Dashboard"));
const DirectorReviewAuditPlans = lazy(() => import("../pages/Director/ReviewAuditPlans"));
const DirectorAuditPlanDetail = lazy(() => import("../pages/Director/AuditPlanDetail"));
const DirectorReviewAuditResults = lazy(() => import("../pages/Director/ReviewAuditResults"));
const DirectorSummaryReport = lazy(() => import("../pages/Director/SummaryReport"));


// AppRoutes component - chỉ chứa các route definitions
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
            capaowner: ROUTES.CAPA_OWNER,
            auditeeowner: ROUTES.AUDITEE_OWNER,
            director: ROUTES.DIRECTOR,
        };

        // Debug log để xem user role
        console.log('Current user:', user);
        const rawRole = (user?.role || user?.roleName || '');
        const normalized = String(rawRole).toLowerCase().replace(/\s+/g, '');
        console.log('Original role:', rawRole, '\nNormalized role:', normalized);

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
                        <AdminDashboard />
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
                path="/admin/backup"
                element={
                    <ProtectedRoute allowedRoles={["Admin"]}>
                        <AdminBackupRestore />
                    </ProtectedRoute>
                }
            />

            {/* Protected routes - Auditor */}
            <Route
                path={ROUTES.AUDITOR}
                element={
                    <ProtectedRoute allowedRoles={["Auditor"]}>
                        <SQAStaffDashboard />
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
            <Route
                path="/auditor/lead-reports"
                element={
                    <ProtectedRoute allowedRoles={["Auditor"]}>
                        <SQAStaffLeadReports />
                    </ProtectedRoute>
                }
            />
            <Route
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
            />
            <Route
                path="/auditor/history-upload"
                element={
                    <ProtectedRoute allowedRoles={["Auditor"]}>
                        <SQAStaffHistoryUpload />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/auditor/audit-assignment"
                element={
                    <ProtectedRoute allowedRoles={["Auditor"]}>
                        <LeadAuditorAuditAssignment />
                    </ProtectedRoute>
                }
            />


            {/* Protected routes - CAPA Owner */}
            <Route
                path={ROUTES.CAPA_OWNER}
                element={
                    <ProtectedRoute allowedRoles={["CAPAOwner"]}>
                        <DepartmentStaffDashboard />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/capa-owner/tasks"
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
        

            {/* Protected routes - Auditee Owner */}
            <Route
                path={ROUTES.AUDITEE_OWNER}
                element={
                    <ProtectedRoute allowedRoles={["AuditeeOwner"]}>
                        <DepartmentHeadWelcome />
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
                        <DepartmentHeadFindingsProgress />
                    </ProtectedRoute>
                }
            />

            {/* Protected routes - Director */}
            <Route
                path={ROUTES.DIRECTOR}
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
