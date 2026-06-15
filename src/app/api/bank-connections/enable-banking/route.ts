import { type NextRequest, NextResponse } from "next/server";
import {
  EnableBankingRequestError,
  enableBankingCookies,
  getEnableBankingStatus,
  getSecureCookieOptions,
  serializeAuthorizationStateCookie,
  startEnableBankingAuthorization,
} from "@/lib/enable-banking";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return NextResponse.json(
    getEnableBankingStatus(
      request.cookies.get(enableBankingCookies.session)?.value,
      request.cookies.get(enableBankingCookies.activeProvider)?.value,
    ),
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Partial<{ providerId: string }>;
    const authorization = await startEnableBankingAuthorization(request, body.providerId);
    const response = NextResponse.json({ url: authorization.url });

    response.cookies.set(
      enableBankingCookies.state,
      serializeAuthorizationStateCookie(authorization.state, authorization.providerId),
      getSecureCookieOptions(request, 10 * 60),
    );

    return response;
  } catch (error) {
    return toErrorResponse(error);
  }
}

function toErrorResponse(error: unknown) {
  if (error instanceof EnableBankingRequestError) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }

  return NextResponse.json({ message: "Bankverbindung konnte nicht gestartet werden." }, { status: 500 });
}
