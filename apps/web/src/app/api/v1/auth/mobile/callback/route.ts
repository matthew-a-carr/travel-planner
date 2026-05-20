import type { MobileAuthCallbackError } from '@travel-planner/shared';
import { makeHandleMobileCallback } from '@/application/use-cases/auth/mobile/handle-mobile-callback';
import { getAppContainer } from '@/infrastructure/container';
import { buildMobileCallbackRedirectUri } from '../_lib/redirect-uri';

/**
 * Google's redirect target. Always responds with a 302 to a
 * `travelplanner://auth?...` deep link — never a JSON body, because
 * the user-agent here is the system browser, not the app.
 *
 * On any failure (unknown state, expired state, Google error,
 * unapproved user, …) the deep link carries `?error=<reason>`
 * instead of `?code=<one-time>`. The reason is drawn from the closed
 * `MobileAuthCallbackError` union in `@travel-planner/shared`, so
 * adding a reason without adding it to the union is a compile error.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code || !state) {
      return buildErrorRedirect('invalid_request');
    }

    const container = getAppContainer();
    const handleMobileCallback = makeHandleMobileCallback({
      stateRepo: container.mobileAuthStateRepository,
      exchangeCodeRepo: container.mobileAuthExchangeCodeRepository,
      userAccessRepo: container.userAccessRepository,
      google: container.googleOAuthClient,
      crypto: container.mobileAuthCrypto,
      redirectUri: buildMobileCallbackRedirectUri(request),
    });

    const { redirectUrl } = await handleMobileCallback({ code, state }, new Date());
    return Response.redirect(redirectUrl, 302);
  } catch (error) {
    console.error('[api/v1/auth/mobile/callback] unexpected error', error);
    return buildErrorRedirect('server_error');
  }
}

function buildErrorRedirect(reason: MobileAuthCallbackError): Response {
  return Response.redirect(`travelplanner://auth?error=${reason}`, 302);
}
