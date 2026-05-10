/**
 * Create Entra ID (Azure AD) users via Microsoft Graph client-credentials flow.
 * Requires AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET, AZURE_AD_TENANT_ID.
 */

let cachedToken: { token: string; expiresAt: number } | null = null;

function tenantId(): string {
  return process.env.AZURE_AD_TENANT_ID!;
}

function clientId(): string {
  return process.env.AZURE_AD_CLIENT_ID!;
}

function clientSecret(): string {
  return process.env.AZURE_AD_CLIENT_SECRET!;
}

async function getClientCredentialsToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const body = new URLSearchParams({
    client_id: clientId(),
    client_secret: clientSecret(),
    grant_type: "client_credentials",
    scope: "https://graph.microsoft.com/.default",
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId()}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );

  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!data.access_token) {
    throw new Error(
      data.error_description ||
        data.error ||
        "Graph client-credentials token failed",
    );
  }

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return data.access_token;
}

function randomPassword(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  let pwd = "";
  for (let i = 0; i < 24; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pwd;
}

export interface CreateGraphUserInput {
  displayName: string;
  mailNickname: string;
  userPrincipalName: string;
  mail?: string;
}

export async function createGraphUser(
  input: CreateGraphUserInput,
): Promise<{ id: string; userPrincipalName: string }> {
  const token = await getClientCredentialsToken();

  const res = await fetch("https://graph.microsoft.com/v1.0/users", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      accountEnabled: false,
      displayName: input.displayName,
      mailNickname: input.mailNickname,
      userPrincipalName: input.userPrincipalName,
      mail: input.mail,
      passwordProfile: {
        forceChangePasswordNextSignIn: true,
        password: randomPassword(),
      },
    }),
  });

  const data = (await res.json()) as {
    id?: string;
    userPrincipalName?: string;
    error?: { message?: string; code?: string };
    error_description?: string;
  };

  if (!res.ok || !data.id) {
    const msg =
      data.error?.message ||
      data.error_description ||
      JSON.stringify(data.error) ||
      `Graph create user failed (${res.status})`;
    throw new Error(msg);
  }

  return {
    id: data.id,
    userPrincipalName: data.userPrincipalName || input.userPrincipalName,
  };
}

export interface CreateGraphInvitationInput {
  email: string;
  displayName: string;
  redirectUrl: string;
}

export async function createGraphInvitation(
  input: CreateGraphInvitationInput,
): Promise<{ id: string; invitedUserId: string; status: string }> {
  const token = await getClientCredentialsToken();

  const res = await fetch("https://graph.microsoft.com/v1.0/invitations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      invitedUserEmailAddress: input.email,
      inviteRedirectUrl: input.redirectUrl,
      sendInvitationMessage: true,
    }),
  });

  const data = (await res.json()) as {
    id?: string;
    invitedUser?: { id?: string };
    status?: string;
    error?: { message?: string; code?: string };
    error_description?: string;
  };

  if (!res.ok || !data.id) {
    const msg =
      data.error?.message ||
      data.error_description ||
      JSON.stringify(data.error) ||
      `Graph invitation failed (${res.status})`;
    throw new Error(msg);
  }

  return {
    id: data.id,
    invitedUserId: data.invitedUser?.id || "",
    status: data.status || "PendingAcceptance",
  };
}
