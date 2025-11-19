import React, { useState, useEffect, useRef } from "react";
import {
  KeyRound,
  Link as LinkIcon,
  Clock,
  Sparkles,
} from "lucide-react";
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, update, onValue, off } from 'firebase/database';
import Navbar from "./components/Navbar";
import Home from "./components/Home";
import SpinPage from "./components/Spin";
import BonusPage from "./components/Bonus";
import Refer from "./components/Refer";
import ProfilePage from "./components/Profile";
import "./App.css";

/* ---------------- Firebase Configuration ---------------- */

const firebaseConfig = {
  apiKey: "AIzaSyC0gMm_Vx3ysXTwQwmjLdoxvH_m369U7Vs",
  authDomain: "cbot-4baae.firebaseapp.com",
  databaseURL: "https://cbot-4baae-default-rtdb.firebaseio.com",
  projectId: "cbot-4baae",
  storageBucket: "cbot-4baae.firebasestorage.app",
  messagingSenderId: "726823810353",
  appId: "1:726823810353:web:1f49dd2a2e81fd4bf8ec10",
  measurementId: "G-T316MYT6D9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);

/* ---------------- Ad Configuration Interface ---------------- */

interface AdConfig {
  reward: number;
  dailyLimit: number;
  cooldown: number;
  enabled: boolean;
}

interface AdsConfig {
  monetag: AdConfig;
  adsovio: AdConfig;
  adexora: AdConfig;
}

/* ---------------- Telegram User Interface ---------------- */

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export interface UserData {
  telegramId: number;
  firstName: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
  joinDate: string;
  coins: number;
  balance: number;
  keys: number;
  diamonds: number;
  tasksCompleted: Record<string, number>;
  watchedAds: {
    ad1: number; // For Monetag
    ad2: number; // For Adsovio
    ad3: number; // For Adexora
  };
  directTasksClaimed: boolean[];
  referrals: string[];
  totalEarned: number;
  lastLogin: string;
  lastAdWatch?: {
    monetag?: string;
    adsovio?: string;
    adexora?: string;
  };
}

// Default user data template
const defaultUserData: Omit<UserData, 'telegramId' | 'firstName' | 'lastName' | 'username' | 'photoUrl' | 'joinDate'> = {
  coins: 0,
  balance: 0,
  keys: 0,
  diamonds: 0,
  tasksCompleted: {},
  watchedAds: {
    ad1: 0,
    ad2: 0,
    ad3: 0
  },
  directTasksClaimed: [false, false, false],
  referrals: [],
  totalEarned: 0,
  lastLogin: new Date().toISOString()
};

/* ---------------- Withdraw History Interface ---------------- */

export interface WithdrawHistory {
  id: string;
  telegramId: number;
  amount: number;
  paymentMethod: string;
  accountId: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  completedAt?: string;
  adminNotes?: string;
}

/* ---------------- Type Declarations ---------------- */

declare global {
  interface Window {
    showAdexora: () => Promise<void>;
    show_9673543?: () => Promise<void>;
    showAdsovio?: () => Promise<void>;
  }
}

/* ---------------- Ad Configuration Hook ---------------- */

export function useAdConfig() {
  const [adConfig, setAdConfig] = useState<AdsConfig>({
    monetag: { reward: 5, dailyLimit: 10, cooldown: 60, enabled: true },
    adsovio: { reward: 5, dailyLimit: 10, cooldown: 60, enabled: true },
    adexora: { reward: 5, dailyLimit: 10, cooldown: 60, enabled: true },
  });

  useEffect(() => {
    const adsRef = ref(database, 'ads');
    const unsubscribe = onValue(adsRef, (snapshot) => {
      if (snapshot.exists()) {
        const configData = snapshot.val() as Partial<Record<keyof AdsConfig, Partial<AdConfig>>>;
        setAdConfig((prev) => ({
          monetag: { ...prev.monetag, ...(configData.monetag || {}) },
          adsovio: { ...prev.adsovio, ...(configData.adsovio || {}) },
          adexora: { ...prev.adexora, ...(configData.adexora || {}) },
        }));
      }
    });

    return () => unsubscribe();
  }, []);

  return adConfig;
}

/* ---------------- Telegram Auth Hook with Real-time Updates ---------------- */

function useTelegramAuth() {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    // Check for Telegram WebApp data
    const tg = (window as any).Telegram?.WebApp;

    if (tg) {
      tg.ready();
      const initData = tg.initDataUnsafe;

      if (initData.user) {
        const telegramUser: TelegramUser = {
          id: initData.user.id,
          first_name: initData.user.first_name,
          last_name: initData.user.last_name,
          username: initData.user.username,
          photo_url: initData.user.photo_url,
          auth_date: initData.auth_date,
          hash: initData.hash
        };

        handleTelegramUser(telegramUser);
      } else {
        // No Telegram user data - show demo mode
        setLoading(false);
      }
    } else {
      // Not in Telegram - show demo mode
      setLoading(false);
    }
  }, []);

  const handleTelegramUser = async (telegramUser: TelegramUser) => {
    try {
      const userRef = ref(database, `users/${telegramUser.id}`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        // Existing user - update last login and ensure photoUrl exists
        const userData = snapshot.val() as UserData;
        const updatedUser = {
          ...userData,
          lastLogin: new Date().toISOString(),
          // If photoUrl doesn't exist but we have it from Telegram, update it
          photoUrl: userData.photoUrl || telegramUser.photo_url
        };

        const updates: any = {
          lastLogin: updatedUser.lastLogin
        };

        // Only update photoUrl if it doesn't exist and we have it from Telegram
        if (telegramUser.photo_url && !userData.photoUrl) {
          updates.photoUrl = telegramUser.photo_url;
        }

        await update(userRef, updates);
        setUser(updatedUser);
        setShowWelcome(false);

        // Set up real-time listener for this user
        setupRealtimeUpdates(telegramUser.id);
      } else {
        // New user - create record
        const newUser: UserData = {
          telegramId: telegramUser.id,
          firstName: telegramUser.first_name,
          lastName: telegramUser.last_name,
          username: telegramUser.username,
          photoUrl: telegramUser.photo_url, // Store the photo URL from Telegram
          joinDate: new Date().toISOString(),
          ...defaultUserData
        };

        await set(userRef, newUser);
        setUser(newUser);
        setShowWelcome(true);

        // Set up real-time listener for this user
        setupRealtimeUpdates(telegramUser.id);

        // Hide welcome after 3 seconds
        setTimeout(() => setShowWelcome(false), 3000);
      }
    } catch (error) {
      console.error('Error handling Telegram user:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeUpdates = (userId: number) => {
    const userRef = ref(database, `users/${userId}`);

    const unsubscribe = onValue(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const userData = snapshot.val() as UserData;
        setUser(userData);
        console.log('Real-time update received:', userData);
      }
    });

    // Return cleanup function
    return () => off(userRef, 'value', unsubscribe);
  };

  const updateUserData = async (updates: Partial<UserData>) => {
    if (!user) return;

    try {
      const userRef = ref(database, `users/${user.telegramId}`);
      await update(userRef, updates);
      // Real-time listener will automatically update the state
    } catch (error) {
      console.error('Error updating user data:', error);
    }
  };

  return {
    user,
    loading,
    showWelcome,
    updateUserData
  };
}

/* ---------------- Welcome Modal ---------------- */

function WelcomeModal({
  show,
  userName
}: {
  show: boolean;
  userName: string;
}) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-green-400 to-emerald-600 rounded-3xl p-8 text-center text-white max-w-sm w-full animate-bounce">
        <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Welcome!</h2>
        <p className="text-lg mb-4">Hello {userName}!</p>
        <p className="text-white/90 text-sm">
          Start earning coins and rewards by completing simple tasks!
        </p>
      </div>
    </div>
  );
}

/* ---------------- Reusable pieces ---------------- */

export function WatchAdCard({
  title = "Watch Ads",
  per = "Per Video",
  watched,
  onWatch,
  disabled,
  adConfig,
  user,
}: {
  title?: string;
  reward?: string;
  per?: string;
  watched: number;
  total: number;
  onWatch: () => void;
  disabled: boolean;
  adConfig: AdConfig;
  user: UserData | null;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [cooldownLeft, setCooldownLeft] = useState(0);

  // Calculate cooldown
  useEffect(() => {
    if (!user?.lastAdWatch) return;

    const lastWatchTime = new Date(user.lastAdWatch.adexora || 0).getTime();
    const currentTime = new Date().getTime();
    const timeSinceLastWatch = Math.floor((currentTime - lastWatchTime) / 1000);
    const cooldownRemaining = Math.max(0, adConfig.cooldown - timeSinceLastWatch);

    setCooldownLeft(cooldownRemaining);

    if (cooldownRemaining > 0) {
      const interval = setInterval(() => {
        setCooldownLeft(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [user?.lastAdWatch, adConfig.cooldown]);

  const isOnCooldown = cooldownLeft > 0;
  const isDailyLimitReached = watched >= adConfig.dailyLimit;
  const isAdDisabled = !adConfig.enabled || isDailyLimitReached || isOnCooldown || disabled;

  const loadAndShowAd = async (): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      // Check if script is already loaded
      if (typeof window.showAdexora === 'function') {
        window.showAdexora()
          .then(() => resolve(true))
          .catch(reject);
        return;
      }

      // Load the script dynamically
      const script = document.createElement('script');
      script.src = 'https://adexora.com/cdn/ads.js?id=1028';
      script.async = true;

      script.onload = () => {
        // Wait a bit for the script to initialize
        setTimeout(() => {
          if (typeof window.showAdexora === 'function') {
            window.showAdexora()
              .then(() => resolve(true))
              .catch(reject);
          } else {
            reject(new Error('Adexora ad function not available'));
          }
        }, 1000);
      };

      script.onerror = () => reject(new Error('Failed to load ad script'));
      document.head.appendChild(script);
    });
  };

  const handleClick = async () => {
    if (isAdDisabled || isLoading) return;

    setIsLoading(true);
    try {
      // Load and show Adexora ad
      await loadAndShowAd();
      // Only call onWatch if ad was successfully shown and completed
      await onWatch();
    } catch (error) {
      console.error('Error watching ad:', error);
      alert('Failed to load ad. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getButtonText = () => {
    if (!adConfig.enabled) return "Ads Disabled";
    if (isDailyLimitReached) return "Daily Limit Reached";
    if (isOnCooldown) return `Cooldown: ${cooldownLeft}s`;
    if (isLoading) return "Loading ad...";
    return "Watch Video Ad";
  };

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={isAdDisabled || isLoading}
        className={[
          "w-full text-left bg-gradient-to-r from-green-400/60 to-emerald-500/60 backdrop-blur-md rounded-xl px-4 py-2.5 shadow-md border border-green-300 flex items-center justify-between transition-all duration-300",
          isAdDisabled ? "opacity-60 cursor-not-allowed" : "hover:scale-[1.02] cursor-pointer",
          isLoading ? "opacity-80 cursor-wait" : "",
        ].join(" ")}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-lg bg-white/20 flex items-start overflow-hidden">
              <img
                src="/adexora.png"     // <-- your image here
                alt="Play Icon"
                className="w-full h-full object-cover"
              />
            </div>

            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>

          <div className="text-white">
            <p className="text-[14px] font-semibold leading-tight">{title}</p>
            <p className="text-[12px] text-white/90 leading-tight">
              {getButtonText()}
            </p>
            <p className="text-[11px] text-white/90 mt-1">
              Watched: <span className="font-semibold">{watched}/{adConfig.dailyLimit}</span>
            </p>
          </div>
        </div>

        <div className="text-right">
          {/* Changed from Coin to Key */}
          <p className="text-[13px] font-semibold text-white">+{adConfig.reward} Key</p>
          <p className="text-[10px] text-white/70">{per}</p>
        </div>
      </button>
    </div>
  );
}

/* ---------------- Direct Task Item with UTC Time Validation ---------------- */

export function DirectTaskItem({
  icon,
  title,
  claimed,
  onClaim,
  rewardLabel = "+1 Key",
  url = "https://fb.com",
  waitTime = 20,
}: {
  icon: React.ReactNode;
  title: string;
  claimed: boolean;
  onClaim: () => void;
  rewardLabel?: string;
  url?: string;
  waitTime?: number;
}) {
  const [isWaiting, setIsWaiting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(waitTime);
  const [popupWindow, setPopupWindow] = useState<Window | null>(null);
  const [canClaim, setCanClaim] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);

  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const clearAllIntervals = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  };

  useEffect(() => {
    if (isWaiting && timeLeft > 0) {
      countdownIntervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearAllIntervals();
            setCanClaim(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      clearAllIntervals();
    };
  }, [isWaiting, timeLeft]);

  const handleTaskFailed = (message: string) => {
    clearAllIntervals();
    setIsWaiting(false);
    setTimeLeft(waitTime);
    setCanClaim(false);
    setStartTime(null);
    if (popupWindow && !popupWindow.closed) {
      popupWindow.close();
    }
    setPopupWindow(null);
    alert(message);
  };

  const startTask = () => {
    if (claimed || isWaiting) return;

    clearAllIntervals();

    const currentUTCTime = Date.now();
    setStartTime(currentUTCTime);

    const windowFeatures = 'width=600,height=700,scrollbars=yes,resizable=yes';
    const newWindow = window.open(url, '_blank', windowFeatures);

    if (!newWindow) {
      alert('Please allow popups to start this task');
      return;
    }

    setPopupWindow(newWindow);
    setIsWaiting(true);
    setCanClaim(false);
    setTimeLeft(waitTime);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        return;
      } else {
        const currentTime = Date.now();
        const timeElapsed = currentTime - currentUTCTime;
        const timeElapsedSeconds = Math.floor(timeElapsed / 1000);

        if (timeElapsedSeconds < waitTime) {
          handleTaskFailed(`You returned too early! You need to stay for ${waitTime} seconds. You only stayed for ${timeElapsedSeconds} seconds.`);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    const popupCheckInterval = setInterval(() => {
      if (newWindow.closed) {
        clearInterval(popupCheckInterval);
        document.removeEventListener('visibilitychange', handleVisibilityChange);

        const currentTime = Date.now();
        const timeElapsed = currentTime - currentUTCTime;
        const timeElapsedSeconds = Math.floor(timeElapsed / 1000);

        if (timeElapsedSeconds < waitTime) {
          handleTaskFailed(`You closed the page too early! You need to stay for ${waitTime} seconds. You only stayed for ${timeElapsedSeconds} seconds.`);
        } else {
          setCanClaim(true);
          setIsWaiting(true);
        }
      }
    }, 1000);

    setTimeout(() => {
      clearInterval(popupCheckInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, (waitTime + 5) * 1000);
  };

  const handleClaim = () => {
    if (!canClaim || !startTime) return;

    const currentTime = Date.now();
    const timeElapsed = currentTime - startTime;
    const timeElapsedSeconds = Math.floor(timeElapsed / 1000);

    if (timeElapsedSeconds < waitTime) {
      alert(`Cheating detected! You need to stay for ${waitTime} seconds. You only stayed for ${timeElapsedSeconds} seconds.`);
      handleTaskFailed("Invalid claim attempt");
      return;
    }

    clearAllIntervals();

    if (popupWindow && !popupWindow.closed) {
      popupWindow.close();
    }

    setIsWaiting(false);
    setTimeLeft(waitTime);
    setCanClaim(false);
    setStartTime(null);
    setPopupWindow(null);

    onClaim();
  };

  useEffect(() => {
    return () => {
      clearAllIntervals();
      document.removeEventListener('visibilitychange', () => { });
    };
  }, []);

  return (
    <div className="w-full text-left rounded-2xl px-4 py-3 shadow-md border bg-gradient-to-r from-white/70 to-white/60 border-white/60 flex items-center justify-between text-gray-900 transition-transform">
      <div className="flex items-center gap-3 flex-1">
        <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-blue-50 flex items-center justify-center shadow border border-blue-100">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold truncate">{title}</p>

          <div className="flex items-center gap-1 mt-1">
            <div className="bg-green-500/20 text-green-700 px-2 py-0.5 rounded-lg border border-green-500/30">
              <span className="text-[11px] font-semibold">{rewardLabel}</span>
            </div>
          </div>

          {isWaiting && (
            <div className="mt-2">
              <div className="flex items-center gap-2">
                <Clock className={`w-3 h-3 ${canClaim ? 'text-green-600' : 'text-blue-600'}`} />
                <span className={`text-[11px] font-medium ${canClaim ? 'text-green-600' : 'text-blue-600'
                  }`}>
                  {canClaim
                    ? "Task completed"
                    : `Stay for: ${timeLeft}s (Don't return early!)`
                  }
                </span>
              </div>
              {!canClaim && (
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                  <div
                    className="bg-green-500 h-1.5 rounded-full transition-all duration-1000"
                    style={{
                      width: `${((waitTime - timeLeft) / waitTime) * 100}%`
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="text-right flex-shrink-0 ml-2">
        {claimed ? (
          <span className="text-[12px] font-semibold text-gray-500">Claimed</span>
        ) : isWaiting ? (
          <button
            onClick={handleClaim}
            disabled={!canClaim}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-300 ${canClaim
                ? 'bg-green-500 hover:bg-green-600 text-white shadow-md hover:shadow-lg transform hover:scale-105'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
          >
            {canClaim ? '🎉 Claim Now!' : `${timeLeft}s`}
          </button>
        ) : (
          <button
            onClick={startTask}
            className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1 shadow-md hover:shadow-lg"
          >
            <LinkIcon className="w-3 h-3" />
            Start
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------- Tasks Page ---------------- */

function TasksPage({
  user,
  updateUserData
}: {
  user: UserData | null;
  updateUserData: (updates: Partial<UserData>) => void;
}) {
  const adConfig = useAdConfig();
  const adexoraConfig = adConfig.adexora;

  // State for direct tasks from Firebase
  const [directTasks, setDirectTasks] = useState<any[]>([]);
  const [loadingDirectTasks, setLoadingDirectTasks] = useState(true);

  // Load direct tasks from Firebase
  useEffect(() => {
    const loadDirectTasks = () => {
      setLoadingDirectTasks(true);
      const tasksRef = ref(database, 'tasks');
      onValue(tasksRef, (snapshot) => {
        if (snapshot.exists()) {
          const tasksData: any[] = [];
          snapshot.forEach((childSnapshot) => {
            const taskData = childSnapshot.val();
            // Only include direct tasks
            if (taskData.taskType === 'direct') {
              tasksData.push({
                ...taskData,
                id: childSnapshot.key,
              });
            }
          });
          setDirectTasks(tasksData);
        } else {
          setDirectTasks([]);
        }
        setLoadingDirectTasks(false);
      });
    };

    loadDirectTasks();
  }, []);

  const handleWatch = () => {
    if (!user) return;

    const currentWatched = user.watchedAds.ad3;
    if (currentWatched >= adexoraConfig.dailyLimit) return;

    const updates: Partial<UserData> = {
      watchedAds: {
        ...user.watchedAds,
        ad3: currentWatched + 1
      },
      // Changed from coins to keys - only give keys now
      keys: (user.keys || 0) + adexoraConfig.reward,
      lastAdWatch: {
        ...user.lastAdWatch,
        adexora: new Date().toISOString()
      }
    };

    updateUserData(updates);
  };

  const isDisabled = (user?.watchedAds.ad3 || 0) >= adexoraConfig.dailyLimit;

  const claimDirectTask = (taskId: string, rewardType: string, rewardAmount: number) => {
    if (!user) return;

    // Check if task is already claimed
    const isCompleted = user.tasksCompleted?.[taskId] || 0;
    if (isCompleted > 0) {
      alert('This task has already been completed!');
      return;
    }

    const updates: Partial<UserData> = {
      tasksCompleted: {
        ...user.tasksCompleted,
        [taskId]: 1
      }
    };

    // MODIFIED: Only give keys for direct tasks, ignore coin rewards
    if (rewardType === 'coin') {
      // Convert coin rewards to keys (1:1 ratio)
      updates.keys = (user.keys || 0) + rewardAmount;
    } else if (rewardType === 'key') {
      updates.keys = (user.keys || 0) + rewardAmount;
    } else if (rewardType === 'both') {
      // For "both" type, only give keys (sum of both amounts)
      updates.keys = (user.keys || 0) + rewardAmount + 1;
    }

    updateUserData(updates);
  };

  const totalKeys =
    (user?.watchedAds.ad3 || 0) * adexoraConfig.reward + // Keys from ads
    (Object.values(user?.tasksCompleted || {}).filter(completed => completed > 0).length || 0);

  // Format reward display - updated to show only keys
  const formatReward = (task: any) => {
    if (task.rewardType === 'coin') {
      return `+${task.rewardAmount} Key${task.rewardAmount > 1 ? 's' : ''}`;
    } else if (task.rewardType === 'key') {
      return `+${task.rewardAmount} Key${task.rewardAmount > 1 ? 's' : ''}`;
    } else if (task.rewardType === 'both') {
      const totalKeys = task.rewardAmount + 1;
      return `+${totalKeys} Key${totalKeys > 1 ? 's' : ''}`;
    }
    return `+${task.rewardAmount} Key${task.rewardAmount > 1 ? 's' : ''}`;
  };

  return (
    <div className="px-4 mt-4 md:mt-6 pb-32 md:pb-40 space-y-4 md:space-y-6">
      <div className="bg-[#ffffffcc] backdrop-blur-md rounded-2xl px-4 py-4 shadow-md border border-white/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center justify-between w-full">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-gradient-to-br from-yellow-300/80 to-amber-400/80 flex items-center justify-center shadow">
              <KeyRound className="w-5 h-5 md:w-7 md:h-7 text-white drop-shadow" />
            </div>

            <div className="text-right">
              <p className="text-[12px] md:text-[14px] text-gray-700">Total Keys Earned</p>
              <p className="text-[18px] md:text-[22px] font-bold text-gray-900 leading-tight">{totalKeys}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#ffffffcc] backdrop-blur-md rounded-2xl px-4 py-4 shadow-md border border-white/40">
        <p className="text-[16px] md:text-[18px] font-semibold text-gray-900 leading-tight">Ad Tasks</p>

        <WatchAdCard
          title="Watch Video Ad"
          reward={`+${adexoraConfig.reward} Key`}
          per="Per Video"
          watched={user?.watchedAds.ad3 || 0}
          total={adexoraConfig.dailyLimit}
          onWatch={handleWatch}
          disabled={isDisabled}
          adConfig={adexoraConfig}
          user={user}
        />
      </div>

      <div className="bg-[#ffffffcc] backdrop-blur-md rounded-2xl px-4 py-4 shadow-md border border-white/40">
        <p className="text-[16px] md:text-[18px] font-semibold text-gray-900 leading-tight mb-3">Direct Tasks</p>

        {loadingDirectTasks ? (
          <div className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : directTasks.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <p>No direct tasks available</p>
            <p className="text-sm">Check back later for new tasks</p>
          </div>
        ) : (
          <div className="space-y-3">
            {directTasks.map((task) => {
              const isCompleted = user?.tasksCompleted?.[task.id] || 0;

              return (
                <DirectTaskItem
                  key={task.id}
                  icon={<LinkIcon className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />}
                  title={task.name}
                  claimed={isCompleted > 0}
                  onClaim={() => claimDirectTask(task.id, task.rewardType, task.rewardAmount)}
                  rewardLabel={formatReward(task)}
                  url={task.url}
                  waitTime={task.waitTime || 20}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Main App Component ---------------- */

type Tab = "home" | "tasks" | "friends" | "bonus" | "profile" | "spin";

const App: React.FC = () => {
  const [tab, setTab] = useState<Tab>("home");
  const { user, loading, showWelcome, updateUserData } = useTelegramAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#f8fafc] to-[#f1f5f9] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 md:w-16 md:h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3 md:mb-4"></div>
          <p className="text-gray-600 text-sm md:text-base">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#F2F2F2] flex justify-center min-h-screen">
      <div className="w-full text-black font-bold flex flex-col max-w-xl relative">
        <WelcomeModal
          show={showWelcome}
          userName={user?.firstName || "User"}
        />

        {tab === "home" && (
          <Home
            onNavigateToSpin={() => setTab("spin")}
            user={user}
            updateUserData={updateUserData}
          />
        )}
        {tab === "tasks" && (
          <TasksPage
            user={user}
            updateUserData={updateUserData}
          />
        )}
        {tab === "friends" && (
          <Refer
            user={user}
            updateUserData={updateUserData}
          />
        )}
        {tab === "bonus" && (
          <BonusPage
            user={user}
            updateUserData={updateUserData}
          />
        )}
        {tab === "profile" && (
          <ProfilePage
            user={user}
            updateUserData={updateUserData}
          />
        )}
        {tab === "spin" && (
          <SpinPage
            onBack={() => setTab("home")}
            user={user}
            updateUserData={updateUserData}
          />
        )}

        {/* Bottom nav - Only show when not on spin page */}
        {tab !== "spin" && <Navbar currentTab={tab} onTabChange={setTab} />}
      </div>
    </div>
  );
};

export default App;
