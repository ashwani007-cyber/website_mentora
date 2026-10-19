import React, { useState } from 'react';
import { TrainingCourse } from '../types';
import { MOCK_TRAINING_COURSES } from '../data/mockData';
import { GraduationCap, Clock, Star, PlayCircle, CheckCircle2, ShieldCheck, ArrowRight, BookOpen } from 'lucide-react';

export const TrainingUpsellView: React.FC = () => {
  const [selectedCourse, setSelectedCourse] = useState<TrainingCourse | null>(null);
  const [enrolledIds, setEnrolledIds] = useState<string[]>(['train-1']);

  const handleEnroll = (course: TrainingCourse) => {
    if (!enrolledIds.includes(course.id)) {
      setEnrolledIds((prev) => [...prev, course.id]);
    }
    alert(`Successfully enrolled in "${course.title}"! Access code sent to your email.`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-white space-y-10">
      
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="bg-emerald-500/20 text-emerald-300 text-xs font-bold px-3 py-1 rounded-full border border-emerald-500/30 uppercase tracking-wider mb-2 inline-block">
            PDF Spec Section 4 #4 • Training Upsell
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            Digital Onboarding & Remote Skills Hub
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
            Helping retired professionals easily adapt to Zoom calls, AI prompt assistants, screen sharing, and modern digital advisory workflows.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-900 px-4 py-2 rounded-2xl border border-slate-800 text-xs">
          <GraduationCap className="w-5 h-5 text-amber-400" />
          <span><strong className="text-white font-bold">{enrolledIds.length}</strong> Courses Active</span>
        </div>
      </div>

      {/* Courses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {MOCK_TRAINING_COURSES.map((course) => {
          const isEnrolled = enrolledIds.includes(course.id);
          return (
            <div
              key={course.id}
              className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden flex flex-col justify-between hover:border-amber-500/50 transition-all group"
            >
              <div>
                <div className="relative h-44 overflow-hidden">
                  <img
                    src={course.thumbnail}
                    alt={course.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md text-amber-300 text-[11px] font-bold px-2.5 py-1 rounded-lg border border-slate-800">
                    {course.category}
                  </div>
                  {course.price === 0 && (
                    <div className="absolute top-3 right-3 bg-emerald-500 text-slate-950 text-[10px] font-black px-2.5 py-1 rounded-full shadow">
                      FREE UPSELL
                    </div>
                  )}
                </div>

                <div className="p-6 space-y-3">
                  <h3 className="text-base font-bold text-white group-hover:text-amber-400 transition-colors line-clamp-2">
                    {course.title}
                  </h3>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {course.description}
                  </p>

                  <div className="flex items-center justify-between text-xs text-slate-400 py-2 border-y border-slate-800/80">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-500" /> {course.duration}
                    </span>
                    <span className="flex items-center gap-1 text-amber-400 font-bold">
                      <Star className="w-3.5 h-3.5 fill-amber-400" /> {course.rating}
                    </span>
                    <span>{course.enrolledCount} enrolled</span>
                  </div>

                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold block">Key Skills Taught:</span>
                    <div className="flex flex-wrap gap-1">
                      {course.skillsLearned.map((skill, idx) => (
                        <span key={idx} className="text-[10px] bg-slate-950 text-slate-300 px-2 py-0.5 rounded border border-slate-800">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 pt-0 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 block">Course Fee</span>
                  <span className="text-lg font-extrabold text-amber-400">
                    {course.price === 0 ? 'FREE' : `₹${course.price}`}
                  </span>
                </div>

                <button
                  onClick={() => handleEnroll(course)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isEnrolled
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md'
                  }`}
                >
                  {isEnrolled ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> Enrolled
                    </>
                  ) : (
                    <>
                      <span>Enroll Course</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
};
