import { NextResponse } from 'next/server';
import sgMail from '@sendgrid/mail';

// Only set the API key if it exists
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export async function POST(request: Request) {
  try {
    const { email, subject, message } = await request.json();

    // Check if SendGrid is configured
    if (!process.env.SENDGRID_API_KEY) {
      console.warn('SendGrid API key is not configured. Email notifications are disabled.');
      // Return success but note that email wasn't actually sent
      return NextResponse.json({ 
        success: true, 
        warning: 'Email not sent: SendGrid API key not configured',
        emailDisabled: true 
      });
    }

    if (!email) {
      throw new Error('Recipient email is missing.');
    }

    const msg = {
      to: email,
      from: 'dhineshkumar24murugan007@gmail.com', // Ensure this is verified in SendGrid
      subject,
      text: message,
    };

    console.log('Sending email to:', email);
    const result = await sgMail.send(msg);
    return NextResponse.json({ success: true, emailSent: true });
  } catch (error: any) {
    console.error('Error sending email:', error);
    if (error.response) {
      console.error('SendGrid response:', error.response.body);
    }
    // Return a 200 response to prevent breaking the application flow
    // but include error information
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      emailSent: false
    }, { status: 200 });
  }
}