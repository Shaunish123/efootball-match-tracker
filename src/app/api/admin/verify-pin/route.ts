import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminPin, createAdminToken } from '@/lib/adminAuthServer';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pin } = body;

    if (!pin || typeof pin !== 'string') {
      return NextResponse.json({ success: false, error: 'PIN is required' }, { status: 400 });
    }

    const isValid = verifyAdminPin(pin);
    if (!isValid) {
      return NextResponse.json({ success: false, error: 'Invalid Admin PIN' }, { status: 401 });
    }

    const token = createAdminToken();
    return NextResponse.json({ success: true, token });
  } catch (error: any) {
    console.error('Error verifying PIN:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
