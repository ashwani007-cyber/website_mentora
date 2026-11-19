// Admin Dashboard - KYC Review
import React, { useState, useEffect } from 'react';
import { expertProfileService, kycDocumentService, adminService, statusHistoryService, profileService } from '../kycService';

export default function AdminDashboard() {
  const [experts, setExperts] = useState<any[]>([]);
  const [selectedExpert, setSelectedExpert] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [statusHistory, setStatusHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [comment, setComment] = useState('');

  useEffect(() => {
    loadExperts();
  }, [filter]);

  const loadExperts = async () => {
    setLoading(true);
    try {
      const data = filter === 'all'
        ? await expertProfileService.getAllExpertProfiles()
        : await expertProfileService.getAllExpertProfiles(filter);
      setExperts(data);
    } catch (err) {
      console.error('Error loading experts:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectExpert = async (expert: any) => {
    setSelectedExpert(expert);
    setComment('');

    try {
      const docs = await kycDocumentService.getExpertDocuments(expert.id);
      setDocuments(docs);

      const history = await statusHistoryService.getStatusHistory(expert.id);
      setStatusHistory(history);
    } catch (err) {
      console.error('Error loading expert details:', err);
    }
  };

  const handleAction = async (action: 'approve' | 'reject' | 'request_changes' | 'start_review') => {
    if (!selectedExpert) return;

    setActionLoading(true);
    try {
      const currentUser = await profileService.getProfile(selectedExpert.user_id);
      if (!currentUser) throw new Error('User not found');

      switch (action) {
        case 'approve':
          await adminService.approveExpert(selectedExpert.id, currentUser.id, comment);
          break;
        case 'reject':
          if (!comment) {
            alert('Please provide a reason for rejection');
            return;
          }
          await adminService.rejectExpert(selectedExpert.id, currentUser.id, comment);
          break;
        case 'request_changes':
          if (!comment) {
            alert('Please provide comments for the requested changes');
            return;
          }
          await adminService.requestChanges(selectedExpert.id, currentUser.id, comment);
          break;
        case 'start_review':
          await adminService.startReview(selectedExpert.id, currentUser.id);
          break;
      }

      alert('Action completed successfully');
      loadExperts();
      selectExpert(selectedExpert);
    } catch (err: any) {
      alert(err.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const getSignedUrl = async (filePath: string) => {
    try {
      const url = await kycDocumentService.getSignedUrl(filePath);
      window.open(url, '_blank');
    } catch (err: any) {
      alert(err.message || 'Failed to open document');
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">Admin Dashboard - KYC Review</h1>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Filter */}
        <div className="mb-6">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
          >
            <option value="all">All Status</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under Review</option>
            <option value="approved">Approved</option>
            <option value="changes_requested">Changes Requested</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Expert List */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Expert Profiles ({experts.length})</h2>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {experts.map(expert => (
                <div
                  key={expert.id}
                  onClick={() => selectExpert(expert)}
                  className={`p-4 rounded cursor-pointer transition ${
                    selectedExpert?.id === expert.id
                      ? 'bg-blue-600'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{expert.profiles?.full_name}</p>
                      <p className="text-sm text-gray-300">{expert.profiles?.email}</p>
                      <p className="text-sm text-gray-400 capitalize">{expert.expertise_area}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs capitalize ${
                      expert.status === 'approved' ? 'bg-green-500' :
                      expert.status === 'rejected' ? 'bg-red-500' :
                      expert.status === 'under_review' ? 'bg-yellow-500' :
                      'bg-gray-500'
                    }`}>
                      {expert.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Expert Details & Actions */}
          {selectedExpert && (
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Expert Details</h2>

              <div className="space-y-4 mb-6">
                <div>
                  <p className="text-gray-400">Name</p>
                  <p className="font-semibold">{selectedExpert.profiles?.full_name}</p>
                </div>
                <div>
                  <p className="text-gray-400">Email</p>
                  <p>{selectedExpert.profiles?.email}</p>
                </div>
                <div>
                  <p className="text-gray-400">Phone</p>
                  <p>{selectedExpert.profiles?.phone || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-400">Expertise Area</p>
                  <p className="capitalize">{selectedExpert.expertise_area}</p>
                </div>
                <div>
                  <p className="text-gray-400">Bio</p>
                  <p>{selectedExpert.bio || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-400">Skills</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedExpert.skills?.map((skill: string) => (
                      <span key={skill} className="px-2 py-1 bg-gray-700 rounded text-sm">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-gray-400">Experience</p>
                  <p>{selectedExpert.experience_years} years</p>
                </div>
              </div>

              {/* KYC Documents */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2">KYC Documents</h3>
                {documents.length === 0 ? (
                  <p className="text-gray-400">No documents uploaded</p>
                ) : (
                  <div className="space-y-2">
                    {documents.map(doc => (
                      <div key={doc.id} className="flex items-center justify-between bg-gray-700 p-3 rounded">
                        <span className="capitalize">{doc.doc_type.replace('_', ' ')}</span>
                        <button
                          onClick={() => getSignedUrl(doc.file_path)}
                          className="text-blue-400 hover:text-blue-300"
                        >
                          View
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Status History */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2">Status History</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {statusHistory.map((history, index) => (
                    <div key={history.id} className="text-sm bg-gray-700 p-2 rounded">
                      <p className="font-semibold">
                        {history.old_status || 'Initial'} → {history.new_status}
                      </p>
                      <p className="text-gray-400">{new Date(history.changed_at).toLocaleString()}</p>
                      {history.comment && <p className="text-gray-300">{history.comment}</p>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-4">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add comments (required for rejection/changes requested)"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  rows={3}
                />

                <div className="grid grid-cols-2 gap-4">
                  {selectedExpert.status === 'submitted' && (
                    <button
                      onClick={() => handleAction('start_review')}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded disabled:opacity-50"
                    >
                      Start Review
                    </button>
                  )}

                  {selectedExpert.status === 'under_review' && (
                    <>
                      <button
                        onClick={() => handleAction('approve')}
                        disabled={actionLoading}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleAction('request_changes')}
                        disabled={actionLoading}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
                      >
                        Request Changes
                      </button>
                      <button
                        onClick={() => handleAction('reject')}
                        disabled={actionLoading}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
