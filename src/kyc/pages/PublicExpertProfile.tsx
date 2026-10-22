// Public Expert Profile Page
import React, { useState, useEffect } from 'react';
import { expertProfileService } from '../kycService';
import { useParams, useNavigate } from 'react-router-dom';

export default function PublicExpertProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [expert, setExpert] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExpert();
  }, [id]);

  const loadExpert = async () => {
    if (!id) return;

    setLoading(true);
    try {
      const profile = await expertProfileService.getExpertProfileById(id);
      if (!profile || profile.status !== 'approved') {
        navigate('/experts'); // Redirect if not approved
        return;
      }
      setExpert(profile);
    } catch (err) {
      console.error('Error loading expert:', err);
      navigate('/experts');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Loading...</div>;
  }

  if (!expert) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Expert not found</div>;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <button
            onClick={() => navigate('/experts')}
            className="text-blue-400 hover:text-blue-300"
          >
            ← Back to Experts
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Profile Header */}
        <div className="bg-gray-800 rounded-lg p-8 mb-8">
          <div className="flex items-start gap-8">
            {expert.photo_url && (
              <img
                src={expert.photo_url}
                alt={expert.profiles?.full_name}
                className="w-32 h-32 rounded-full object-cover"
              />
            )}
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2">{expert.profiles?.full_name}</h1>
              <p className="text-gray-400 mb-4 capitalize">{expert.expertise_area}</p>
              <div className="flex items-center gap-4 mb-4">
                <span className="px-3 py-1 bg-green-500 rounded-full text-sm">Verified Expert</span>
                <span className="text-gray-400">{expert.experience_years} years experience</span>
              </div>
              <p className="text-gray-300">{expert.bio}</p>
            </div>
          </div>
        </div>

        {/* Skills */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Skills</h2>
          <div className="flex flex-wrap gap-2">
            {expert.skills?.map((skill: string) => (
              <span key={skill} className="px-3 py-1 bg-blue-600 rounded-full text-sm">
                {skill}
              </span>
            ))}
          </div>
        </div>

        {/* Contact CTA */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Book a Session</h2>
          <p className="text-gray-400 mb-4">
            Connect with {expert.profiles?.full_name} for expert consultation and project reviews.
          </p>
          <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold">
            Book Now
          </button>
        </div>
      </div>
    </div>
  );
}
