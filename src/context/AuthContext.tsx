"use client";

import React, { createContext, useContext } from "react";
import { SessionProvider, useSession, signIn, signOut } from "next-auth/react";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: "client" | "admin";
  org_name: string;
  mfaEnabled?: boolean;
  mfaPending?: boolean;
  mfaVerified?: boolean;
}

interface AuthContextType {
  user: any;
  profile: UserProfile | null;
  session: any;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  verifyMfa: (code: string) => Promise<void>;
  verifyRecoveryCode: (code: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AuthConsumer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: session, status, update } = useSession();

  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated";

  const user = session?.user || null;
  const profile: UserProfile | null = user
    ? {
        id: (user as any).id || "",
        email: user.email || "",
        full_name: (user as any).fullName || user.name || "",
        role: (user as any).role || "client",
        org_name: (user as any).orgName || "",
        mfaEnabled: (user as any).mfaEnabled || false,
        mfaPending: (user as any).mfaPending || false,
        mfaVerified: (user as any).mfaVerified || false,
      }
    : null;

  const login = async (email: string, password: string) => {
    const res = await signIn("credentials", {
      redirect: false,
      email,
      password,
    });

    if (res?.error) {
      throw new Error(res.error);
    }
  };

  const logout = async () => {
    await signOut({ redirect: false });
  };

  const verifyMfa = async (code: string) => {
    const res = await fetch("/api/mfa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "MFA verification failed");
    }
    await update({ mfaVerified: true });
  };

  const verifyRecoveryCode = async (recoveryCode: string) => {
    const res = await fetch("/api/mfa/recovery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recoveryCode }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Recovery code verification failed");
    }
    await update({ mfaVerified: true });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        isAuthenticated,
        isLoading,
        login,
        logout,
        verifyMfa,
        verifyRecoveryCode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <SessionProvider>
      <AuthConsumer>{children}</AuthConsumer>
    </SessionProvider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
