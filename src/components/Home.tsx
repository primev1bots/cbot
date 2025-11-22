import React, { useState, useEffect } from "react";
import { Coins, KeyRound, Gem, Wallet } from "lucide-react";
import { database } from "../App";
import { ref, onValue } from 'firebase/database';

interface UserData {
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

interface HomeProps {
  onNavigateToSpin: () => void;
  user: UserData | null;
  updateUserData: (updates: Partial<UserData>) => void;
}

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

// Define the window interface to include the dynamically created SDK functions
declare global {
  interface Window {
    show_9673543?: () => Promise<void>; // Monetag function name based on zone ID 9878570
    showAdsovio?: () => Promise<void>;  // Adsovio function name
    showAdexora: () => Promise<void>;  // Adexora function name
  }
}

const Home: React.FC<HomeProps> = ({ onNavigateToSpin, user, updateUserData }) => {
  // State to track loading status of each ad zone and disable buttons accordingly
  const [adLoadingStatus, setAdLoadingStatus] = useState<Record<string, boolean>>({
    monetag: false,
    adsovio: false,
    adexora: false,
  });

  // State to track if SDK scripts for each network are loaded
  const [sdkLoaded, setSdkLoaded] = useState<Record<string, boolean>>({
    monetag: false,
    adsovio: false,
    adexora: false,
  });

  // State for ad configuration from AdminPanel
  const [adConfig, setAdConfig] = useState<AdsConfig>({
    monetag: { reward: 5, dailyLimit: 10, cooldown: 60, enabled: true },
    adsovio: { reward: 5, dailyLimit: 10, cooldown: 60, enabled: true },
    adexora: { reward: 5, dailyLimit: 10, cooldown: 60, enabled: true },
  });

  // State for cooldown timers
  const [cooldownLeft, setCooldownLeft] = useState<Record<string, number>>({
    monetag: 0,
    adsovio: 0,
    adexora: 0,
  });

  // Define the zone IDs and app UIDs
  const MONETAG_ZONE_ID = "9673543";
  const ADSOVIO_APP_UID = "3105";
  const ADEXORA_APP_ID = "1028";

  // Load ad configuration from Firebase
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

  // Calculate cooldown timers
  useEffect(() => {
    if (!user?.lastAdWatch) return;

    const updateCooldowns = () => {
      const currentTime = new Date().getTime();
      const newCooldowns: Record<string, number> = {};

      Object.keys(adConfig).forEach(provider => {
        const lastWatchTime = user.lastAdWatch?.[provider as keyof typeof user.lastAdWatch];
        if (lastWatchTime) {
          const timeSinceLastWatch = Math.floor((currentTime - new Date(lastWatchTime).getTime()) / 1000);
          const cooldownRemaining = Math.max(0, adConfig[provider as keyof AdsConfig].cooldown - timeSinceLastWatch);
          newCooldowns[provider] = cooldownRemaining;
        } else {
          newCooldowns[provider] = 0;
        }
      });

      setCooldownLeft(newCooldowns);
    };

    updateCooldowns();
    const interval = setInterval(updateCooldowns, 1000);

    return () => clearInterval(interval);
  }, [user?.lastAdWatch, adConfig]);

  /**
   * Dynamically loads the Monetag SDK script.
   */
  const loadMonetagSdkScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      const scriptId = `monetag-sdk-${MONETAG_ZONE_ID}`;

      if (document.getElementById(scriptId)) {
        if (typeof (window as any).show_9673543 === 'function') {
          setSdkLoaded(prev => ({ ...prev, monetag: true }));
          resolve();
        } else {
          reject(new Error(`Monetag SDK function show_${MONETAG_ZONE_ID} not found.`));
        }
        return;
      }

      const script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://libtl.com/sdk.js`;
      script.setAttribute('data-zone', MONETAG_ZONE_ID);
      script.setAttribute('data-sdk', `show_${MONETAG_ZONE_ID}`);
      script.async = true;

      script.onload = () => {
        if (typeof (window as any).show_9673543 === 'function') {
          setSdkLoaded(prev => ({ ...prev, monetag: true }));
          resolve();
        } else {
          reject(new Error(`Monetag SDK function show_${MONETAG_ZONE_ID} not found after loading.`));
        }
      };

      script.onerror = (error) => {
        reject(error);
      };

      document.head.appendChild(script);
    });
  };

  /**
   * Waits for the Adsovio SDK function to be available.
   */
  const waitForAdsovioFunction = (timeoutMs: number = 10000): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (typeof (window as any).showAdsovio === 'function') {
        resolve();
        return;
      }

      const interval = setInterval(() => {
        if (typeof (window as any).showAdsovio === 'function') {
          clearInterval(interval);
          resolve();
        }
      }, 100);

      setTimeout(() => {
        clearInterval(interval);
        reject(new Error("Adsovio SDK function showAdsovio not found after loading and polling."));
      }, timeoutMs);
    });
  };

  /**
   * Dynamically loads the Adsovio SDK script.
   */
  const loadAdsovioSdkScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      const scriptId = `adsovio-sdk-${ADSOVIO_APP_UID}`;

      if (document.getElementById(scriptId)) {
        waitForAdsovioFunction(2000)
          .then(() => {
            setSdkLoaded(prev => ({ ...prev, adsovio: true }));
            resolve();
          })
          .catch(err => reject(err));
        return;
      }

      const script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://adsovio.com/cdn/ads.js?app_uid=${ADSOVIO_APP_UID}`;
      script.async = true;

      script.onload = () => {
        waitForAdsovioFunction()
          .then(() => {
            setSdkLoaded(prev => ({ ...prev, adsovio: true }));
            resolve();
          })
          .catch(err => reject(err));
      };

      script.onerror = (error) => {
        reject(error);
      };

      document.head.appendChild(script);
    });
  };

  /**
   * Dynamically loads the Adexora SDK script.
   */
  const loadAdexoraSdkScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      const scriptId = `adexora-sdk-${ADEXORA_APP_ID}`;

      if (document.getElementById(scriptId)) {
        if (typeof (window as any).showAdexora === 'function') {
          setSdkLoaded(prev => ({ ...prev, adexora: true }));
          resolve();
        } else {
          reject(new Error('Adexora SDK function showAdexora not found.'));
        }
        return;
      }

      const script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://adexora.com/cdn/ads.js?id=${ADEXORA_APP_ID}`;
      script.async = true;

      script.onload = () => {
        setTimeout(() => {
          if (typeof (window as any).showAdexora === 'function') {
            setSdkLoaded(prev => ({ ...prev, adexora: true }));
            resolve();
          } else {
            reject(new Error('Adexora ad function not available'));
          }
        }, 1000);
      };

      script.onerror = () => reject(new Error('Failed to load ad script'));
      document.head.appendChild(script);
    });
  };

  /**
   * Attempts to show a Monetag ad.
   */
  const showMonetagAd = async () => {
    if (!user) return;

    const provider: keyof AdsConfig = 'monetag';
    const config = adConfig[provider];
    const currentWatched = user.watchedAds.ad1;

    if (!config.enabled) {
      alert('Monetag ads are currently disabled.');
      return;
    }

    if (currentWatched >= config.dailyLimit) {
      alert(`You have watched the maximum number of Monetag ads for today.`);
      return;
    }

    if (cooldownLeft[provider] > 0) {
      alert(`Please wait ${cooldownLeft[provider]} seconds before watching another Monetag ad.`);
      return;
    }

    if (adLoadingStatus[provider]) return;

    setAdLoadingStatus(prev => ({ ...prev, [provider]: true }));

    try {
      if (!sdkLoaded.monetag) {
        await loadMonetagSdkScript();
      }

      const showFunction = (window as any).show_9878570;
      if (typeof showFunction !== 'function') {
        throw new Error(`Monetag ad function show_${MONETAG_ZONE_ID} is not available.`);
      }

      await showFunction();

      const updates: Partial<UserData> = {
        watchedAds: {
          ...user.watchedAds,
          ad1: currentWatched + 1
        },
        coins: user.coins + config.reward,
        lastAdWatch: {
          ...user.lastAdWatch,
          monetag: new Date().toISOString()
        }
      };

      updateUserData(updates);
      alert(`Monetag Ad completed! +${config.reward} Coins earned!`);

    } catch (error) {
      console.error(`Error showing Monetag ad:`, error);
      alert('Monetag Ad failed to load or was closed early. No reward given.');
    } finally {
      setAdLoadingStatus(prev => ({ ...prev, [provider]: false }));
    }
  };

  /**
   * Attempts to show an Adsovio ad.
   */
  const showAdsovioAd = async () => {
    if (!user) return;

    const provider: keyof AdsConfig = 'adsovio';
    const config = adConfig[provider];
    const currentWatched = user.watchedAds.ad2;

    if (!config.enabled) {
      alert('Adsovio ads are currently disabled.');
      return;
    }

    if (currentWatched >= config.dailyLimit) {
      alert(`You have watched the maximum number of Adsovio ads for today.`);
      return;
    }

    if (cooldownLeft[provider] > 0) {
      alert(`Please wait ${cooldownLeft[provider]} seconds before watching another Adsovio ad.`);
      return;
    }

    if (adLoadingStatus[provider]) return;

    setAdLoadingStatus(prev => ({ ...prev, [provider]: true }));

    try {
      if (!sdkLoaded.adsovio) {
        await loadAdsovioSdkScript();
      }

      const showFunction = (window as any).showAdsovio;
      if (typeof showFunction !== 'function') {
        throw new Error(`Adsovio ad function showAdsovio is not available.`);
      }

      await showFunction();

      const updates: Partial<UserData> = {
        watchedAds: {
          ...user.watchedAds,
          ad2: currentWatched + 1
        },
        coins: user.coins + config.reward,
        lastAdWatch: {
          ...user.lastAdWatch,
          adsovio: new Date().toISOString()
        }
      };

      updateUserData(updates);
      alert(`Adsovio Ad completed! +${config.reward} Coins earned!`);

    } catch (error) {
      console.error(`Error showing Adsovio ad:`, error);
      alert('Adsovio Ad failed to load or was closed early. No reward given.');
    } finally {
      setAdLoadingStatus(prev => ({ ...prev, [provider]: false }));
    }
  };

  /**
   * Attempts to show an Adexora ad.
   */
  const showAdexoraAd = async () => {
    if (!user) return;

    const provider: keyof AdsConfig = 'adexora';
    const config = adConfig[provider];
    const currentWatched = user.watchedAds.ad3;

    if (!config.enabled) {
      alert('Adexora ads are currently disabled.');
      return;
    }

    if (currentWatched >= config.dailyLimit) {
      alert(`You have watched the maximum number of Adexora ads for today.`);
      return;
    }

    if (cooldownLeft[provider] > 0) {
      alert(`Please wait ${cooldownLeft[provider]} seconds before watching another Adexora ad.`);
      return;
    }

    if (adLoadingStatus[provider]) return;

    setAdLoadingStatus(prev => ({ ...prev, [provider]: true }));

    try {
      if (!sdkLoaded.adexora) {
        await loadAdexoraSdkScript();
      }

      const showFunction = (window as any).showAdexora;
      if (typeof showFunction !== 'function') {
        throw new Error('Adexora ad function not available');
      }

      await showFunction();

      const updates: Partial<UserData> = {
        watchedAds: {
          ...user.watchedAds,
          ad3: currentWatched + 1
        },
        coins: user.coins + config.reward,
        lastAdWatch: {
          ...user.lastAdWatch,
          adexora: new Date().toISOString()
        }
      };

      updateUserData(updates);
      alert(`Adexora Ad completed! +${config.reward} Coins earned!`);

    } catch (error) {
      console.error('Error watching ad:', error);
      alert('Adexora Ad failed to load. Please try again.');
    } finally {
      setAdLoadingStatus(prev => ({ ...prev, [provider]: false }));
    }
  };

  const handleWatch = (provider: keyof AdsConfig) => {
    switch (provider) {
      case 'monetag':
        showMonetagAd();
        break;
      case 'adsovio':
        showAdsovioAd();
        break;
      case 'adexora':
        showAdexoraAd();
        break;
    }
  };

  const isDisabled = (provider: keyof AdsConfig) => {
    const config = adConfig[provider];
    const watchedCount =
      provider === 'monetag' ? user?.watchedAds.ad1 || 0 :
        provider === 'adsovio' ? user?.watchedAds.ad2 || 0 :
          user?.watchedAds.ad3 || 0;

    return !config.enabled ||
      watchedCount >= config.dailyLimit ||
      cooldownLeft[provider] > 0 ||
      adLoadingStatus[provider];
  };

  const getButtonText = (provider: keyof AdsConfig) => {
    const config = adConfig[provider];

    if (!config.enabled) return "Ads Disabled";
    if (cooldownLeft[provider] > 0) return `Cooldown: ${cooldownLeft[provider]}s`;
    if (adLoadingStatus[provider]) return "Loading ad...";

    const watchedCount =
      provider === 'monetag' ? user?.watchedAds.ad1 || 0 :
        provider === 'adsovio' ? user?.watchedAds.ad2 || 0 :
          user?.watchedAds.ad3 || 0;

    if (watchedCount >= config.dailyLimit) return "Daily Limit Reached";
    return "Watch Video Ad";
  };

  const displayName = user?.firstName || "User";
  const userInitials = user?.firstName?.charAt(0) + (user?.lastName?.charAt(0) || "");

  // Preload SDKs on component mount
  useEffect(() => {
    const preloadSdks = async () => {
      try {
        if (!sdkLoaded.monetag && adConfig.monetag.enabled) {
          await loadMonetagSdkScript();
        }
        if (!sdkLoaded.adsovio && adConfig.adsovio.enabled) {
          await loadAdsovioSdkScript();
        }
        if (!sdkLoaded.adexora && adConfig.adexora.enabled) {
          await loadAdexoraSdkScript();
        }
      } catch (error) {
        console.warn("Error preloading SDKs:", error);
      }
    };

    preloadSdks();
  }, [sdkLoaded, adConfig]);

  return (
    <>
      {/* Main Header */}
      <div className="px-4 z-10 mt-4 md:mt-6">
        <div className="flex justify-between items-center pt-4 bg-gradient-to-br from-white/50 to-white/20 backdrop-blur-2xl border border-white/40 shadow-xl rounded-3xl p-4 md:p-5">
          {/* Left: Avatar + Name */}
          <div className="flex items-center space-x-3">
            <div className="p-1 rounded-full bg-gradient-to-br from-gray-900 to-gray-700 shadow-lg">
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center bg-gray-900 overflow-hidden border border-gray-600">
                <img
                  src="/logo.png"
                  alt="App Logo"
                  className="w-12 h-12 md:w-14 md:h-14 object-contain transition-transform duration-300 ease-out hover:scale-125"
                />
              </div>
            </div>

            <div>
              <p className="text-[16px] md:text-[18px] font-bold text-gray-900 drop-shadow-sm">
                Coin Earn
              </p>
            </div>
          </div>


          {/* Right: Wallet Info */}
          <div className="flex items-center rounded-full px-3 py-1.5 md:px-5 md:py-2 bg-white/60 border border-white/40 shadow-lg backdrop-blur-xl">
            <Wallet className="w-5 h-5 md:w-7 md:h-7 text-gray-700 drop-shadow" />

            <div className="h-5 md:h-7 w-px bg-gray-300 mx-2 md:mx-3" />

            <div className="text-center">
              <div className="flex items-center justify-center space-x-1">
                <span className="text-green-500 text-sm md:text-lg font-bold">$</span>
                <span className="text-gray-900 font-semibold text-sm md:text-base">{user?.balance.toFixed(2) || "0.00"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body - Fixed height issue */}
      <div className="flex-grow min-h-0 relative pb-28 md:pb-32 overflow-y-auto">
        <div className="px-4 mt-3 space-y-4 pb-4">
          {/* Profile + Balances */}
          <div className="bg-[#ffffffcc] backdrop-blur-md rounded-2xl px-4 py-4 shadow-md border border-white/40">
            <div className="flex items-center gap-3 md:gap-4 mb-4 md:mb-5">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden border-2 border-white shadow-md">
                {user?.photoUrl ? (
                  <img
                    src={user.photoUrl}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg md:text-xl">
                    {userInitials}
                  </div>
                )}
              </div>
              <div>
                <p className="text-[16px] md:text-[18px] font-semibold text-gray-900 leading-tight">
                  {displayName}
                </p>
              </div>
            </div>

            <div className="flex justify-around items-center bg-white/80 text-gray-900 py-2 px-3 md:px-4 rounded-md border border-gray-200 backdrop-blur">
              <div className="flex items-center space-x-1 md:space-x-2">
                <Coins className="w-5 h-5 md:w-6 md:h-6 text-yellow-500" />
                <p className="font-semibold text-sm md:text-base">{user?.coins || 0} Coin</p>
              </div>
              <div className="flex items-center space-x-1 md:space-x-2">
                <KeyRound className="w-5 h-5 md:w-6 md:h-6 text-amber-500" />
                <p className="font-semibold text-sm md:text-base">{user?.keys || 0} Key</p>
              </div>
              <div className="flex items-center space-x-1 md:space-x-2">
                <Gem className="w-5 h-5 md:w-6 md:h-6 text-blue-500" />
                <p className="font-semibold text-sm md:text-base">{user?.diamonds || 0}</p>
              </div>
            </div>
          </div>

          {/* Watch Ads */}
          <div className="bg-[#ffffffcc] backdrop-blur-md rounded-2xl px-4 py-4 shadow-md border border-white/40">
            <div>
              <p className="text-[16px] md:text-[18px] font-semibold text-gray-900 leading-tight">Watch Ads</p>
              <p className="text-xs text-gray-600 mt-1">Watch short ads to earn coins!</p>
            </div>

            {/* Monetag Ad */}
            <div className="mt-3">
              <button
                onClick={() => handleWatch('monetag')}
                disabled={isDisabled('monetag')}
                className={[
                  "w-full text-left bg-gradient-to-r from-green-400/60 to-emerald-500/60 backdrop-blur-md rounded-xl px-4 py-2.5 shadow-md border border-green-300 flex items-center justify-between transition-all duration-300",
                  isDisabled('monetag') ? "opacity-60 cursor-not-allowed" : "hover:scale-[1.02] cursor-pointer",
                  adLoadingStatus.monetag ? "opacity-80 cursor-wait" : "",
                ].join(" ")}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 md:w-14 md:h-14 rounded-lg bg-white/20 flex items-start overflow-hidden">
                      <img
                        src="/monetag.png"
                        alt="Monetag logo"
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {adLoadingStatus.monetag && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                  </div>


                  <div className="text-white">
                    <p className="text-[14px] font-semibold leading-tight">Monetag Ads</p>
                    <p className="text-[12px] text-white/90 leading-tight">
                      {getButtonText('monetag')}
                    </p>
                    <p className="text-[11px] text-white/90 mt-1">
                      Watched: <span className="font-semibold">{user?.watchedAds.ad1 || 0}/{adConfig.monetag.dailyLimit}</span>
                    </p>
                  </div>
                </div>


                <div className="text-right">
                  <p className="text-[13px] font-semibold text-white">+{adConfig.monetag.reward} Coin</p>
                  <p className="text-[10px] text-white/70">Per Video</p>
                </div>
              </button>
            </div>

            {/* Adsovio Ad */}
            <div className="mt-3">
              <button
                onClick={() => handleWatch('adsovio')}
                disabled={isDisabled('adsovio')}
                className={[
                  "w-full text-left bg-gradient-to-r from-green-400/60 to-emerald-500/60 backdrop-blur-md rounded-xl px-4 py-2.5 shadow-md border border-green-300 flex items-center justify-between transition-all duration-300",
                  isDisabled('adsovio') ? "opacity-60 cursor-not-allowed" : "hover:scale-[1.02] cursor-pointer",
                  adLoadingStatus.adsovio ? "opacity-80 cursor-wait" : "",
                ].join(" ")}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 md:w-14 md:h-14 rounded-lg bg-white/20 flex items-start overflow-hidden">
                      <img
                        src="/adsovio.png"
                        alt="Adsovio logo"
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {adLoadingStatus.adsovio && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                  </div>

                  <div className="text-white">
                    <p className="text-[14px] font-semibold leading-tight">Adsovio Ads</p>
                    <p className="text-[12px] text-white/90 leading-tight">
                      {getButtonText('adsovio')}
                    </p>
                    <p className="text-[11px] text-white/90 mt-1">
                      Watched: <span className="font-semibold">{user?.watchedAds.ad2 || 0}/{adConfig.adsovio.dailyLimit}</span>
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-[13px] font-semibold text-white">+{adConfig.adsovio.reward} Coin</p>
                  <p className="text-[10px] text-white/70">Per Video</p>
                </div>
              </button>
            </div>

          </div>

          {/* Spin & Win */}
          <div className="bg-[#ffffffcc] backdrop-blur-md rounded-2xl px-4 py-4 shadow-md border border-white/40">
            <div className="flex flex-col items-center text-center">
              <p className="text-[16px] md:text-[18px] font-semibold text-gray-900 leading-tight mb-2">
                🎡 স্পিন করুন ও পয়েন্ট জিতুন!
              </p>
              {/* Spin & Win */}
              <button
                onClick={onNavigateToSpin}
                className="w-full text-left bg-gradient-to-r from-pink-500/60 to-purple-500/60 backdrop-blur-md rounded-xl px-4 py-2.5 shadow-md border border-pink-300 flex items-center justify-between transition-all duration-300 hover:scale-[1.02] cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-white/20 rounded-full flex items-center justify-center">
                      {/* Spin Icon */}
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 md:w-5 md:h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
                      </svg>
                    </div>
                  </div>
                  <div className="text-white">
                    <p className="text-[14px] font-semibold leading-tight">Spin & Win</p>
                    <p className="text-[12px] text-white/90 leading-tight">
                      Spin the wheel and win coins!
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-[13px] font-semibold text-white">Free Spin</p>
                  <p className="text-[10px] text-white/70">Tap to Play</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Home;




just fix adsovio ads showing problem never add anything 
