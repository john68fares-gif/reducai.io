// pages/account.tsx
'use client';

import { useEffect, useState } from 'react';
import Head from 'next/head';
import { supabase } from '@/lib/supabase-client';
import {
  User as UserIcon,
  Mail,
  Calendar,
  Sun,
  Moon,
  LogOut,
  CreditCard,
  ShieldCheck,
  Loader2,
  X,
  Shield,
} from 'lucide-react';

export default function AccountPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [showBilling, setShowBilling] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);

  // password state
  const [newPassword, setNewPassword] = useState('');
  const [updating, setUpdating] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);

  // 2FA state
  const [enrolling2FA, setEnrolling2FA] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaEnabled, setMfaEnabled] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };
    getUser();

    if (localStorage.getItem('theme') === 'dark') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleDark = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const handlePasswordUpdate = async () => {
    if (!newPassword) return;
    setUpdating(true);
    setUpdateMessage(null);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setUpdateMessage(`Error: ${error.message}`);
    } else {
      setUpdateMessage('✅ Password updated successfully!');
      setNewPassword('');
    }
    setUpdating(false);
  };

  const handleEnable2FA = async () => {
    setEnrolling2FA(true);
    setMfaError(null);

    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    if (error) {
      setMfaError(error.message);
      setEnrolling2FA(false);
      return;
    }
    if (data?.totp?.uri) {
      // generate QR code via Google Charts API
      setQrCode(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data.totp.uri)}`);
    }
  };

  const handleVerify2FA = async () => {
    if (!otpCode) return;
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorType: 'totp', code: otpCode });
    if (error) {
      setMfaError(error.message);
    } else {
      setMfaEnabled(true);
      setQrCode(null);
      setOtpCode('');
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-[#0b0c10]">
        <Loader2 className="h-8 w-8 animate-spin text-[#00ffc2]" />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Account – Reduc AI</title>
      </Head>

      <div className="min-h-screen bg-white text-black dark:bg-[#0b0c10] dark:text-white transition-colors">
        <div className="mx-auto max-w-4xl px-6 py-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-10">
            <h1 className="text-3xl font-bold">Account</h1>
            <button
              onClick={toggleDark}
              className="flex items-center gap-2 rounded-md border border-[#00ffc2] px-4 py-2 text-sm font-medium text-[#00ffc2] hover:bg-[#00ffc2] hover:text-black transition-colors"
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {darkMode ? 'Light Mode' : 'Dark Mode'}
            </button>
          </div>

          {/* User Info */}
          <div className="space-y-6">
            <div className="rounded-lg border border-[#00ffc2]/40 bg-white p-6 shadow dark:bg-[#0d0f11]">
              <div className="flex items-center gap-3">
                <UserIcon className="h-5 w-5 text-[#00ffc2]" />
                <div>
                  <p className="text-sm font-medium">Name</p>
                  <p className="text-lg">{user?.user_metadata?.full_name || 'No name set'}</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-[#00ffc2]/40 bg-white p-6 shadow dark:bg-[#0d0f11]">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-[#00ffc2]" />
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-lg">{user?.email}</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-[#00ffc2]/40 bg-white p-6 shadow dark:bg-[#0d0f11]">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-[#00ffc2]" />
                <div>
                  <p className="text-sm font-medium">Joined</p>
                  <p className="text-lg">
                    {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Billing & Security */}
          <div className="mt-10 space-y-6">
            <button
              onClick={() => setShowBilling(true)}
              className="w-full flex items-center justify-between rounded-lg border border-[#00ffc2] px-6 py-4 text-left text-[#00ffc2] hover:bg-[#00ffc2] hover:text-black transition-colors"
            >
              <span className="flex items-center gap-3">
                <CreditCard className="h-5 w-5" />
                Billing
              </span>
              <span>→</span>
            </button>

            <button
              onClick={() => setShowSecurity(true)}
              className="w-full flex items-center justify-between rounded-lg border border-[#00ffc2] px-6 py-4 text-left text-[#00ffc2] hover:bg-[#00ffc2] hover:text-black transition-colors"
            >
              <span className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5" />
                Security
              </span>
              <span>→</span>
            </button>

            <button
              onClick={() => supabase.auth.signOut()}
              className="w-full flex items-center justify-between rounded-lg border border-red-500 px-6 py-4 text-left text-red-500 hover:bg-red-500 hover:text-white transition-colors"
            >
              <span className="flex items-center gap-3">
                <LogOut className="h-5 w-5" />
                Log out
              </span>
              <span>→</span>
            </button>
          </div>
        </div>
      </div>

      {/* Billing Modal */}
      {showBilling && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="w-full max-w-md rounded-lg border border-[#00ffc2] bg-white p-6 dark:bg-[#0d0f11] dark:text-white shadow-lg relative">
            <button
              onClick={() => setShowBilling(false)}
              className="absolute right-4 top-4 text-gray-600 hover:text-black dark:text-gray-400 dark:hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="mb-4 text-xl font-bold text-center">Billing</h2>
            <p className="mb-6 text-center text-sm text-gray-600 dark:text-gray-400">
              Manage your subscription and payment details below.
            </p>
            <a
              href="https://buy.stripe.com/3cI7sLgWz0zb0uT5hrgUM00"
              target="_blank"
              rel="noreferrer"
              className="block w-full rounded-md bg-[#00ffc2] px-4 py-3 text-center font-medium text-black hover:bg-[#00e6ad] transition-colors"
            >
              Upgrade to Pro – €19.99/month
            </a>
          </div>
        </div>
      )}

      {/* Security Modal */}
      {showSecurity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="w-full max-w-md rounded-lg border border-[#00ffc2] bg-white p-6 dark:bg-[#0d0f11] dark:text-white shadow-lg relative">
            <button
              onClick={() => setShowSecurity(false)}
              className="absolute right-4 top-4 text-gray-600 hover:text-black dark:text-gray-400 dark:hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="mb-4 text-xl font-bold text-center">Security Settings</h2>
            <div className="space-y-6">
              {/* Change Password */}
              <div>
                <label className="block mb-2 text-sm font-medium">Change Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password"
                  className="w-full rounded-md border border-[#00ffc2]/50 bg-transparent px-3 py-2 text-sm outline-none focus:border-[#00ffc2]"
                />
                <button
                  onClick={handlePasswordUpdate}
                  disabled={updating}
                  className="mt-3 w-full rounded-md bg-[#00ffc2] px-4 py-2 text-black font-medium hover:bg-[#00e6ad] transition-colors disabled:opacity-60"
                >
                  {updating ? 'Updating…' : 'Update Password'}
                </button>
                {updateMessage && (
                  <p className="mt-2 text-sm text-center text-gray-600 dark:text-gray-400">
                    {updateMessage}
                  </p>
                )}
              </div>

              {/* 2FA */}
              <div className="border-t border-[#00ffc2]/30 pt-4">
                <span className="flex items-center gap-2 text-sm font-medium mb-2">
                  <Shield className="h-4 w-4 text-[#00ffc2]" />
                  Two-Factor Authentication
                </span>
                {!mfaEnabled && !qrCode && (
                  <button
                    onClick={handleEnable2FA}
                    className="w-full rounded-md bg-[#00ffc2] px-4 py-2 text-black font-medium hover:bg-[#00e6ad] transition-colors"
                  >
                    Enable 2FA
                  </button>
                )}

                {qrCode && (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Scan this QR code with Google Authenticator or Authy:
                    </p>
                    <img src={qrCode} alt="2FA QR" className="mx-auto" />
                    <input
                      type="text"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="Enter 6-digit code"
                      className="w-full rounded-md border border-[#00ffc2]/50 bg-transparent px-3 py-2 text-sm outline-none focus:border-[#00ffc2]"
                    />
                    <button
                      onClick={handleVerify2FA}
                      className="w-full rounded-md bg-[#00ffc2] px-4 py-2 text-black font-medium hover:bg-[#00e6ad] transition-colors"
                    >
                      Verify & Enable
                    </button>
                  </div>
                )}

                {mfaEnabled && (
                  <p className="text-sm text-green-500">✅ 2FA is enabled on your account</p>
                )}

                {mfaError && (
                  <p className="text-sm text-red-500 mt-2">Error: {mfaError}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
