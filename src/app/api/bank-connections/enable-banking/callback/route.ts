import { type NextRequest, NextResponse } from "next/server";
import {
  EnableBankingRequestError,
  authorizeEnableBankingSession,
  enableBankingCookies,
  getSecureCookieOptions,
  parseAuthorizationStateCookie,
} from "@/lib/enable-banking";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const targetUrl = new URL("/", request.nextUrl.origin);
  const error = request.nextUrl.searchParams.get("error");
  const errorDescription = request.nextUrl.searchParams.get("error_description");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = parseAuthorizationStateCookie(request.cookies.get(enableBankingCookies.state)?.value);

  if (error) {
    targetUrl.searchParams.set("bankError", errorDescription ?? error);
    return redirectWithClearedState(request, targetUrl);
  }

  if (!code || !state || !expectedState || state !== expectedState.state) {
    targetUrl.searchParams.set("bankError", "Bankfreigabe konnte nicht verifiziert werden.");
    return redirectWithClearedState(request, targetUrl);
  }

  try {
    const session = await authorizeEnableBankingSession(code);
    const response = NextResponse.redirect(targetUrlWithSuccess(targetUrl));

    response.cookies.delete(enableBankingCookies.state);
    response.cookies.set(
      enableBankingCookies.session,
      session.session_id,
      getSecureCookieOptions(request, getSessionMaxAge(session.access.valid_until)),
    );
    response.cookies.set(
      enableBankingCookies.activeProvider,
      expectedState.providerId,
      getSecureCookieOptions(request, getSessionMaxAge(session.access.valid_until)),
    );

    return response;
  } catch (syncError) {
    targetUrl.searchParams.set("bankError", getErrorMessage(syncError));
    return redirectWithClearedState(request, targetUrl);
  }
}

function targetUrlWithSuccess(targetUrl: URL) {
  targetUrl.searchParams.set("bankConnected", "1");
  return targetUrl;
}

function redirectWithClearedState(request: NextRequest, targetUrl: URL) {
  const response = NextResponse.redirect(targetUrl);

  response.cookies.delete(enableBankingCookies.state);
  response.cookies.delete(enableBankingCookies.session);
  response.cookies.delete(enableBankingCookies.activeProvider);

  return response;
}

function getSessionMaxAge(validUntil?: string) {
  if (!validUntil) {
    return 90 * 86_400;
  }

  const expiresAt = new Date(validUntil).getTime();

  if (!Number.isFinite(expiresAt)) {
    return 90 * 86_400;
  }

  const seconds = Math.floor((expiresAt - Date.now()) / 1000);

  return Math.max(Math.min(seconds, 180 * 86_400), 60);
}

function getErrorMessage(error: unknown) {
  if (error instanceof EnableBankingRequestError) {
    return error.message;
  }

  return "Bankfreigabe konnte nicht abgeschlossen werden.";
}
