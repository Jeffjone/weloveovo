import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
export function failure(error: unknown) {
  if (error instanceof ZodError)
    return NextResponse.json({ error: 'Please check the request parameters.' }, { status: 400 });
  console.error('Request failed', error instanceof Error ? error.message : 'Unknown error');
  return NextResponse.json(
    { error: 'The archive is temporarily unavailable. Please try again.' },
    { status: 503 },
  );
}
