export class OAuth2TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  addtional_info: any;
  jti: string;
}

export class GigaB2bCredentials {
  clientId: string;
  password: string;
  apiHost: string;
}
