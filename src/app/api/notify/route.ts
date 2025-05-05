import { NextResponse } from 'next/server';
import sgMail from '@sendgrid/mail';

// Set SendGrid API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

export async function POST(request: Request) {
  try {
    const { email, subject, message } = await request.json();

    if (!process.env.SENDGRID_API_KEY) {
      throw new Error('SendGrid API key is not configured.');
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
    //console.log('Email sent successfully:', result);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error sending email:', error);
    if (error.response) {
      console.error('SendGrid response:', error.response.body);
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}