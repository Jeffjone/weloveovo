import { NextResponse } from 'next/server';
import { answerInput, checkAnswer } from '@/lib/game-server';
import { failure } from '@/lib/http';
export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Send a valid answer.' }, { status: 400 });
    }
    const answer = await checkAnswer(answerInput.parse(body));
    return NextResponse.json(
      answer || { error: 'This question is no longer available. Start a new round.' },
      { status: answer ? 200 : 404, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return failure(error);
  }
}
