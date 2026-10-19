/**
 * Centralized Configuration for Mentora Expert Portal Background Video
 */

export interface ExpertVideoConfig {
  videoUrl: string;
  posterUrl: string;
}

export const EXPERT_VIDEO_CONFIG: ExpertVideoConfig = {
  // Authoritative MP4 video URL for the Mentora Expert Portal
  videoUrl: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260815_030633_1712fc71-4979-4e14-98f9-9f95702ab3da.mp4",
  posterUrl: "/expert-video-poster.jpg",
};
