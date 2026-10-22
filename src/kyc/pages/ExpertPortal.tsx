// Expert Portal - Profile Completion & KYC Upload
import React, { useState, useEffect } from 'react';
import { authService, expertProfileService, kycDocumentService, profilePhotoService, notificationService } from '../kycService';
import { useNavigate } from 'react-router-dom';

export default function ExpertPortal() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [expertProfile, setExpertProfile] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    bio: '',
    skills: '',
    experienceYears: '',
    photo: null as File | null
  });

  const [documents, setDocuments] = useState<any[]>([]);

  useEffect(() => {
    loadUserData();
    loadNotifications();
  }, []);

  const loadUserData = async () => {
    try {
      const currentUser = await authService.getCurrentUser();
      if (!currentUser) {
        navigate('/login');
        return;
      }
      setUser(currentUser);

      const profile = await expertProfileService.getExpertProfile(currentUser.id);
      setExpertProfile(profile);

      if (profile) {
        setFormData({
          bio: profile.bio || '',
          skills: profile.skills?.join(', ') || '',
          experienceYears: profile.experience_years?.toString() || '',
          photo: null
        });

        const docs = await kycDocumentService.getExpertDocuments(profile.id);
        setDocuments(docs);
      }
    } catch (err) {
      console.error('Error loading user data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadNotifications = async () => {
    if (!user) return;
    try {
      const notifs = await notificationService.getNotifications(user.id);
      setNotifications(notifs);
    } catch (err) {
      console.error('Error loading notifications:', err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData({ ...formData, photo: file });
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    const file = e.target.files?.[0];
    if (!file || !expertProfile) return;

    setUploading(true);
    try {
      await kycDocumentService.uploadDocument(file, expertProfile.id, docType);
      alert('Document uploaded successfully');
      const docs = await kycDocumentService.getExpertDocuments(expertProfile.id);
      setDocuments(docs);
    } catch (err: any) {
      alert(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handlePhotoUpload = async () => {
    if (!formData.photo || !user) return;

    setUploading(true);
    try {
      const photoUrl = await profilePhotoService.uploadProfilePhoto(formData.photo, user.id);
      await expertProfileService.updateExpertProfile(expertProfile.id, { photo_url: photoUrl });
      alert('Profile photo uploaded successfully');
      loadUserData();
    } catch (err: any) {
      alert(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!expertProfile) return;

    setUploading(true);
    try {
      await expertProfileService.updateExpertProfile(expertProfile.id, {
        bio: formData.bio,
        skills: formData.skills.split(',').map(s => s.trim()).filter(Boolean),
        experience_years: parseInt(formData.experienceYears) || 0
      });
      alert('Profile saved successfully');
    } catch (err: any) {
      alert(err.message || 'Save failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmitForReview = async () => {
    if (!expertProfile) return;

    if (!formData.bio || !formData.skills || documents.length === 0) {
      alert('Please complete your profile and upload at least one KYC document');
      return;
    }

    setUploading(true);
    try {
      await expertProfileService.submitForReview(expertProfile.id);
      alert('Profile submitted for review');
      loadUserData();
    } catch (err: any) {
      alert(err.message || 'Submission failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      await kycDocumentService.deleteDocument(docId);
      alert('Document deleted');
      const docs = await kycDocumentService.getExpertDocuments(expertProfile.id);
      setDocuments(docs);
    } catch (err: any) {
      alert(err.message || 'Delete failed');
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Loading...</div>;
  }

  const statusSteps = [
    { key: 'pending_verification', label: 'Pending Verification' },
    { key: 'submitted', label: 'Submitted' },
    { key: 'under_review', label: 'Under Review' },
    { key: 'approved', label: 'Approved' },
    { key: 'changes_requested', label: 'Changes Requested' },
    { key: 'rejected', label: 'Rejected' }
  ];

  const currentStatusIndex = statusSteps.findIndex(s => s.key === expertProfile?.status);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Expert Portal</h1>
          <div className="flex items-center gap-4">
            <div className="relative">
              <button className="p-2 hover:bg-gray-700 rounded-full">
                🔔 {notifications.filter(n => !n.is_read).length}
              </button>
            </div>
            <button
              onClick={() => authService.signOut().then(() => navigate('/login'))}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Status Tracker */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Application Status</h2>
          <div className="flex items-center justify-between">
            {statusSteps.map((step, index) => (
              <div key={step.key} className="flex-1 text-center">
                <div
                  className={`w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center ${
                    index <= currentStatusIndex
                      ? 'bg-green-500'
                      : 'bg-gray-600'
                  }`}
                >
                  {index < currentStatusIndex ? '✓' : index + 1}
                </div>
                <p className="text-sm">{step.label}</p>
              </div>
            ))}
          </div>
          {expertProfile?.admin_comments && (
            <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500 rounded">
              <p className="text-yellow-500">{expertProfile.admin_comments}</p>
            </div>
          )}
        </div>

        {/* Profile Form */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Complete Your Profile</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 mb-2">Profile Photo</label>
                <div className="flex items-center gap-4">
                  {expertProfile?.photo_url && (
                    <img
                      src={expertProfile.photo_url}
                      alt="Profile"
                      className="w-20 h-20 rounded-full object-cover"
                    />
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={handleFileChange}
                    className="flex-1"
                  />
                  <button
                    onClick={handlePhotoUpload}
                    disabled={!formData.photo || uploading}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
                  >
                    Upload
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-gray-300 mb-2">Bio</label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  rows={4}
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-2">Skills (comma-separated)</label>
                <input
                  type="text"
                  value={formData.skills}
                  onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="e.g., React, Node.js, Python"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-2">Years of Experience</label>
                <input
                  type="number"
                  value={formData.experienceYears}
                  onChange={(e) => setFormData({ ...formData, experienceYears: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleSaveProfile}
                  disabled={uploading}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
                >
                  Save Profile
                </button>
                {expertProfile?.status === 'pending_verification' || expertProfile?.status === 'changes_requested' ? (
                  <button
                    onClick={handleSubmitForReview}
                    disabled={uploading}
                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded disabled:opacity-50"
                  >
                    Submit for Review
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {/* KYC Documents */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">KYC Documents</h2>

            <div className="space-y-4">
              {['id_proof', 'address_proof', 'qualification_certificate', 'experience_certificate'].map(docType => (
                <div key={docType} className="flex items-center gap-4">
                  <label className="w-48 text-gray-300 capitalize">
                    {docType.replace('_', ' ')}
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleDocumentUpload(e, docType)}
                    disabled={uploading}
                    className="flex-1"
                  />
                </div>
              ))}

              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-2">Uploaded Documents</h3>
                {documents.length === 0 ? (
                  <p className="text-gray-400">No documents uploaded yet</p>
                ) : (
                  <ul className="space-y-2">
                    {documents.map(doc => (
                      <li key={doc.id} className="flex items-center justify-between bg-gray-700 p-3 rounded">
                        <span className="capitalize">{doc.doc_type.replace('_', ' ')}</span>
                        <button
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          Delete
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
