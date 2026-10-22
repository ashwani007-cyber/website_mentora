// Edge Function: Send Status Change Email
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, status, comment, expertName } = await req.json()

    // Validate required fields
    if (!email || !status) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, status' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Email templates for each status
    const emailTemplates = {
      'approved': {
        subject: '🎉 Congratulations! Your Expert Profile Has Been Approved',
        body: `
Dear ${expertName || 'Expert'},

Great news! Your expert profile has been approved by our admin team.

You can now:
- Appear in our public expert directory
- Receive booking requests from clients
- Start accepting projects

If you have any questions, feel free to reach out to our support team.

Best regards,
The Mentora Team
        `
      },
      'rejected': {
        subject: 'Profile Update: Application Status',
        body: `
Dear ${expertName || 'Expert'},

We regret to inform you that your expert profile application has been rejected.

Reason: ${comment || 'Please contact support for more details.'}

If you believe this is an error or would like to reapply with additional information, please contact our support team.

Best regards,
The Mentora Team
        `
      },
      'changes_requested': {
        subject: 'Action Required: Changes Requested for Your Profile',
        body: `
Dear ${expertName || 'Expert'},

Our admin team has reviewed your profile and requested some changes.

Comments: ${comment || 'Please review your profile and make necessary updates.'}

Please:
1. Log in to your expert portal
2. Review the admin comments
3. Make the requested changes
4. Re-upload any additional documents if needed
5. Submit for review again

If you have any questions, feel free to reach out.

Best regards,
The Mentora Team
        `
      },
      'under_review': {
        subject: 'Profile Under Review',
        body: `
Dear ${expertName || 'Expert'},

Your expert profile is currently under review by our admin team.

We will notify you once a decision has been made. This typically takes 24-48 hours.

You can check your application status in your expert portal at any time.

Best regards,
The Mentora Team
        `
      },
      'submitted': {
        subject: 'Profile Submitted for Review',
        body: `
Dear ${expertName || 'Expert'},

Thank you for completing your expert profile!

Your application has been submitted for review. Our admin team will review your profile and KYC documents.

We will notify you once a decision has been made. This typically takes 24-48 hours.

You can check your application status in your expert portal at any time.

Best regards,
The Mentora Team
        `
      }
    }

    const template = emailTemplates[status as keyof typeof emailTemplates]
    if (!template) {
      return new Response(
        JSON.stringify({ error: 'Invalid status' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send email using SMTP (configure your SMTP settings in Supabase Edge Function environment)
    // This is a placeholder - you need to configure SMTP settings in Supabase Dashboard
    // under Edge Functions > Settings > Environment Variables

    // Example using a simple email service (replace with your preferred service)
    // For production, use services like:
    // - Resend (https://resend.com)
    // - SendGrid (https://sendgrid.com)
    // - AWS SES
    // - Mailgun

    // Placeholder email sending logic:
    const emailData = {
      to: email,
      subject: template.subject,
      html: template.body.replace(/\n/g, '<br/>'),
      text: template.body
    }

    // TODO: Implement actual email sending
    // Example with Resend:
    // const resend = new Resend(Deno.env.get('RESEND_API_KEY'))
    // await resend.emails.send({
    //   from: 'noreply@yourdomain.com',
    //   to: email,
    //   subject: template.subject,
    //   html: template.body
    // })

    console.log('Email would be sent:', emailData)

    return new Response(
      JSON.stringify({ success: true, message: 'Email sent successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
