import React, { useState, useEffect, useRef } from "react";
import {
  KeyRound,
  Link as LinkIcon,
  Clock,
  Sparkles,
  CheckCircle,
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
        const userData = snapshot.val() as UserData;
        const updatedUser = {
          ...userData,
          lastLogin: new Date().toISOString(),
          photoUrl: userData.photoUrl || telegramUser.photo_url
        };

        const updates: any = {
          lastLogin: updatedUser.lastLogin
        };

        if (telegramUser.photo_url && !userData.photoUrl) {
          updates.photoUrl = telegramUser.photo_url;
        }

        await update(userRef, updates);
        setUser(updatedUser);
        setShowWelcome(false);

        setupRealtimeUpdates(telegramUser.id);
      } else {
        const newUser: UserData = {
          telegramId: telegramUser.id,
          firstName: telegramUser.first_name,
          lastName: telegramUser.last_name,
          username: telegramUser.username,
          photoUrl: telegramUser.photo_url,
          joinDate: new Date().toISOString(),
          ...defaultUserData
        };

        await set(userRef, newUser);
        setUser(newUser);
        setShowWelcome(true);

        setupRealtimeUpdates(telegramUser.id);

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
      }
    });

    return () => off(userRef, 'value', unsubscribe);
  };

  const updateUserData = async (updates: Partial<UserData>) => {
    if (!user) return;

    try {
      const userRef = ref(database, `users/${user.telegramId}`);
      await update(userRef, updates);
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
      <div className="bg-gradient-to-br from-green-400 to-emerald-600 rounded-3xl p-8 text-center text-white max-w-sm w-full animate-bounce shadow-2xl">
        <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
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

/* ---------------- Watch Ad Card ---------------- */

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
      if (typeof window.showAdexora === 'function') {
        window.showAdexora()
          .then(() => resolve(true))
          .catch(reject);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://adexora.com/cdn/ads.js?id=1028';
      script.async = true;

      script.onload = () => {
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
      await loadAndShowAd();
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
          "w-full text-left bg-gradient-to-r from-green-400/80 to-emerald-500/80 backdrop-blur-md rounded-2xl px-5 py-3.5 shadow-md border border-green-300 flex items-center justify-between transition-all duration-300",
          isAdDisabled ? "opacity-60 cursor-not-allowed" : "hover:scale-[1.02] hover:shadow-lg cursor-pointer",
          isLoading ? "opacity-80 cursor-wait" : "",
        ].join(" ")}
      >
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-white/20 flex items-start overflow-hidden shadow-sm">
              <img
                src="/adexora.png"
                alt="Play Icon"
                className="w-full h-full object-cover"
              />
            </div>

            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl backdrop-blur-sm">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>

          <div className="text-white">
            <p className="text-[15px] font-bold leading-tight">{title}</p>
            <p className="text-[12px] text-white/90 leading-tight mt-0.5 font-medium">
              {getButtonText()}
            </p>
            <p className="text-[11px] text-white/80 mt-1">
              Watched: <span className="font-bold">{watched}/{adConfig.dailyLimit}</span>
            </p>
          </div>
        </div>

        <div className="text-right bg-white/20 px-3 py-2 rounded-xl border border-white/20">
          <p className="text-[14px] font-bold text-white whitespace-nowrap">+{adConfig.reward} Key</p>
          <p className="text-[10px] text-white/80 font-medium">{per}</p>
        </div>
      </button>
    </div>
  );
}

/* ---------------- Improved Direct Task Item Component ---------------- */

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
    <div className={`w-full text-left rounded-2xl p-4 shadow-sm border transition-all duration-300 ${claimed ? 'bg-gray-50/80 border-gray-200 opacity-75' : 'bg-white border-blue-100 hover:shadow-md hover:border-blue-300'}`}>
      <div className="flex items-center gap-3">
        {/* Visual Identity / Icon */}
        <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${claimed ? 'bg-green-100 text-green-500' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
          {claimed ? <CheckCircle className="w-5 h-5" /> : icon}
        </div>

        {/* Info Block */}
        <div className="flex-1 min-w-0">
          <h3 className={`text-[15px] font-bold truncate ${claimed ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
            {title}
          </h3>
          <div className="mt-1 flex items-center gap-2">
            <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wide ${claimed ? 'bg-gray-200 text-gray-500' : 'bg-green-100 text-green-700 border border-green-200'}`}>
              {rewardLabel}
            </span>
            {isWaiting && !canClaim && (
              <span className="text-[11px] text-blue-600 font-bold flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                <Clock className="w-3 h-3" /> {timeLeft}s remaining
              </span>
            )}
          </div>
        </div>

        {/* Call to Action Button */}
        <div className="flex-shrink-0 ml-2">
          {claimed ? (
            <span className="text-[12px] font-bold text-green-600 flex items-center gap-1 bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
              <Sparkles className="w-3.5 h-3.5" /> Claimed
            </span>
          ) : isWaiting ? (
            <button
              onClick={handleClaim}
              disabled={!canClaim}
              className={`px-4 py-2 rounded-xl text-[12px] font-bold transition-all duration-300 ${canClaim
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-md hover:shadow-lg transform hover:scale-[1.05]'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
            >
              {canClaim ? '🎉 Claim Now' : 'Waiting...'}
            </button>
          ) : (
            <button
              onClick={startTask}
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-xl text-[12px] font-bold transition-all flex items-center gap-1.5 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              Start Task
            </button>
          )}
        </div>
      </div>

      {/* Animated Progress Bar Row */}
      {isWaiting && !canClaim && (
        <div className="mt-3.5 w-full bg-gray-100 rounded-full h-1.5 overflow-hidden shadow-inner">
          <div
            className="bg-gradient-to-r from-blue-400 to-indigo-500 h-full rounded-full transition-all duration-1000 ease-linear"
            style={{ width: `${((waitTime - timeLeft) / waitTime) * 100}%` }}
          />
        </div>
      )}
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

  const [directTasks, setDirectTasks] = useState<any[]>([]);
  const [loadingDirectTasks, setLoadingDirectTasks] = useState(true);

  useEffect(() => {
    const loadDirectTasks = () => {
      setLoadingDirectTasks(true);
      const tasksRef = ref(database, 'tasks');
      onValue(tasksRef, (snapshot) => {
        if (snapshot.exists()) {
          const tasksData: any[] = [];
          snapshot.forEach((childSnapshot) => {
            const taskData = childSnapshot.val();
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

    // FIXED LOGIC: 'both' now correctly adds ONLY the exact reward amount (no +1)
    if (rewardType === 'coin' || rewardType === 'key' || rewardType === 'both') {
      updates.keys = (user.keys || 0) + rewardAmount;
    }

    updateUserData(updates);
  };

  // FIXED LOGIC: directly fetching actual keys balance from the user database object
  const totalKeys = user?.keys || 0;

  // FIXED LOGIC: formatReward now displays the exact reward amount without adding +1
  const formatReward = (task: any) => {
    return `+${task.rewardAmount} Key${task.rewardAmount > 1 ? 's' : ''}`;
  };

  return (
    <div className="px-4 mt-4 md:mt-6 pb-32 md:pb-40 space-y-4 md:space-y-6 max-w-lg mx-auto">
      {/* Total Keys Banner */}
      <div className="bg-gradient-to-r from-yellow-400 to-amber-500 rounded-2xl px-5 py-5 shadow-lg shadow-amber-500/20 text-white relative overflow-hidden">
        <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white/20 flex items-center justify-center shadow-inner backdrop-blur-sm border border-white/30">
              <KeyRound className="w-6 h-6 md:w-8 md:h-8 text-white drop-shadow-md" />
            </div>
            <div>
              <p className="text-[13px] md:text-[15px] font-medium text-amber-50">Total Keys Earned</p>
              <p className="text-[24px] md:text-[28px] font-bold leading-tight drop-shadow-sm">{totalKeys}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Ad Tasks Section */}
      <div className="bg-white/90 backdrop-blur-xl rounded-3xl px-5 py-5 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-6 bg-green-500 rounded-full"></div>
          <h2 className="text-[18px] md:text-[20px] font-bold text-gray-800">Ad Tasks</h2>
        </div>

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

      {/* Direct Tasks Section */}
      <div className="bg-white/90 backdrop-blur-xl rounded-3xl px-5 py-5 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-6 bg-blue-500 rounded-full"></div>
          <h2 className="text-[18px] md:text-[20px] font-bold text-gray-800">Direct Tasks</h2>
        </div>

        {loadingDirectTasks ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : directTasks.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <p className="text-gray-600 font-medium">No tasks available right now</p>
            <p className="text-sm text-gray-400 mt-1">Check back later for new rewards</p>
          </div>
        ) : (
          <div className="space-y-3">
            {directTasks.map((task) => {
              const isCompleted = user?.tasksCompleted?.[task.id] || 0;

              return (
                <DirectTaskItem
                  key={task.id}
                  icon={<LinkIcon className="w-5 h-5 md:w-6 md:h-6" />}
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
          <p className="text-gray-600 text-sm md:text-base font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 flex justify-center min-h-screen font-sans">
      <div className="w-full flex flex-col max-w-md relative bg-white min-h-screen shadow-xl">
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
