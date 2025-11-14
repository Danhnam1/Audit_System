import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuditFindings } from '../../../hooks/useAuditFindings';
import type { ChecklistItem, ResultType } from './Components/types';

const AuditExecutionDetail = () => {
  const { id: auditId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  const {
    loading,
    error,
    fetchChecklistItems,
    createFindingFromChecklistItem,
  } = useAuditFindings();

  const [auditPlan, setAuditPlan] = useState<any>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [showCreateFinding, setShowCreateFinding] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ChecklistItem | null>(null);
  const [findingForm, setFindingForm] = useState({
    title: '',
    description: '',
    severity: 'Minor',
    rootCauseId: undefined as number | undefined,
    deptId: undefined as number | undefined,
    status: 'Open',
    deadline: '',
  });

  // Load audit plan and checklist items
  useEffect(() => {
    const loadAuditData = async () => {
      if (!auditId) {
        console.error('No audit ID provided');
        return;
      }

      try {
        // Fetch single audit plan with full details
        const { getAuditPlanById } = await import('../../../api/audits');
        const plan = await getAuditPlanById(auditId);
        console.log('Loaded audit plan:', plan);
        setAuditPlan(plan);

        // Fetch checklist items
        const items = await fetchChecklistItems(auditId);
        console.log('Loaded checklist items:', items);
        
        const transformedItems = transformChecklistItems(items);
        console.log('Transformed checklist items:', transformedItems);
        setChecklist(transformedItems);
      } catch (err) {
        console.error('Error loading audit data:', err);
      }
    };

    if (auditId) {
      loadAuditData();
    }
  }, [auditId, fetchChecklistItems]);

  const transformChecklistItems = (apiItems: any[]): ChecklistItem[] => {
    return apiItems.map((item, index) => ({
      id: index + 1,
      item: item.questionTextSnapshot || item.itemDescription || item.description || 'N/A',
      standardRef: item.standardRef || item.standard || item.section || 'N/A',
      category: item.section || item.category || 'General',
      criticality: (item.criticality || item.severity || 'Medium') as 'Low' | 'Medium' | 'High',
      result: null,
      remarks: item.comment || '',
      apiData: item,
    }));
  };

  const setItemResult = (id: number, result: ResultType) => {
    setChecklist(prev => prev.map(it => 
      it.id === id ? { ...it, result } : it
    ));

    // If Non-compliant, open finding creation
    if (result === 'Non-compliant') {
      const item = checklist.find(it => it.id === id);
      if (item) {
        handleCreateFinding(item);
      }
    }
  };

  const setItemRemarks = (id: number, remarks: string) => {
    setChecklist(prev => prev.map(it => 
      it.id === id ? { ...it, remarks } : it
    ));
  };

  const handleCreateFinding = (item: ChecklistItem) => {
    setSelectedItem(item);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 7); // Default 7 days deadline
    
    setFindingForm({
      title: `Non-compliance: ${item.item}`,
      description: '',
      severity: 'Minor',
      rootCauseId: undefined,
      deptId: undefined,
      status: 'Open',
      deadline: tomorrow.toISOString().split('T')[0],
    });
    setShowCreateFinding(true);
  };

  const handleSaveFinding = async () => {
    if (!selectedItem || !findingForm.title.trim() || !findingForm.description.trim()) {
      alert('Please enter finding title and description');
      return;
    }

    try {
      console.log('Full auditPlan object:', auditPlan);
      console.log('scopeDepartments:', auditPlan?.scopeDepartments);
      
      // Get deptId from audit plan's scopeDepartments or from user input
      let deptId = findingForm.deptId; // User input has priority
      
      if (!deptId) {
        // Try to get from scopeDepartments with multiple possible structures
        const scopeDepts = auditPlan?.scopeDepartments?.$values 
          || auditPlan?.scopeDepartments?.values 
          || (Array.isArray(auditPlan?.scopeDepartments) ? auditPlan.scopeDepartments : null);
          
        console.log('Extracted scopeDepts:', scopeDepts);
        
        if (Array.isArray(scopeDepts) && scopeDepts.length > 0) {
          deptId = scopeDepts[0].deptId;
          console.log('Auto-filled deptId from scopeDepartments:', deptId);
        } else {
          // Try getting from createdByUser
          deptId = auditPlan?.createdByUser?.deptId;
          console.log('Trying deptId from createdByUser:', deptId);
        }
      }

      if (!deptId) {
        alert('Please enter Department ID - cannot auto-detect from audit plan');
        console.error('auditPlan structure:', JSON.stringify(auditPlan, null, 2));
        return;
      }

      const payload = {
        auditId: auditId!,
        auditItemId: selectedItem.apiData.auditItemId,
        title: findingForm.title,
        description: findingForm.description,
        severity: findingForm.severity,
        rootCauseId: findingForm.rootCauseId || 0,
        deptId: deptId,
        status: findingForm.status,
        deadline: findingForm.deadline ? new Date(findingForm.deadline).toISOString() : new Date().toISOString(),
        reviewerId: null,
        source: '',
        externalAuditorName: '',
      };

      console.log('Creating finding with payload:', payload);
      const result = await createFindingFromChecklistItem(selectedItem.apiData, payload);

      if (result.success) {
        alert('Finding created successfully!');
        setShowCreateFinding(false);
        setSelectedItem(null);
        // Mark as Non-compliant
        setItemResult(selectedItem.id, 'Non-compliant');
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (err) {
      console.error('Error saving finding:', err);
      alert('Failed to save finding');
    }
  };

  const handleSubmit = () => {
    const unchecked = checklist.filter(it => !it.result);
    if (unchecked.length > 0) {
      alert(`Please complete all items. ${unchecked.length} remaining.`);
      return;
    }

    if (confirm('Submit audit execution?')) {
      navigate('/auditor/findings');
    }
  };

  const getCriticalityColor = (criticality: string) => {
    const map: Record<string, string> = {
      'High': 'bg-red-100 text-red-800',
      'Medium': 'bg-yellow-100 text-yellow-800',
      'Low': 'bg-green-100 text-green-800',
    };
    return map[criticality] || 'bg-gray-100 text-gray-800';
  };

  console.log('Render state:', { loading, checklistLength: checklist.length, checklist });

  if (loading && checklist.length === 0) {
    return (
      <MainLayout user={layoutUser}>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading audit execution...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout user={layoutUser}>
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-primary-600">
                {auditPlan?.title || auditPlan?.name || 'Audit Execution'}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {auditPlan?.auditId || auditId}
              </p>
            </div>
            <button
              onClick={() => navigate('/auditor/findings')}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium"
            >
              ← Back to List
            </button>
          </div>

          {/* Progress Stats */}
          <div className="grid grid-cols-4 gap-4 mt-4">
            <div className="bg-green-50 rounded-lg p-3 border border-green-200">
              <p className="text-xs text-green-700 font-medium">Compliant</p>
              <p className="text-2xl font-bold text-green-800">
                {checklist.filter(i => i.result === 'Compliant').length}
              </p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 border border-red-200">
              <p className="text-xs text-red-700 font-medium">Non-compliant</p>
              <p className="text-2xl font-bold text-red-800">
                {checklist.filter(i => i.result === 'Non-compliant').length}
              </p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
              <p className="text-xs text-yellow-700 font-medium">Observation</p>
              <p className="text-2xl font-bold text-yellow-800">
                {checklist.filter(i => i.result === 'Observation').length}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-xs text-gray-700 font-medium">Remaining</p>
              <p className="text-2xl font-bold text-gray-800">
                {checklist.filter(i => !i.result).length}
              </p>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Checklist Items */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-primary-600 to-primary-700 border-b">
            <h2 className="text-lg font-semibold text-white">Checklist Execution</h2>
            <p className="text-sm text-white opacity-90 mt-1">
              Evaluate each item and create findings for non-compliant items
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase w-16">No.</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Item</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase w-32">Section</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase w-24">Criticality</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase w-48">Result</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase w-32">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {checklist.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-gray-700">{item.id}</span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-900">{item.item}</p>
                      {item.remarks && (
                        <p className="text-xs text-gray-500 mt-1">{item.remarks}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCriticalityColor(item.criticality)}`}>
                        {item.criticality}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <label className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium cursor-pointer transition-colors ${
                          item.result === 'Compliant' 
                            ? 'bg-green-600 text-white' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}>
                          <input
                            type="radio"
                            name={`result-${item.id}`}
                            checked={item.result === 'Compliant'}
                            onChange={() => setItemResult(item.id, 'Compliant')}
                            className="w-3 h-3"
                          />
                          <span>Compliant</span>
                        </label>
                        <label className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium cursor-pointer transition-colors ${
                          item.result === 'Non-compliant' 
                            ? 'bg-red-600 text-white' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}>
                          <input
                            type="radio"
                            name={`result-${item.id}`}
                            checked={item.result === 'Non-compliant'}
                            onChange={() => setItemResult(item.id, 'Non-compliant')}
                            className="w-3 h-3"
                          />
                          <span>Non-compliant</span>
                        </label>
                        <label className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium cursor-pointer transition-colors ${
                          item.result === 'Observation' 
                            ? 'bg-yellow-500 text-white' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}>
                          <input
                            type="radio"
                            name={`result-${item.id}`}
                            checked={item.result === 'Observation'}
                            onChange={() => setItemResult(item.id, 'Observation')}
                            className="w-3 h-3"
                          />
                          <span>Observation</span>
                        </label>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => {
                          const remarks = prompt('Enter remarks/notes:', item.remarks);
                          if (remarks !== null) {
                            setItemRemarks(item.id, remarks);
                          }
                        }}
                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-medium"
                      >
                        Add Note
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-3">
          <button
            onClick={() => navigate('/auditor/findings')}
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={checklist.filter(i => !i.result).length > 0}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
          >
            Submit Execution
          </button>
        </div>

        {/* Create Finding Panel (Right Side) */}
        {showCreateFinding && selectedItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-end z-50">
            <div className="bg-white h-full w-full md:w-1/2 lg:w-1/3 shadow-2xl overflow-y-auto">
              <div className="sticky top-0 bg-primary-600 px-6 py-4 border-b border-gray-200 z-10">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">Create Finding</h3>
                  <button
                    onClick={() => setShowCreateFinding(false)}
                    className="text-white hover:text-gray-200 text-2xl font-bold"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-5">
                {/* Item Info Card */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border-l-4 border-blue-500">
                  <p className="text-xs font-medium text-blue-700 mb-1 uppercase tracking-wide">Checklist Item</p>
                  <p className="text-base font-semibold text-gray-900 mb-2">{selectedItem.item}</p>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 text-gray-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      {selectedItem.category}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getCriticalityColor(selectedItem.criticality)}`}>
                      {selectedItem.criticality}
                    </span>
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Finding Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={findingForm.title}
                    onChange={(e) => setFindingForm(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full border-2 border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                    placeholder="Enter finding title..."
                  />
                </div>

                {/* Severity */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Severity <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {(['Minor', 'Major', 'Critical'] as const).map(type => (
                      <button
                        key={type}
                        onClick={() => setFindingForm(prev => ({ ...prev, severity: type }))}
                        className={`px-4 py-3 rounded-lg border-2 font-semibold text-sm transition-all shadow-sm hover:shadow ${
                          findingForm.severity === type
                            ? type === 'Critical' ? 'border-red-600 bg-red-600 text-white shadow-red-200' :
                              type === 'Major' ? 'border-orange-500 bg-orange-500 text-white shadow-orange-200' :
                              'border-yellow-500 bg-yellow-500 text-white shadow-yellow-200'
                            : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={findingForm.description}
                    onChange={(e) => setFindingForm(prev => ({ ...prev, description: e.target.value }))}
                    rows={4}
                    className="w-full border-2 border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all resize-none"
                    placeholder="Describe the non-compliance in detail..."
                  />
                </div>

                {/* Status & Deadline Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      value={findingForm.status}
                      onChange={(e) => setFindingForm(prev => ({ ...prev, status: e.target.value }))}
                      className="w-full border-2 border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                    >
                      <option value="Open">Open</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Resolved">Resolved</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Deadline
                    </label>
                    <input
                      type="date"
                      value={findingForm.deadline}
                      onChange={(e) => setFindingForm(prev => ({ ...prev, deadline: e.target.value }))}
                      className="w-full border-2 border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                    />
                  </div>
                </div>

                {/* Optional IDs Section */}
                <div className="border-t pt-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Required Fields</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Department ID <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={findingForm.deptId || ''}
                        onChange={(e) => setFindingForm(prev => ({ ...prev, deptId: e.target.value ? parseInt(e.target.value) : undefined }))}
                        className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                        placeholder="Enter dept ID"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-2">
                        Root Cause ID
                      </label>
                      <input
                        type="number"
                        value={findingForm.rootCauseId || ''}
                        onChange={(e) => setFindingForm(prev => ({ ...prev, rootCauseId: e.target.value ? parseInt(e.target.value) : undefined }))}
                        className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t">
                  <button
                    onClick={() => setShowCreateFinding(false)}
                    className="flex-1 px-5 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-semibold transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveFinding}
                    disabled={!findingForm.title.trim() || !findingForm.description.trim()}
                    className="flex-1 px-5 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg hover:from-primary-700 hover:to-primary-800 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed font-semibold shadow-lg hover:shadow-xl transition-all"
                  >
                    💾 Save Finding
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default AuditExecutionDetail;
