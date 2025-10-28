import React from 'react';
import { getBadgeVariant, getPriorityColor, getStatusColor } from '../../../../constants';
import type { RequestItem } from './types';

type RequestDetailsModalProps = {
  open: boolean;
  request: RequestItem | null;
  onClose: () => void;
};

export const RequestDetailsModal: React.FC<RequestDetailsModalProps> = ({ open, request, onClose }) => {
  if (!open || !request) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-primary px-6 py-4 border-b border-primary-100">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xl font-semibold text-white">Request Details</h3>
              <p className="text-sm text-primary-100 mt-1">{request.id} - {request.type}</p>
            </div>
            <button onClick={onClose} className="text-white hover:text-primary-100 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h4 className="text-base font-semibold text-gray-900 mb-3">Basic Information</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-600 mb-1">Title</p>
                <p className="text-sm font-medium text-gray-900">{request.title}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Type</p>
                <p className="text-sm font-medium text-gray-900">{request.type}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Requested By</p>
                <p className="text-sm font-medium text-gray-900">{request.requestedBy}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Department</p>
                <p className="text-sm font-medium text-gray-900">{request.department}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Priority</p>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPriorityColor(request.priority)}`}>
                  {request.priority}
                </span>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Status</p>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                  {request.status}
                </span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h4 className="text-base font-semibold text-gray-900 mb-3">Description</h4>
            <p className="text-sm text-gray-700">{request.description}</p>
          </div>

          {/* Details */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h4 className="text-base font-semibold text-gray-900 mb-3">Request Details</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-600 mb-1">Scope</p>
                <p className="text-sm font-medium text-gray-900">{request.scope}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-2">Standards</p>
                <div className="flex gap-2 flex-wrap">
                  {request.standards.map((std, i) => (
                    <span key={i} className={`px-2 py-1 text-xs rounded-full font-medium ${getBadgeVariant('primary-light')}`}>
                      {std}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Request Date</p>
                <p className="text-sm font-medium text-gray-900">{request.requestDate}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Due Date</p>
                <p className="text-sm font-medium text-gray-900">{request.dueDate}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium transition-colors"
          >
            Close
          </button>
          {request.status === 'Pending Review' && (
            <>
              <button className="flex-1 btn-primary">Approve Request</button>
              <button className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium transition-colors">
                Reject
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RequestDetailsModal;
