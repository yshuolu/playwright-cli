export interface BrowserConfig {
  name: string;
  mac: string;
  linux: string;
  win: string;
  macExec: string;
  linuxExec: string;
  winExec: string | null;
}

export interface ProfileInfo {
  name: string;
  displayName: string;
  isDefault: boolean;
}

export interface ResolvedBrowser {
  config: BrowserConfig;
  userDataDir: string;
  executable: string;
  profileName: string;
  allProfiles: ProfileInfo[];
}

export interface PlaywrightCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  secure: boolean;
  httpOnly: boolean;
  sameSite: 'Strict' | 'Lax' | 'None';
}

export interface BrowserState {
  cookies: PlaywrightCookie[];
  localStorage: Record<string, string>;
}
