import React, { useState, useEffect } from "react";
import { Trophy, Copy, X, ArrowLeft } from "lucide-react";
import { FaTelegramPlane, FaUserFriends } from "react-icons/fa";
import { database } from "../App";
import { ref, get } from 'firebase/database';
import { UserData } from "../App";

interface Referral {
  chat_id: string;
  first_name: string;
  profile_photo_url?: string | null;
  joinedAt: string | number | Date;
  total_balance: number;
  referralEarnings: number;
}

interface LeaderboardUser {
  telegramId: number;
  firstName: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
  totalEarned: number;
  balance: number;
  referralEarnings: number;
  rank: number;
}

const REFERRAL_BONUS = 0.0015;

interface ReferProps {
  user: UserData | null;
  updateUserData: (updates: Partial<UserData>) => void;
}

const Refer: React.FC<ReferProps> = ({ user }) => {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardUsers, setLeaderboardUsers] = useState<LeaderboardUser[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [totalReferralEarnings, setTotalReferralEarnings] = useState(0);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage] = useState(5);

  const referralLink =
    typeof window !== "undefined"
      ? `https://t.me/fjdhfjwjhbot?start=${user?.telegramId}`
      : "";

  useEffect(() => {
    if (user) {
      const loadReferrals = async () => {
        try {
          const refs: Referral[] = [];
          let totalRefEarnings = 0;
          
          for (const refId of user.referrals) {
            const userRef = ref(database, `users/${refId}`);
            const snapshot = await get(userRef);
            if (snapshot.exists()) {
              const refUser = snapshot.val() as UserData;
              const refEarnings = REFERRAL_BONUS;
              totalRefEarnings += refEarnings;
              
              refs.push({
                chat_id: refId.toString(),
                first_name: refUser.firstName,
                profile_photo_url: refUser.photoUrl,
                joinedAt: refUser.joinDate,
                total_balance: refUser.totalEarned,
                referralEarnings: refEarnings
              });
            }
          }
          setReferrals(refs);
          setTotalReferralEarnings(totalRefEarnings);
        } catch (error) {
          console.error('Error loading referrals:', error);
        }
      };

      loadReferrals();
    }
  }, [user]);

  const loadLeaderboard = async () => {
    setLoadingLeaderboard(true);
    try {
      const usersRef = ref(database, 'users');
      const snapshot = await get(usersRef);
      
      if (snapshot.exists()) {
        const usersData = snapshot.val();
        const allUsers: LeaderboardUser[] = [];
        
        Object.keys(usersData).forEach(telegramId => {
          const userData = usersData[telegramId] as UserData;
          
          // Include all users who have earned something (balance > 0)
          if (userData.balance > 0) {
            // Calculate total earned from balance (this represents their current earnings)
            const totalEarned = userData.balance;
            
            // Calculate referral earnings based on their referrals count
            const referralEarnings = (userData.referrals?.length || 0) * REFERRAL_BONUS;
            
            allUsers.push({
              telegramId: userData.telegramId,
              firstName: userData.firstName,
              lastName: userData.lastName,
              username: userData.username,
              photoUrl: userData.photoUrl,
              totalEarned: totalEarned + referralEarnings, // Combine balance + referral earnings
              balance: userData.balance,
              referralEarnings: referralEarnings,
              rank: 0
            });
          }
        });
        
        // Sort by totalEarned (balance + referral earnings) in descending order
        allUsers.sort((a, b) => b.totalEarned - a.totalEarned);
        
        const topUsers = allUsers.slice(0, 100).map((user, index) => ({
          ...user,
          rank: index + 1
        }));
        
        setLeaderboardUsers(topUsers);
        setCurrentPage(1); // Reset to first page when loading new data
      }
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  // Pagination calculations
  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = leaderboardUsers.slice(indexOfFirstUser, indexOfLastUser);
  const totalPages = Math.ceil(leaderboardUsers.length / usersPerPage);

  // Pagination controls
  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleShowLeaderboard = () => {
    setShowLeaderboard(true);
    loadLeaderboard();
  };

  const referredCount = referrals.length;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      alert("Referral link copied!");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = referralLink;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      alert("Referral link copied!");
    }
  };

  const shareOnTelegram = () => {
    const url = encodeURIComponent(referralLink);
    const text = encodeURIComponent("Join me and earn!");
    window.open(`https://t.me/share/url?url=${url}&text=${text}`, "_blank");
  };

  const LeaderboardModal = () => {
    if (!showLeaderboard) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4 safe-area-top safe-area-bottom">
        <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl border border-white/60 mx-auto">
          <div className="p-4 sm:p-6 border-b border-gray-200/50 flex items-center justify-between bg-gradient-to-r from-purple-500 to-indigo-600 rounded-t-3xl">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded-xl sm:rounded-2xl flex items-center justify-center">
                <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-white">Top Earners</h2>
                <p className="text-white/80 text-xs sm:text-sm">
                  Based on total earnings
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowLeaderboard(false)}
              className="w-7 h-7 sm:w-8 sm:h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all duration-300"
            >
              <X className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 sm:p-4 bg-gradient-to-b from-gray-50 to-white">
            {loadingLeaderboard ? (
              <div className="flex flex-col items-center justify-center py-8 sm:py-12">
                <div className="w-10 h-10 sm:w-12 sm:h-12 border-3 border-purple-500 border-t-transparent rounded-full animate-spin mb-3 sm:mb-4"></div>
                <p className="text-gray-600 font-medium text-sm sm:text-base">Loading leaderboard...</p>
              </div>
            ) : leaderboardUsers.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
                </div>
                <p className="text-gray-700 font-semibold text-base sm:text-lg mb-2">No users yet</p>
                <p className="text-gray-500 text-xs sm:text-sm">Be the first to earn and top the leaderboard!</p>
              </div>
            ) : (
              <>
                <div className="space-y-2 sm:space-y-3 mb-4">
                  {currentUsers.map((user) => (
                    <div
                      key={user.telegramId}
                      className="group bg-white/80 backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-gray-200/60 hover:border-purple-300 hover:shadow-lg transition-all duration-300 hover:scale-[1.02]"
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className={`flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center text-white font-bold text-sm sm:text-base shadow-lg
                          ${user.rank === 1 ? 'bg-gradient-to-br from-yellow-400 to-amber-500 shadow-yellow-200' : 
                            user.rank === 2 ? 'bg-gradient-to-br from-gray-400 to-gray-500 shadow-gray-200' : 
                            user.rank === 3 ? 'bg-gradient-to-br from-amber-600 to-orange-600 shadow-amber-200' : 
                            'bg-gradient-to-br from-blue-500 to-purple-500 shadow-blue-200'}`}
                        >
                          {user.rank}
                        </div>

                        <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-xs sm:text-sm border-2 border-white shadow-lg relative">
                          {user.photoUrl ? (
                            <img
                              src={user.photoUrl}
                              alt={user.firstName}
                              className="w-full h-full rounded-lg sm:rounded-xl object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            user.firstName.charAt(0).toUpperCase()
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 truncate text-xs sm:text-sm">
                            {user.firstName} {user.lastName || ''}
                          </p>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <p className="font-bold text-green-600 text-xs sm:text-sm">
                            ${user.totalEarned.toFixed(4)}
                          </p>
                          <p className="text-gray-500 text-xs font-medium">total earned</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex items-center justify-between">
                      {/* Previous Button */}
                      <button
                        onClick={prevPage}
                        disabled={currentPage === 1}
                        className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-300 ${
                          currentPage === 1
                            ? 'text-gray-400 cursor-not-allowed'
                            : 'text-purple-600 hover:bg-purple-50 hover:scale-105'
                        }`}
                      >
                        <ArrowLeft className="w-3 h-3" />
                        Previous
                      </button>

                      {/* Page Info */}
                      <div className="text-center">
                        <p className="text-xs text-gray-600 font-medium">
                          Page {currentPage} of {totalPages}
                        </p>
                        <p className="text-xs text-gray-500">
                          {leaderboardUsers.length} total users
                        </p>
                      </div>

                      {/* Next Button */}
                      <button
                        onClick={nextPage}
                        disabled={currentPage === totalPages}
                        className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-300 ${
                          currentPage === totalPages
                            ? 'text-gray-400 cursor-not-allowed'
                            : 'text-purple-600 hover:bg-purple-50 hover:scale-105'
                        }`}
                      >
                        Next
                        <ArrowLeft className="w-3 h-3 transform rotate-180" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="px-3 sm:px-4 mt-4 md:mt-6 pb-24 sm:pb-32 md:pb-40 space-y-4 sm:space-y-6 safe-area-bottom">
      <LeaderboardModal />
      
      <div className="bg-gradient-to-br from-white/90 to-blue-50/80 backdrop-blur-md rounded-2xl sm:rounded-3xl p-4 sm:p-6 text-center border border-white/60 shadow-xl">
        <div className="relative mb-3 sm:mb-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl sm:rounded-3xl flex items-center justify-center shadow-2xl">
            <FaUserFriends className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
          </div>
          <div className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 w-6 h-6 sm:w-8 sm:h-8 bg-green-400 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
            <span className="text-white text-xs font-bold">+</span>
          </div>
        </div>

        <h3 className="font-bold text-xl sm:text-2xl mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Invite Friends
        </h3>

        <p className="text-gray-600 mb-4 sm:mb-6 text-xs sm:text-sm">
          Share your link and earn <span className="font-bold text-green-500">${REFERRAL_BONUS.toFixed(4)}</span> per friend
        </p>

        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-6">
          <div className="bg-white/80 rounded-xl sm:rounded-2xl p-2 sm:p-3 shadow-lg border border-blue-100 hover:shadow-xl transition-all duration-300 hover:scale-105">
            <div className="text-sm sm:text-lg font-bold text-blue-600 mb-1">{referredCount}</div>
            <div className="text-[10px] sm:text-xs text-gray-600 font-medium">Friends Joined</div>
          </div>
          <div className="bg-white/80 rounded-xl sm:rounded-2xl p-2 sm:p-3 shadow-lg border border-green-100 hover:shadow-xl transition-all duration-300 hover:scale-105">
            <div className="text-sm sm:text-lg font-bold text-green-600 mb-1">${totalReferralEarnings.toFixed(4)}</div>
            <div className="text-[10px] sm:text-xs text-gray-600 font-medium">Refer Earnings</div>
          </div>
          <div className="bg-white/80 rounded-xl sm:rounded-2xl p-2 sm:p-3 shadow-lg border border-purple-100 hover:shadow-xl transition-all duration-300 hover:scale-105">
            <div className="text-sm sm:text-lg font-bold text-purple-600 mb-1">${user?.balance.toFixed(4) || "0.0000"}</div>
            <div className="text-[10px] sm:text-xs text-gray-600 font-medium">Main Balance</div>
          </div>
        </div>

        <div className="bg-white/90 rounded-xl sm:rounded-2xl p-3 sm:p-4 mb-4 sm:mb-6 shadow-lg border border-gray-200">
          <p className="text-gray-700 text-xs sm:text-sm font-medium mb-2 sm:mb-3">Your Personal Referral Link</p>
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <div className="flex-1 bg-gray-50 rounded-lg sm:rounded-xl p-2 sm:p-3 border border-gray-300 min-w-0">
              <span className="text-gray-800 text-xs sm:text-sm font-mono truncate block">{referralLink}</span>
            </div>
            <button
              onClick={copyLink}
              className="bg-blue-500 hover:bg-blue-600 text-white p-2 sm:p-3 rounded-lg sm:rounded-xl transition-all duration-300 hover:scale-105 shadow-lg flex items-center gap-1 sm:gap-2 flex-shrink-0"
            >
              <Copy className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline text-xs">Copy</span>
            </button>
          </div>
          
          <button
            onClick={shareOnTelegram}
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-2.5 sm:py-3 rounded-xl sm:rounded-2xl font-bold shadow-lg transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <FaTelegramPlane className="w-4 h-4 sm:w-5 sm:h-5" />
            Share on Telegram
          </button>
        </div>

        <button
          onClick={handleShowLeaderboard}
          className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold shadow-xl transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2 sm:gap-3 group text-sm sm:text-base"
        >
          <div className="relative">
            <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-300 group-hover:scale-110 transition-transform" />
            <div className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 w-2 h-2 sm:w-3 sm:h-3 bg-yellow-400 rounded-full animate-ping"></div>
          </div>
          View Top Earners
        </button>
      </div>
    </div>
  );
};

export default Refer;