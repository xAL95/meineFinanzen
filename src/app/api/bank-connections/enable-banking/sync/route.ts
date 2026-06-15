import { type NextRequest, NextResponse } from "next/server";
import {
  EnableBankingRequestError,
  enableBankingCookies,
  syncEnableBankingSession,
} from "@/lib/enable-banking";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get(enableBankingCookies.session)?.value;

  if (!sessionId) {
    return NextResponse.json({ message: "Es ist noch keine Bankverbindung aktiv." }, { status: 409 });
  }

  try {
    return NextResponse.json(await syncEnableBankingSession(request, sessionId));
  } catch (error) {
    if (error instanceof EnableBankingRequestError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json({ message: "Bankdaten konnten nicht synchronisiert werden." }, { status: 500 });
  }
}
