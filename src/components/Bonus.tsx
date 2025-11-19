import { useMemo, useState, useEffect } from "react";
import {
  Coins,
  Clock,
  ArrowLeft,
  Lock,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import Confetti from 'react-confetti';
import { FaTelegram, FaGem, FaTasks } from "react-icons/fa";
import { ref, onValue } from 'firebase/database';
import { database } from '../App';

/* ---------------- Type Declarations ---------------- */

type TaskCategory = "All" | "Socials Tasks" | "TG Tasks";

interface Task {
  id: string;
  name: string;
  category: TaskCategory | "General";
  reward: number;
  telegramChannel?: string;
  checkMembership?: boolean;
  buttonText?: string;
  url?: string;
  isDiamondTask?: boolean;
  diamondReward?: number;
  taskType?: 'direct' | 'regular' | 'giveaway';
  rewardType?: 'coin' | 'key';
  rewardAmount?: number;
}

interface FirebaseTask {
  id: string;
  name: string;
  taskType: 'direct' | 'regular' | 'giveaway';
  category: string;
  reward?: number;
  rewardType?: 'coin' | 'key';
  rewardAmount?: number;
  url?: string;
  telegramChannel?: string;
  checkMembership?: boolean;
  buttonText?: string;
  currentUsers?: Record<string, boolean>;
  isDiamondTask?: boolean;
  diamondReward?: number;
}

interface GiveawaySettings {
  totalPrizePool: number;
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
    ad1: number;
    ad2: number;
    ad3: number;
  };
  directTasksClaimed: boolean[];
  referrals: string[];
  totalEarned: number;
  lastLogin: string;
}

interface BonusPageProps {
  user: UserData | null;
  updateUserData: (updates: Partial<UserData>) => void;
}

/* ---------------- Bonus Page Component ---------------- */

function BonusPage({ user, updateUserData }: BonusPageProps) {
  const [dailyTaskFilter, setDailyTaskFilter] = useState<TaskCategory>("All");
  const [isServerOnline] = useState(true);
  const [taskErrors, setTaskErrors] = useState<Record<string, string>>({});
  const [startingTask, setStartingTask] = useState<string | null>(null);
  const [claimingTask, setClaimingTask] = useState<string | null>(null);
  const [pendingTask, setPendingTask] = useState<Task | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showGiveaway, setShowGiveaway] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [verifyingMembership, setVerifyingMembership] = useState<string | null>(null);
  const [firebaseTasks, setFirebaseTasks] = useState<FirebaseTask[]>([]);
  const [giveawaySettings, setGiveawaySettings] = useState<GiveawaySettings>({
    totalPrizePool: 0
  });
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [claimingAll, setClaimingAll] = useState(false);
  const pageSize = 3;

  // Backend server URL
  const BACKEND_URL = 'https://178ql44r-3001.asse.devtunnels.ms';

  useEffect(() => {
    // Load tasks from Firebase
    const loadTasks = () => {
      setLoadingTasks(true);
      const tasksRef = ref(database, 'tasks');
      onValue(tasksRef, (snapshot) => {
        if (snapshot.exists()) {
          const tasksData: FirebaseTask[] = [];
          snapshot.forEach((childSnapshot) => {
            const taskData = childSnapshot.val();
            tasksData.push({
              ...taskData,
              id: childSnapshot.key,
            });
          });
          setFirebaseTasks(tasksData);
        } else {
          setFirebaseTasks([]);
        }
        setLoadingTasks(false);
      });
    };

    // Load giveaway settings
    const loadGiveawaySettings = () => {
      const settingsRef = ref(database, 'giveawaySettings');
      onValue(settingsRef, (snapshot) => {
        if (snapshot.exists()) {
          setGiveawaySettings(snapshot.val());
        }
      });
    };

    loadTasks();
    loadGiveawaySettings();
  }, []);

  useEffect(() => {
    if (showConfetti) {
      const timer = setTimeout(() => setShowConfetti(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showConfetti]);

  // Convert Firebase tasks to app tasks
  const regularTasks = useMemo(() => {
    return firebaseTasks
      .filter(task => task.taskType === 'regular')
      .map(task => ({
        id: task.id,
        name: task.name,
        category: task.category as TaskCategory,
        reward: task.reward || 0,
        telegramChannel: task.telegramChannel,
        checkMembership: task.checkMembership,
        url: task.url,
        buttonText: "Start Task",
        isDiamondTask: true,
        diamondReward: task.reward || 1
      }));
  }, [firebaseTasks]);

  const giveawayTasks = useMemo(() => {
    const giveawayTasks = firebaseTasks.filter(task => task.taskType === 'giveaway');
    const totalGiveawayTasks = giveawayTasks.length;

    // Calculate individual reward from total prize pool
    const individualReward = totalGiveawayTasks > 0
      ? giveawaySettings.totalPrizePool / totalGiveawayTasks
      : 0;

    return giveawayTasks.map(task => ({
      id: task.id,
      name: task.name,
      category: "TG Tasks" as TaskCategory,
      reward: individualReward, // Calculate individual reward from total prize pool
      telegramChannel: task.telegramChannel,
      checkMembership: true,
      buttonText: "Join Channel",
      isDiamondTask: false,
      diamondReward: 0
    }));
  }, [firebaseTasks, giveawaySettings.totalPrizePool]);

  // Function to check Telegram channel membership
  const checkTelegramMembership = async (taskId: string, channel: string): Promise<boolean> => {
    if (!user) return false;

    setVerifyingMembership(taskId);

    try {
      const response = await fetch(`${BACKEND_URL}/api/telegram/check-membership`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.telegramId,
          channel: channel,
          taskId: taskId,
          taskName: 'Telegram Channel Join'
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        return data.isMember;
      } else {
        throw new Error(data.error || 'Failed to verify membership');
      }
    } catch (error) {
      console.error('Telegram membership check failed:', error);
      setTaskErrors(prev => ({
        ...prev,
        [taskId]: 'Failed to verify channel membership. Please try again.'
      }));
      return false;
    } finally {
      setVerifyingMembership(null);
    }
  };

  const getTaskIcon = (category: TaskCategory | "General") => {
    if (category === "TG Tasks") return <FaTelegram className="w-5 h-5 md:w-6 md:h-6 text-white" />;
    if (category === "Socials Tasks") return <Users className="w-5 h-5 md:w-6 md:h-6 text-white" />;
    return <Coins className="w-5 h-5 md:w-6 md:h-6 text-white" />;
  };

  const getTaskAvailability = () => {
    return { canStart: true };
  };

  const currentTasks = showGiveaway ? giveawayTasks : regularTasks;

  const filteredTasks = useMemo(() => {
    if (showGiveaway) {
      return currentTasks;
    }
    if (dailyTaskFilter === "All") return currentTasks;
    return currentTasks.filter((t) => t.category === dailyTaskFilter);
  }, [currentTasks, dailyTaskFilter, showGiveaway]);

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / pageSize));
  const paginatedTasks = filteredTasks.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const giveawayEntryCost = 1;
  const canEnterGiveaway = (user?.diamonds || 0) >= giveawayEntryCost;

  // Calculate completed and available tasks for claim all
  const availableTasksForClaim = useMemo(() => {
    if (!user || !showGiveaway) return [];

    return filteredTasks.filter(task => {
      const isCompleted = user.tasksCompleted?.[task.id] || 0;
      return !isCompleted;
    });
  }, [filteredTasks, user, showGiveaway]);

  const completedTasksCount = useMemo(() => {
    if (!user || !showGiveaway) return 0;

    return filteredTasks.filter(task => {
      const isCompleted = user.tasksCompleted?.[task.id] || 0;
      return isCompleted > 0;
    }).length;
  }, [filteredTasks, user, showGiveaway]);

  const totalAvailableReward = useMemo(() => {
    return availableTasksForClaim.reduce((sum, task) => sum + task.reward, 0);
  }, [availableTasksForClaim]);

  const handleStartTask = async (task: Task) => {
    const availability = getTaskAvailability();
    if (!availability.canStart) return;

    // Check if task is already completed (prevent multiple claims)
    const isCompleted = user?.tasksCompleted?.[task.id] || 0;
    if (isCompleted > 0) {
      setTaskErrors(prev => ({
        ...prev,
        [task.id]: 'This task has already been completed and cannot be claimed again.'
      }));
      return;
    }

    setTaskErrors((e) => ({ ...e, [task.id]: "" }));
    setStartingTask(task.id);

    setTimeout(() => {
      setStartingTask(null);
      setPendingTask(task);

      if (task.url) {
        window.open(task.url, "_blank");
      }
      else if (task.category === "TG Tasks") {
        const url = task.telegramChannel
          ? `https://t.me/${task.telegramChannel}`
          : "https://t.me";
        window.open(url, "_blank");
      }
    }, 800);
  };

  const handleCancelTask = (task: Task) => {
    if (pendingTask?.id === task.id) setPendingTask(null);
  };

  const handleClaimTask = async (task: Task) => {
    if (!isServerOnline || !user) return;

    // Double-check if task is already completed (prevent multiple claims)
    const isCompleted = user?.tasksCompleted?.[task.id] || 0;
    if (isCompleted > 0) {
      setTaskErrors(prev => ({
        ...prev,
        [task.id]: 'This task has already been completed and cannot be claimed again.'
      }));
      setClaimingTask(null);
      setPendingTask(null);
      return;
    }

    if (task.category === "TG Tasks" && task.checkMembership && task.telegramChannel) {
      setClaimingTask(task.id);
      setTaskErrors((e) => ({ ...e, [task.id]: "" }));

      try {
        const isMember = await checkTelegramMembership(task.id, task.telegramChannel);

        if (!isMember) {
          setTaskErrors(prev => ({
            ...prev,
            [task.id]: `You need to join @${task.telegramChannel} to claim this reward. Please join the channel and try again.`
          }));
          setClaimingTask(null);
          return;
        }

        await processTaskClaim(task);

      } catch (error) {
        console.error('Error claiming task:', error);
        setTaskErrors(prev => ({
          ...prev,
          [task.id]: 'Failed to verify task completion. Please try again.'
        }));
        setClaimingTask(null);
        return;
      }
    } else {
      setClaimingTask(task.id);
      await processTaskClaim(task);
    }
  };

  const processTaskClaim = async (task: Task) => {
    if (!user) return;

    // Final check to prevent multiple claims
    const isCompleted = user?.tasksCompleted?.[task.id] || 0;
    if (isCompleted > 0) {
      setTaskErrors(prev => ({
        ...prev,
        [task.id]: 'This task has already been completed.'
      }));
      setClaimingTask(null);
      setPendingTask(null);
      return;
    }

    setTimeout(() => {
      setClaimingTask(null);
      setPendingTask(null);

      const updates: Partial<UserData> = {
        tasksCompleted: {
          ...user.tasksCompleted,
          [task.id]: 1, // Set to 1 to mark as completed (prevent multiple claims)
        }
      };

      if (task.isDiamondTask && task.diamondReward) {
        updates.diamonds = (user.diamonds || 0) + task.diamondReward;
        setShowConfetti(true);
      } else {
        if (showGiveaway) {
          updates.balance = (user.balance || 0) + task.reward;
          updates.totalEarned = (user.totalEarned || 0) + task.reward;
        }
      }

      updateUserData(updates);
      setShowConfetti(true);
    }, 1000);
  };

  const handleEnterGiveaway = () => {
    if (!canEnterGiveaway || !user) return;

    const updates: Partial<UserData> = {
      diamonds: (user.diamonds || 0) - giveawayEntryCost
    };

    updateUserData(updates);
    setShowGiveaway(true);
    setDailyTaskFilter("All");
    setCurrentPage(1);
    setShowConfetti(true);
  };

  // New function to claim all available tasks
  const handleClaimAllTasks = async () => {
    if (!isServerOnline || !user || availableTasksForClaim.length === 0) return;

    setClaimingAll(true);
    setTaskErrors({});

    let totalClaimed = 0;
    let totalReward = 0;

    for (const task of availableTasksForClaim) {
      // Check if task requires membership verification
      if (task.category === "TG Tasks" && task.checkMembership && task.telegramChannel) {
        try {
          const isMember = await checkTelegramMembership(task.id, task.telegramChannel);

          if (!isMember) {
            setTaskErrors(prev => ({
              ...prev,
              [task.id]: `You need to join @${task.telegramChannel} to claim this reward.`
            }));
            continue; // Skip to next task
          }
        } catch (error) {
          console.error(`Error verifying membership for task ${task.id}:`, error);
          setTaskErrors(prev => ({
            ...prev,
            [task.id]: 'Failed to verify channel membership.'
          }));
          continue; // Skip to next task
        }
      }

      // Process the claim
      const isCompleted = user.tasksCompleted?.[task.id] || 0;
      if (isCompleted > 0) {
        continue; // Skip already completed tasks
      }

      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 500));

      // Update user data for this task
      const updates: Partial<UserData> = {
        tasksCompleted: {
          ...user.tasksCompleted,
          [task.id]: 1,
        }
      };

      if (showGiveaway) {
        updates.balance = (user.balance || 0) + task.reward;
        updates.totalEarned = (user.totalEarned || 0) + task.reward;
        totalReward += task.reward;
      }

      updateUserData(updates);
      totalClaimed++;
    }

    setClaimingAll(false);

    if (totalClaimed > 0) {
      setShowConfetti(true);
      // Show success message
      setTaskErrors(prev => ({
        ...prev,
        'claim-all': `Successfully claimed ${totalClaimed} task(s) for $${totalReward.toFixed(2)}!`
      }));
    } else {
      setTaskErrors(prev => ({
        ...prev,
        'claim-all': 'No tasks available to claim. Please complete the tasks first.'
      }));
    }
  };

  // Test backend connection
  const testBackendConnection = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/health`);
      const data = await response.json();
      console.log('Backend connection test:', data);
      return data.status === 'healthy';
    } catch (error) {
      console.error('Backend connection test failed:', error);
      return false;
    }
  };

  // Test connection on component mount
  useEffect(() => {
    testBackendConnection();
  }, []);

  if (!showGiveaway) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#f8fafc] to-[#f1f5f9] px-4 py-4 md:py-6 pb-32 md:pb-40 safe-area-bottom">
        {showConfetti && <Confetti recycle={false} numberOfPieces={200} />}
        <div className="max-w-md mx-auto">

          {/* Premium Giveaway Banner */}
          <div className="relative bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700 rounded-2xl p-4 md:p-6 text-center text-white mb-4 md:mb-6 shadow-2xl overflow-hidden">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-2 left-4 w-6 h-6 md:w-8 md:h-8 bg-white rounded-full animate-pulse"></div>
              <div className="absolute top-6 right-8 w-4 h-4 md:w-6 md:h-6 bg-yellow-400 rounded-full animate-bounce"></div>
              <div className="absolute bottom-4 left-8 w-8 h-8 md:w-10 md:h-10 bg-cyan-400 rounded-full animate-pulse delay-1000"></div>
              <div className="absolute bottom-8 right-4 w-3 h-3 md:w-4 md:h-4 bg-pink-400 rounded-full animate-bounce delay-500"></div>
            </div>

            <div className="relative z-10">
              <div className="flex items-center justify-center gap-2 md:gap-3 mb-2 md:mb-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-white rounded-full animate-ping opacity-75"></div>
                  <div className="relative bg-gradient-to-br from-amber-400 to-orange-500 p-2 md:p-3 rounded-2xl shadow-lg border-2 border-amber-200">
                    <Trophy className="w-6 h-6 md:w-8 md:h-8 text-white" />
                  </div>
                </div>
                <div className="text-left">
                  <h2 className="text-lg md:text-2xl font-bold bg-gradient-to-r from-amber-200 to-yellow-200 bg-clip-text text-transparent">
                    MEGA GIVEAWAY
                  </h2>
                  <p className="text-blue-100 text-xs md:text-sm">Total Prize Pool: {giveawaySettings.totalPrizePool} Diamonds</p>
                </div>
              </div>

              <div className="flex items-center justify-between mb-3 md:mb-4 p-3 md:p-4 bg-white/10 rounded-xl backdrop-blur-sm border border-white/20">
                <div className="text-left">
                  <div className="flex items-center gap-1 md:gap-2 mb-1">
                    <FaGem className="w-4 h-4 md:w-5 md:h-5 text-cyan-300" />
                    <span className="text-xs md:text-sm text-cyan-100">Entry Cost</span>
                  </div>
                  <div className="text-lg md:text-xl font-bold text-white">{giveawayEntryCost} Diamonds</div>
                </div>

                <div className="text-right">
                  <div className="flex items-center gap-1 md:gap-2 mb-1">
                    <FaGem className="w-4 h-4 md:w-5 md:h-5 text-cyan-300" />
                    <span className="text-xs md:text-sm text-cyan-100">Your Diamonds</span>
                  </div>
                  <div className={`text-lg md:text-xl font-bold ${canEnterGiveaway ? 'text-green-300' : 'text-red-300'}`}>
                    {user?.diamonds || 0}
                  </div>
                </div>
              </div>

              <p className="text-blue-100 text-xs md:text-sm mb-3 md:mb-4 leading-relaxed">
                Unlock exclusive Telegram tasks and earn from the {giveawaySettings.totalPrizePool} Diamond prize pool! Complete regular tasks to earn diamonds first.
              </p>

              <button
                onClick={handleEnterGiveaway}
                disabled={!canEnterGiveaway}
                className={`group relative w-full font-bold py-3 md:py-4 px-6 md:px-8 rounded-2xl transition-all duration-300 text-base md:text-lg shadow-lg transform
                  ${canEnterGiveaway
                    ? 'bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white hover:scale-105 hover:shadow-xl'
                    : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  }`}
              >
                <div className="flex items-center justify-center gap-1 md:gap-2">
                  {canEnterGiveaway ? (
                    <>
                      <Sparkles className="w-4 h-4 md:w-5 md:h-5 group-hover:animate-spin" />
                      <span>Enter Mega Giveaway</span>
                      <Sparkles className="w-4 h-4 md:w-5 md:h-5 group-hover:animate-spin" />
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 md:w-5 md:h-5" />
                      <span>Need More Diamonds</span>
                    </>
                  )}
                </div>

                {canEnterGiveaway && (
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                )}
              </button>

              {!canEnterGiveaway && (
                <p className="text-amber-200 text-xs mt-2 md:mt-3">
                  Complete tasks below to earn {giveawayEntryCost - (user?.diamonds || 0)} more diamonds
                </p>
              )}
            </div>
          </div>

          {/* User Balance */}
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-3 md:p-4 text-white mb-4 md:mb-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-xs md:text-sm">Current Balance</p>
                <p className="text-xl md:text-2xl font-bold">${(user?.balance || 0).toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-green-100 text-xs md:text-sm">Your Diamonds</p>
                <div className="flex items-center gap-1 md:gap-2 justify-end">
                  <FaGem className="w-4 h-4 md:w-5 md:h-5 text-cyan-300" />
                  <span className="text-xl md:text-2xl font-bold">{user?.diamonds || 0}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="bg-white/80 backdrop-blur-lg rounded-2xl border border-gray-200 p-1 mb-4 md:mb-6 shadow-sm">
            <div className="flex justify-between gap-1">
              {["All", "Socials Tasks", "TG Tasks"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setDailyTaskFilter(tab as TaskCategory);
                    setCurrentPage(1);
                    setTaskErrors({});
                  }}
                  className={`flex-1 py-2 md:py-3 rounded-xl text-xs md:text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-1 md:gap-2
                    ${dailyTaskFilter === tab
                      ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg"
                      : "text-gray-600 hover:text-gray-900 hover:bg-white/50"
                    }`}
                >
                  {tab === "TG Tasks" && <FaTelegram className="w-3 h-3 md:w-4 md:h-4" />}
                  <span className="hidden xs:inline">{tab}</span>
                  <span className="xs:hidden">{tab.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tasks List */}
          <div className="space-y-2 md:space-y-3">
            {loadingTasks ? (
              <div className="bg-white/80 backdrop-blur-lg rounded-2xl border border-gray-200 p-6 md:p-8 text-center shadow-sm">
                <div className="w-10 h-10 md:w-12 md:h-12 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3 md:mb-4"></div>
                <p className="text-gray-700 font-semibold text-sm md:text-base">Loading tasks...</p>
              </div>
            ) : paginatedTasks.length === 0 ? (
              <div className="bg-white/80 backdrop-blur-lg rounded-2xl border border-gray-200 p-6 md:p-8 text-center shadow-sm">
                <FaTasks className="w-10 h-10 md:w-12 md:h-12 text-gray-400 mx-auto mb-2 md:mb-3 opacity-50" />
                <p className="text-gray-700 font-semibold text-sm md:text-base">
                  {regularTasks.length === 0 ? "No tasks available" : "No tasks in this category"}
                </p>
                <p className="text-gray-500 text-xs md:text-sm mt-1">
                  Check back later for new tasks
                </p>
              </div>
            ) : (
              paginatedTasks.map((task) => {
                const completed = user?.tasksCompleted?.[task.id] || 0;
                const isCompleted = completed > 0;
                const isPending = pendingTask?.id === task.id;
                const isStarting = startingTask === task.id;
                const isClaiming = claimingTask === task.id;
                const isVerifyingMembership = verifyingMembership === task.id;
                const isTelegramTask = task.category === "TG Tasks" && task.checkMembership;
                const isTaskDisabled = isTelegramTask && !isServerOnline;
                const isDiamondTask = task.isDiamondTask;

                return (
                  <div
                    key={task.id}
                    className={`bg-white/80 backdrop-blur-lg rounded-2xl border transition-all duration-300 shadow-sm
                      ${isTaskDisabled ? 'border-red-300 opacity-70' :
                        isPending ? 'border-yellow-400' :
                          isDiamondTask ? 'border-cyan-400' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <div className="p-3 md:p-4">
                      <div className="flex items-start gap-2 md:gap-3">
                        {/* Task Icon */}
                        <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300
                          ${isCompleted ? 'bg-gradient-to-r from-green-500 to-emerald-600' :
                            isPending ? 'bg-gradient-to-r from-yellow-500 to-amber-600' :
                              isTaskDisabled ? 'bg-gradient-to-r from-red-500 to-pink-600' :
                                isDiamondTask ? 'bg-gradient-to-r from-cyan-500 to-blue-600' :
                                  'bg-gradient-to-r from-blue-500 to-cyan-600'}`}
                        >
                          {isDiamondTask ? (
                            <FaGem className="w-4 h-4 md:w-6 md:h-6 text-white" />
                          ) : (
                            getTaskIcon(task.category as TaskCategory)
                          )}
                        </div>

                        {/* Task Content */}
                        <div className="flex-1 min-w-0">
                          {/* Header Row */}
                          <div className="flex items-start justify-between mb-1 md:mb-2">
                            <div className="flex-1 min-w-0">
                              <h3 className={`font-bold text-sm md:text-base leading-tight mb-1 ${isTaskDisabled ? 'text-gray-500' : 'text-gray-900'
                                }`}>
                                {task.name}
                              </h3>

                              {/* Telegram Channel */}
                              {task.telegramChannel && (
                                <div className="flex items-center gap-1 mb-1 md:mb-2">
                                  <FaTelegram className={`w-2 h-2 md:w-3 md:h-3 ${isTaskDisabled ? 'text-gray-500' : 'text-blue-500'}`} />
                                  <span className={`text-xs ${isTaskDisabled ? 'text-gray-500' : 'text-blue-600'}`}>
                                    @{task.telegramChannel}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Reward */}
                            <div className={`text-xs font-bold px-2 py-1 rounded-lg border ml-1 md:ml-2 flex-shrink-0
                              ${isDiamondTask
                                ? 'bg-cyan-500/20 text-cyan-700 border-cyan-500/30'
                                : 'bg-green-500/20 text-green-700 border-green-500/30'
                              }`}>
                              {isDiamondTask ? (
                                <div className="flex items-center gap-1">
                                  <FaGem className="w-2 h-2 md:w-3 md:h-3" />
                                  <span>+{task.diamondReward || 1}</span>
                                </div>
                              ) : (
                                `+$${task.reward.toFixed(2)}`
                              )}
                            </div>
                          </div>

                          {/* Progress and Stats */}
                          <div className="space-y-1 md:space-y-2">
                            {taskErrors[task.id] && (
                              <p className="text-red-600 text-xs bg-red-500/10 px-2 py-1 rounded border border-red-500/20 whitespace-pre-line">
                                ⚠️ {taskErrors[task.id]}
                              </p>
                            )}
                          </div>

                          {/* Action Button */}
                          <div className="mt-2 md:mt-3">
                            {isPending ? (
                              <div className="flex gap-1 md:gap-2">
                                <button
                                  className="flex-1 px-3 py-1.5 md:px-4 md:py-2 rounded-xl font-semibold text-xs md:text-sm bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white transition-all duration-300 flex items-center justify-center gap-1 md:gap-2"
                                  disabled={isClaiming || !isServerOnline || isVerifyingMembership}
                                  onClick={() => handleClaimTask(task)}
                                >
                                  {isVerifyingMembership ? (
                                    <>
                                      <Clock className="w-3 h-3 md:w-4 md:h-4 animate-spin" />
                                      Checking...
                                    </>
                                  ) : isClaiming ? (
                                    <>
                                      <Clock className="w-3 h-3 md:w-4 md:h-4 animate-spin" />
                                      Verifying...
                                    </>
                                  ) : isDiamondTask ? (
                                    <>
                                      <FaGem className="w-3 h-3 md:w-4 md:h-4" />
                                      Claim Diamond
                                    </>
                                  ) : (
                                    "Verify & Claim"
                                  )}
                                </button>
                                <button
                                  className="px-2 py-1.5 md:px-3 md:py-2 rounded-xl text-xs bg-red-500/20 text-red-600 border border-red-500/30 hover:bg-red-500/30 transition-all duration-300"
                                  onClick={() => handleCancelTask(task)}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                className={`w-full px-3 py-2 md:px-4 md:py-3 rounded-xl font-semibold text-xs md:text-sm transition-all duration-300 flex items-center justify-center gap-1 md:gap-2
                                  ${isCompleted
                                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                    : isTaskDisabled || isStarting
                                      ? "bg-red-500/20 text-red-600 cursor-not-allowed"
                                      : isDiamondTask
                                        ? "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white"
                                        : "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
                                  }`}
                                disabled={isCompleted || isTaskDisabled || isStarting}
                                onClick={() => handleStartTask(task)}
                              >
                                {isCompleted ? (
                                  isDiamondTask ? (
                                    <>
                                      <FaGem className="w-3 h-3 md:w-4 md:h-4" />
                                      Diamond Claimed
                                    </>
                                  ) : (
                                    "Completed"
                                  )
                                ) : isStarting ? (
                                  <>
                                    <Clock className="w-3 h-3 md:w-4 md:h-4 animate-spin" />
                                    Starting...
                                  </>
                                ) : isTaskDisabled ? (
                                  "Offline"
                                ) : task.buttonText ? (
                                  task.buttonText
                                ) : task.category === "TG Tasks" ? (
                                  <>
                                    <FaTelegram className="w-3 h-3 md:w-4 md:h-4" />
                                    Join Channel
                                  </>
                                ) : isDiamondTask ? (
                                  <>
                                    <FaGem className="w-3 h-3 md:w-4 md:h-4" />
                                    Earn Diamond
                                  </>
                                ) : (
                                  "🚀 Start Task"
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center mt-4 md:mt-6 space-x-2 md:space-x-3 mb-4 md:mb-6">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm rounded-lg bg-white/80 text-gray-700 disabled:opacity-40 hover:text-gray-900 hover:bg-white transition-all duration-300 border border-gray-300 shadow-sm"
              >
                Previous
              </button>
              <span className="text-gray-700 text-xs md:text-sm font-medium min-w-[60px] md:min-w-[80px] text-center">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm rounded-lg bg-white/80 text-gray-700 disabled:opacity-40 hover:text-gray-900 hover:bg-white transition-all duration-300 border border-gray-300 shadow-sm"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Mega Giveaway View (Paid Entry)
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f8fafc] to-[#f1f5f9] px-4 py-4 md:py-6 pb-32 md:pb-40 safe-area-bottom">
      {showConfetti && <Confetti recycle={false} numberOfPieces={200} />}

      <div className="max-w-md mx-auto">
        {/* Premium Header */}
        <div className="flex items-center mb-4 md:mb-6">
          <button
            onClick={() => setShowGiveaway(false)}
            className="p-2 md:p-3 rounded-xl bg-white/80 border border-gray-200 hover:bg-white transition-all duration-300 shadow-sm hover:shadow-md group"
          >
            <ArrowLeft className="w-4 h-4 md:w-5 md:h-5 text-gray-700 group-hover:text-purple-600" />
          </button>
          <div className="flex-1 text-center">
            <div className="flex items-center justify-center gap-2 md:gap-3 mb-1 md:mb-2">
              <div className="relative">
                <div className="absolute inset-0 bg-amber-400 rounded-full animate-ping opacity-75"></div>
                <div className="relative bg-gradient-to-br from-amber-500 to-orange-600 p-1.5 md:p-2 rounded-xl shadow-lg border-2 border-amber-300">
                  <Trophy className="w-4 h-4 md:w-6 md:h-6 text-white" />
                </div>
              </div>
              <h1 className="text-lg md:text-2xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                Mega Giveaway
              </h1>
            </div>
            <div className="flex items-center justify-center gap-1 md:gap-2 text-amber-700">
              <FaGem className="w-3 h-3 md:w-4 md:h-4" />
              <span className="text-xs md:text-sm font-semibold">
                Entry Cost: {giveawayEntryCost} Diamonds • Remaining: {user?.diamonds || 0} Diamonds
              </span>
            </div>
          </div>
        </div>

        {/* Balance Display */}
        <div className="grid grid-cols-2 gap-3">

          {/* Balance Box */}
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-3 md:p-5 text-white shadow-lg">
            <div className="text-center">
              <p className="text-green-100 text-[10px] md:text-sm mb-1">Your Balance</p>
              <p className="text-lg md:text-3xl font-bold">
                ${(user?.balance || 0).toFixed(2)}
              </p>
            </div>
          </div>

          {/* Total Prize Pool Box */}
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-3 md:p-5 text-white shadow-lg">
            <div className="text-center">
              <p className="text-blue-100 text-[10px] md:text-sm mb-1">Total Prize Pool</p>
              <p className="text-lg md:text-3xl font-bold">
                ${totalAvailableReward.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
        <div></div>

        {/* Entry Cost Info */}
        <div className="p-3 md:p-4 mb-4 md:mb-6">

        </div>

        {/* Tasks List - Only Telegram Tasks with Money Rewards */}
        <div className="space-y-3 md:space-y-4">
          {paginatedTasks.length === 0 ? (
            <div className="bg-white/80 backdrop-blur-lg rounded-2xl border border-gray-200 p-6 md:p-8 text-center shadow-sm">
              <FaTelegram className="w-10 h-10 md:w-12 md:h-12 text-gray-400 mx-auto mb-2 md:mb-3 opacity-50" />
              <p className="text-gray-700 font-semibold text-sm md:text-base">No Telegram tasks available</p>
              <p className="text-gray-500 text-xs md:text-sm mt-1">
                Check back later for new tasks
              </p>
            </div>
          ) : (
            paginatedTasks.map((task) => {
              const completed = user?.tasksCompleted?.[task.id] || 0;
              const isCompleted = completed > 0;
              const isPending = pendingTask?.id === task.id;
              const isStarting = startingTask === task.id;
              const isClaiming = claimingTask === task.id;
              const isVerifyingMembership = verifyingMembership === task.id;
              const isTelegramTask = task.category === "TG Tasks" && task.checkMembership;
              const isTaskDisabled = isTelegramTask && !isServerOnline;

              return (
                <div
                  key={task.id}
                  className={`bg-white/80 backdrop-blur-lg rounded-2xl border-2 transition-all duration-300 shadow-lg hover:shadow-xl
                    ${isTaskDisabled ? 'border-red-300 opacity-70' :
                      isPending ? 'border-yellow-400 bg-yellow-50/50' :
                        isCompleted ? 'border-green-400 bg-green-50/50' :
                          'border-transparent hover:border-purple-300'}`}
                >
                  <div className="p-4 md:p-5">
                    <div className="flex items-start gap-3 md:gap-4">
                      {/* Premium Task Icon */}
                      <div className={`relative w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-300 shadow-lg
                        ${isCompleted ? 'bg-gradient-to-br from-green-500 to-emerald-600' :
                          isPending ? 'bg-gradient-to-br from-yellow-500 to-amber-600' :
                            isTaskDisabled ? 'bg-gradient-to-br from-red-500 to-pink-600' :
                              'bg-gradient-to-br from-purple-500 to-blue-600'}`}
                      >
                        <FaTelegram className="w-5 h-5 md:w-7 md:h-7 text-white" />
                        {isCompleted && (
                          <div className="absolute -top-1 -right-1 md:-top-2 md:-right-2 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full p-1 shadow-lg border-2 border-white">
                            <Coins className="w-2 h-2 md:w-3 md:h-3 text-white" />
                          </div>
                        )}
                      </div>

                      {/* Task Content */}
                      <div className="flex-1 min-w-0">
                        {/* Header Row */}
                        <div className="flex items-start justify-between mb-2 md:mb-3">
                          <div className="flex-1 min-w-0">
                            <h3 className={`font-bold text-base md:text-lg leading-tight mb-1 md:mb-2 ${isTaskDisabled ? 'text-gray-500' : 'text-gray-900'
                              }`}>
                              {task.name}
                            </h3>

                            {/* Telegram Channel */}
                            {task.telegramChannel && (
                              <div className="flex items-center gap-1 md:gap-2 mb-1 md:mb-2">
                                <FaTelegram className={`w-3 h-3 md:w-4 md:h-4 ${isTaskDisabled ? 'text-gray-500' : 'text-blue-500'}`} />
                                <span className={`text-sm font-medium ${isTaskDisabled ? 'text-gray-500' : 'text-blue-600'}`}>
                                  @{task.telegramChannel}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Progress and Stats */}
                        <div className="space-y-2 md:space-y-3">
                          {taskErrors[task.id] && (
                            <p className="text-red-600 text-xs md:text-sm bg-red-500/10 px-2 py-1.5 md:px-3 md:py-2 rounded-xl border border-red-500/20 whitespace-pre-line">
                              ⚠️ {taskErrors[task.id]}
                            </p>
                          )}
                        </div>

                        {/* Premium Action Button */}
                        <div className="mt-3 md:mt-4">
                          {isPending ? (
                            <div className="flex gap-2 md:gap-3">
                              <button
                                className="flex-1 px-3 py-2 md:px-4 md:py-3 rounded-xl font-bold text-xs md:text-sm bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white transition-all duration-300 flex items-center justify-center gap-1 md:gap-2 shadow-lg hover:shadow-xl"
                                disabled={isClaiming || !isServerOnline || isVerifyingMembership}
                                onClick={() => handleClaimTask(task)}
                              >
                                {isVerifyingMembership ? (
                                  <>
                                    <Clock className="w-3 h-3 md:w-4 md:h-4 animate-spin" />
                                    Checking...
                                  </>
                                ) : isClaiming ? (
                                  <>
                                    <Clock className="w-3 h-3 md:w-4 md:h-4 animate-spin" />
                                    Verifying...
                                  </>
                                ) : (
                                  <>
                                    <Coins className="w-3 h-3 md:w-4 md:h-4" />
                                    Verify & Claim
                                  </>
                                )}
                              </button>
                              <button
                                className="px-3 py-2 md:px-4 md:py-3 rounded-xl text-xs bg-red-500/20 text-red-600 border border-red-500/30 hover:bg-red-500/30 transition-all duration-300 font-semibold"
                                onClick={() => handleCancelTask(task)}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              className={`w-full px-3 py-3 md:px-4 md:py-4 rounded-xl font-bold text-xs md:text-sm transition-all duration-300 flex items-center justify-center gap-2 md:gap-3 shadow-lg hover:shadow-xl
                                ${isCompleted
                                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                  : isTaskDisabled || isStarting
                                    ? "bg-red-500/20 text-red-600 cursor-not-allowed"
                                    : "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white hover:scale-105 transform"
                                }`}
                              disabled={isCompleted || isTaskDisabled || isStarting}
                              onClick={() => handleStartTask(task)}
                            >
                              {isCompleted ? (
                                <>
                                  <Coins className="w-4 h-4 md:w-5 md:h-5" />
                                  Money Earned!
                                </>
                              ) : isStarting ? (
                                <>
                                  <Clock className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
                                  Starting...
                                </>
                              ) : isTaskDisabled ? (
                                "Offline"
                              ) : (
                                <>
                                  <FaTelegram className="w-4 h-4 md:w-5 md:h-5" />
                                  Join Channel
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Claim All Button - Only show when there are tasks available to claim */}
        {availableTasksForClaim.length > 0 && (
          <div className="mt-6 md:mt-8 mb-4 md:mb-6">
            <div className="bg-gradient-to-r from-purple-500 to-blue-600 rounded-2xl p-4 md:p-5 text-white shadow-lg">
              <div className="text-center mb-3 md:mb-4">
                <h3 className="font-bold text-lg md:text-xl mb-1 md:mb-2">
                  Claim All Available Tasks
                </h3>

                <div className="border border-purple-300 rounded-xl px-4 py-2 inline-flex items-center justify-center gap-4">

                  {/* Available */}
                  <p className="text-purple-100 text-sm md:text-base">
                    {availableTasksForClaim.length} available
                  </p>

                  {/* Divider */}
                  <div className="h-5 w-px bg-purple-300"></div>

                  {/* Completed */}
                  <p className="text-purple-200 text-sm md:text-base">
                    {completedTasksCount} completed
                  </p>

                </div>
              </div>


              <button
                onClick={handleClaimAllTasks}
                disabled={claimingAll || availableTasksForClaim.length === 0}
                className={`w-full py-3 md:py-4 rounded-xl font-bold text-sm md:text-base transition-all duration-300 flex items-center justify-center gap-2 md:gap-3 shadow-lg
                  ${claimingAll || availableTasksForClaim.length === 0
                    ? "bg-gray-400 text-gray-200 cursor-not-allowed"
                    : "bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white hover:scale-105 transform hover:shadow-xl"
                  }`}
              >
                {claimingAll ? (
                  <>
                    <Clock className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
                    Claiming {availableTasksForClaim.length} Tasks...
                  </>
                ) : (
                  <>
                    <Coins className="w-4 h-4 md:w-5 md:h-5" />
                    Claim All (${totalAvailableReward.toFixed(2)})
                  </>
                )}
              </button>
            </div>

            {taskErrors['claim-all'] && (
              <div className={`mt-3 p-3 rounded-xl text-center text-sm font-medium ${taskErrors['claim-all'].includes('Successfully')
                  ? 'bg-green-500/20 text-green-700 border border-green-500/30'
                  : 'bg-red-500/20 text-red-700 border border-red-500/30'
                }`}>
                {taskErrors['claim-all']}
              </div>
            )}
          </div>
        )}

        {/* Premium Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center mt-6 md:mt-8 space-x-3 md:space-x-4 mb-4 md:mb-6">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 md:px-5 md:py-3 text-xs md:text-sm rounded-xl bg-white/80 text-gray-700 disabled:opacity-40 hover:text-gray-900 hover:bg-white transition-all duration-300 border border-gray-300 shadow-sm hover:shadow-md font-semibold"
            >
              ← Previous
            </button>
            <span className="text-gray-700 text-xs md:text-sm font-bold min-w-[80px] md:min-w-[100px] text-center bg-white/80 px-3 py-2 md:px-4 md:py-3 rounded-xl border border-gray-300 shadow-sm">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 md:px-5 md:py-3 text-xs md:text-sm rounded-xl bg-white/80 text-gray-700 disabled:opacity-40 hover:text-gray-900 hover:bg-white transition-all duration-300 border border-gray-300 shadow-sm hover:shadow-md font-semibold"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default BonusPage;