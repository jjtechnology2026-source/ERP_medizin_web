import "next-auth";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      id_group: string;
      name_group: string;
      permits: string[];
      pharmacyId?: string;
      pharmacyName?: string;
      rif?: string;
      usesDigitalBilling?: boolean;
      pharmacies?: any[];
    } & DefaultSession["user"];
    accessToken?: string;
    refreshToken?: string;
    error?: string;
  }

  interface User {
    id: string;
    role: string;
    id_group: string;
    name_group: string;
    permits: string[];
    pharmacyId?: string;
    pharmacyName?: string;
    rif?: string;
    usesDigitalBilling?: boolean;
    pharmacies?: any[];
    accessToken: string; 
    refreshToken: string; 
    expiresAt: number;    
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      role: string;
      id_group: string;
      name_group: string;
      permits: string[];
      pharmacyId?: string;
      pharmacyName?: string;
      rif?: string;
      usesDigitalBilling?: boolean;
      pharmacies?: any[];
    };
    error?: string;
  }
}