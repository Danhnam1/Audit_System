import { useEffect, useState } from 'react';
import { MainLayout } from '../../../layouts';
import { toast } from 'react-toastify';
import { getPassThreshold, updatePassThreshold } from '../../../api/passThreshold';
import type { PassThresholdResponse } from '../../../api/passThreshold';

type ThresholdForm = {
  passThreshold: string;
  majorThreshold: string;
  mediumThreshold: string;
  minorThreshold: string;
  maxFailMajor: string;
  maxFailMedium: string;
  maxFailMinor: string;
};

const AdminPassThresholdPage = () => {
  const [form, setForm] = useState<ThresholdForm>({
    passThreshold: '',
    majorThreshold: '',
    mediumThreshold: '',
    minorThreshold: '',
    maxFailMajor: '',
    maxFailMedium: '',
    maxFailMinor: '',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const toStringVal = (v?: number | null) => (v === null || v === undefined ? '' : String(v));
  const toNumberOrNull = (v: string) => {
    const trimmed = v.trim();
    if (trimmed === '') return null;
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : null;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const res: PassThresholdResponse = await getPassThreshold();
      setForm({
        passThreshold: toStringVal(res.passThreshold ?? res.threshold),
        majorThreshold: toStringVal(res.majorThreshold),
        mediumThreshold: toStringVal(res.mediumThreshold),
        minorThreshold: toStringVal(res.minorThreshold),
        maxFailMajor: toStringVal(res.maxFailMajor),
        maxFailMedium: toStringVal(res.maxFailMedium),
        maxFailMinor: toStringVal(res.maxFailMinor),
      });
    } catch (err: any) {
      toast.error('Failed to load pass threshold');
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updatePassThreshold({
        passThreshold: toNumberOrNull(form.passThreshold),
        majorThreshold: toNumberOrNull(form.majorThreshold),
        mediumThreshold: toNumberOrNull(form.mediumThreshold),
        minorThreshold: toNumberOrNull(form.minorThreshold),
        maxFailMajor: toNumberOrNull(form.maxFailMajor),
        maxFailMedium: toNumberOrNull(form.maxFailMedium),
        maxFailMinor: toNumberOrNull(form.maxFailMinor),
      });
      toast.success('Pass threshold updated');
      loadData();
    } catch (err: any) {
      toast.error('Failed to update pass threshold');
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Pass Threshold</h1>
            <p className="text-sm text-gray-500 mt-1">Configure passing thresholds and fail limits.</p>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className={`px-4 py-2 rounded-lg text-sm font-medium border ${
              loading ? 'text-gray-400 border-gray-200 cursor-not-allowed' : 'text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Pass threshold on its own row */}
          <div className="flex flex-col bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Passing Percentage</h3>
            <div className="flex flex-col md:flex-row md:items-end md:gap-6">
              <div className="flex-1 max-w-xs">
                <label className="text-sm font-medium text-gray-700">Pass Threshold (%)</label>
                <input
                  name="passThreshold"
                  type="number"
                  value={form.passThreshold}
                  onChange={handleChange}
                  className="mt-1 px-3 py-2 border rounded-lg w-full focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="e.g., 80"
                />
                <p className="text-xs text-gray-500 mt-1">Percentage required to pass (e.g. 80%).</p>
              </div>
            </div>
          </div>

          {/* Major / Medium / Minor thresholds on one row */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Severity Findings</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700">Major Threshold (score)</label>
                <input
                  name="majorThreshold"
                  type="number"
                  value={form.majorThreshold}
                  onChange={handleChange}
                  className="mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="e.g., 100"
                />
                
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700">Medium Threshold (score)</label>
                <input
                  name="mediumThreshold"
                  type="number"
                  value={form.mediumThreshold}
                  onChange={handleChange}
                  className="mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="e.g., 100"
                />
                
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700">Minor Threshold (score)</label>
                <input
                  name="minorThreshold"
                  type="number"
                  value={form.minorThreshold}
                  onChange={handleChange}
                  className="mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="e.g., 100"
                />
                
              </div>
            </div>
          </div>

          {/* Max fail limits */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Max Fail Limits</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700">Max Fail Major</label>
                <input
                  name="maxFailMajor"
                  type="number"
                  value={form.maxFailMajor}
                  onChange={handleChange}
                  className="mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="optional"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700">Max Fail Medium</label>
                <input
                  name="maxFailMedium"
                  type="number"
                  value={form.maxFailMedium}
                  onChange={handleChange}
                  className="mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="optional"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700">Max Fail Minor</label>
                <input
                  name="maxFailMinor"
                  type="number"
                  value={form.maxFailMinor}
                  onChange={handleChange}
                  className="mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="optional"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-5 py-2 rounded-lg text-sm font-semibold text-white ${
              saving ? 'bg-primary-300 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700'
            }`}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </MainLayout>
  );
};

export default AdminPassThresholdPage;

